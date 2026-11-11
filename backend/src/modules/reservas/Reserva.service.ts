import { AppError } from "@shared/errors/AppError";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { ReservaRepository } from "./Reserva.repository";
import {
  CriarReservaDTO,
  CriarReservaClienteDTO,
  AtualizarStatusReservaDTO,
  MesasDisponiveisQuery,
  DisponibilidadeQuery,
  MensagemReservaDTO,
  CriarReservaCaixaDTO,
} from "./Reserva.schema";
import {
  montarJanela,
  agoraNoBrasil,
  comMargem,
  dateParaHHMM,
  funcionamentoNoDia,
  horarioDentroDoFuncionamento,
  FOLGA_ANTES_DE_FECHAR_MIN,
  MARGEM_ENTRE_RESERVAS_MIN,
  ANTECEDENCIA_MINIMA_HOJE_MIN,
} from "./Reserva.horario";
import prisma from "@config/prisma";
import { env } from "@config/env";
import { transporter } from "@config/mailer";
import { templateReservaDecisao } from "@shared/emails/templates";

// Quantas reservas em aberto (pendentes/confirmadas, de hoje em diante) um cliente pode ter no mesmo
// restaurante. Sem isso, uma pessoa poderia "segurar" todas as mesas e o controle de disponibilidade
// do restaurante perderia o sentido.
const MAX_RESERVAS_ABERTAS_POR_CLIENTE = 3;

export class ReservaService {
  constructor(private readonly repository: ReservaRepository) {}

  // CRIAR
  // Com mesa: confere o conflito e grava na MESMA transação, sob um lock por mesa. Assim duas
  // pessoas reservando a mesma mesa no mesmo horário não passam as duas pela checagem.

  async criar(
    data: CriarReservaDTO,
    estabelecimento_id: string,
    cliente_id?: string,
    extras?: { status?: "PENDENTE" | "CONFIRMADA"; confirmada_por_id?: string },
  ) {
    const janela = montarJanela(
      data.data_reserva,
      data.hora_inicio,
      data.hora_fim,
    );

    if (janela.fim <= janela.inicio) {
      throw new AppError("Hora fim deve ser posterior à hora início", 400);
    }

    const dados = {
      ...data,
      estabelecimento_id,
      ...(cliente_id && { cliente_id }),
      ...extras,
    };

    if (!data.mesa_id) {
      return this.repository.create(dados);
    }

    const mesa_id = data.mesa_id;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mesa_id}))`;

      const conflito = await this.repository.verificarConflito(
        estabelecimento_id,
        mesa_id,
        janela.data,
        janela.inicio,
        janela.fim,
        undefined,
        tx,
      );

      if (conflito) {
        throw new AppError(
          `Não é possível reservar esta mesa neste dia e horário: ela já tem reserva nesse período ou muito próxima (intervalo mínimo de ${MARGEM_ENTRE_RESERVAS_MIN} min entre reservas). Escolha outro horário ou outra mesa.`,
          409,
        );
      }

      return this.repository.create(dados, tx);
    });
  }

  // CAIXA: reservar uma mesa (dia, horário e descrição opcional)
  // Nasce CONFIRMADA (quem reserva é o próprio restaurante)
  async criarPeloCaixa(
    data: CriarReservaCaixaDTO,
    estabelecimento_id: string,
    usuario_id: string,
  ) {
    const mesa = await prisma.mesa.findFirst({
      where: { id: data.mesa_id, estabelecimento_id, ativo: true },
      select: { capacidade: true, status: true },
    });
    if (!mesa || mesa.status === "INATIVA") {
      throw new AppError("Mesa não encontrada neste restaurante", 404);
    }

    // Não reserva no passado (horário de Brasília)
    const agora = agoraNoBrasil();
    const [h, m] = data.hora_inicio.split(":").map(Number);
    if (
      data.data_reserva < agora.data ||
      (data.data_reserva === agora.data && h * 60 + m < agora.minutos)
    ) {
      throw new AppError(
        "Escolha um dia e horário que ainda não passaram",
        400,
      );
    }

    const inicioMin = h * 60 + m;
    const fimMin = Math.min(inicioMin + 120, 23 * 60 + 59);
    const hora_fim =
      data.hora_fim ??
      `${String(Math.floor(fimMin / 60)).padStart(2, "0")}:${String(fimMin % 60).padStart(2, "0")}`;

    return this.criar(
      {
        mesa_id: data.mesa_id,
        cliente_nome: "Reserva do Caixa",
        cliente_telefone: "Caixa",
        data_reserva: data.data_reserva,
        hora_inicio: data.hora_inicio,
        hora_fim,
        num_pessoas: Math.min(Math.max(mesa.capacidade, 1), 50),
        ...(data.descricao && { observacoes: data.descricao }),
      },
      estabelecimento_id,
      undefined,
      { status: "CONFIRMADA", confirmada_por_id: usuario_id },
    );
  }

  // CLIENTE: acha o restaurante pelo slug (o token do cliente não tem estabelecimento_id)

  private async buscarEstabelecimentoPorSlug(slug: string) {
    const estabelecimento = await prisma.estabelecimento.findFirst({
      where: { slug, ativo: true },
      select: { id: true, nome: true, horario_funcionamento: true },
    });

    if (!estabelecimento) {
      throw new AppError("Restaurante não encontrado", 404);
    }

    return estabelecimento;
  }

  // AVISO AO CLIENTE por e-mail (o app também mostra o aviso no topo da tela de reservas).
  // Recebe as linhas do grupo (uma por mesa). Falha de e-mail nunca atrapalha a operação.
  private notificarCliente(
    tipo: "CONFIRMADA" | "RECUSADA" | "CANCELADA" | "MENSAGEM",
    linhas: any[],
    mensagem?: string | null,
  ) {
    const reserva = linhas[0];
    if (!reserva?.cliente_id || !reserva?.cliente_email) return;

    void (async () => {
      try {
        const estab = await prisma.estabelecimento.findUnique({
          where: { id: reserva.estabelecimento_id },
          select: { nome: true },
        });
        const [ano, mes, dia] = new Date(reserva.data_reserva)
          .toISOString()
          .slice(0, 10)
          .split("-");
        const numeros = linhas.map((l) => l.mesa?.numero).filter(Boolean);
        const assunto: Record<string, string> = {
          CONFIRMADA: "Sua reserva foi confirmada!",
          RECUSADA: "Sua reserva não pôde ser aceita",
          CANCELADA: "Sua reserva foi cancelada pelo restaurante",
          MENSAGEM: "O restaurante enviou um recado sobre a sua reserva",
        };

        await transporter.sendMail({
          from: env.MAIL_FROM,
          to: reserva.cliente_email,
          subject: assunto[tipo],
          html: templateReservaDecisao({
            tipo,
            nomeCliente: reserva.cliente_nome,
            restaurante: estab?.nome ?? "O restaurante",
            data: `${dia}/${mes}/${ano}`,
            horario: dateParaHHMM(new Date(reserva.hora_inicio)),
            mesas: numeros.length
              ? `${numeros.length > 1 ? "Mesas" : "Mesa"} ${numeros.join(", ")}`
              : "",
            mensagem: mensagem ?? reserva.mensagem_restaurante ?? null,
          }),
        });
      } catch (err) {
        console.error("Falha ao avisar o cliente sobre a reserva:", err);
      }
    })();
  }

  // Todas as linhas da reserva (várias mesas = várias linhas com o mesmo grupo_id)
  private async linhasDaReserva(
    reserva: any,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return reserva.grupo_id
      ? this.repository.findByGrupo(reserva.grupo_id, db)
      : [reserva];
  }

  //  CLIENTE: CRIAR RESERVA 
  // Nasce PENDENTE: o restaurante confirma depois (PATCH /:id/status).
  // Nome, telefone e e-mail vêm da CONTA do cliente logado (nunca do corpo da requisição).

  async criarParaCliente(
    slug: string,
    data: CriarReservaClienteDTO,
    cliente_id: string,
  ) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug);

    const cliente = await prisma.cliente.findFirst({
      where: { id: cliente_id, ativo: true },
      select: { nome: true, telefone: true, email: true },
    });

    if (!cliente) {
      throw new AppError("Conta de cliente não encontrada", 404);
    }

    // Só dentro do horário de funcionamento do dia (se o restaurante configurou) e começando
    // pelo menos FOLGA_ANTES_DE_FECHAR_MIN minutos antes de fechar
    const func = funcionamentoNoDia(
      estabelecimento.horario_funcionamento,
      data.data_reserva,
    );
    if (func) {
      if (!func.aberto) {
        throw new AppError(
          "O restaurante não abre neste dia. Escolha outra data.",
          400,
        );
      }
      if (!horarioDentroDoFuncionamento(func, data.hora_inicio)) {
        throw new AppError(
          `O restaurante funciona das ${func.abertura} às ${func.fechamento} neste dia, e as reservas precisam começar ` +
            `até ${FOLGA_ANTES_DE_FECHAR_MIN} min antes de fechar. Escolha outro horário.`,
          400,
        );
      }
    }

    // Não reserva no passado e, para o mesmo dia, exige 2h de antecedência (horário de Brasília)
    const agora = agoraNoBrasil();
    const [h, m] = data.hora_inicio.split(":").map(Number);
    if (data.data_reserva < agora.data) {
      throw new AppError("Escolha uma data a partir de hoje", 400);
    }
    if (
      data.data_reserva === agora.data &&
      h * 60 + m < agora.minutos + ANTECEDENCIA_MINIMA_HOJE_MIN
    ) {
      const minimo = agora.minutos + ANTECEDENCIA_MINIMA_HOJE_MIN;
      const aPartirDe =
        minimo > 23 * 60 + 58
          ? null
          : `${String(Math.floor(minimo / 60)).padStart(2, "0")}:${String(minimo % 60).padStart(2, "0")}`;
      throw new AppError(
        `Para reservar hoje é preciso ter ${ANTECEDENCIA_MINIMA_HOJE_MIN / 60}h de antecedência.` +
          (aPartirDe
            ? ` Escolha um horário a partir das ${aPartirDe}.`
            : " Escolha outro dia."),
        400,
      );
    }

    // Conta reservas (não linhas): uma reserva em várias mesas conta uma vez só
    const abertasLinhas = await prisma.reserva.findMany({
      where: {
        estabelecimento_id: estabelecimento.id,
        cliente_id,
        status: { in: ["PENDENTE", "CONFIRMADA"] },
        data_reserva: { gte: new Date(`${agora.data}T00:00:00.000Z`) },
      },
      select: { id: true, grupo_id: true },
    });
    const abertas = new Set(abertasLinhas.map((r) => r.grupo_id ?? r.id)).size;

    if (abertas >= MAX_RESERVAS_ABERTAS_POR_CLIENTE) {
      throw new AppError(
        `Você já tem ${MAX_RESERVAS_ABERTAS_POR_CLIENTE} reservas em aberto neste restaurante. Cancele uma para fazer outra.`,
        400,
      );
    }

    // Mesas escolhidas: precisam ser DESTE restaurante (os ids vêm do navegador)
    const mesas_ids = [...new Set(data.mesas_ids)];
    const mesasEncontradas = await prisma.mesa.findMany({
      where: {
        id: { in: mesas_ids },
        estabelecimento_id: estabelecimento.id,
        ativo: true,
        status: { notIn: ["INATIVA", "RESERVADA"] },
      },
      select: { id: true, numero: true, capacidade: true },
    });

    if (mesasEncontradas.length !== mesas_ids.length) {
      throw new AppError("Mesa não encontrada neste restaurante", 404);
    }

    // Maiores primeiro: as pessoas vão enchendo as mesas e a sobra cai na última
    const mesas = [...mesasEncontradas].sort(
      (a, b) => b.capacidade - a.capacidade || a.numero - b.numero,
    );
    const capacidadeTotal = mesas.reduce((t, m) => t + m.capacidade, 0);
    const falta = Math.max(0, data.num_pessoas - capacidadeTotal);

    // Não vale pegar mesa a mais do que o necessário (segurar mesa à toa tira disponibilidade do restaurante)
    if (
      mesas.length > 1 &&
      capacidadeTotal - mesas[mesas.length - 1].capacidade >= data.num_pessoas
    ) {
      throw new AppError(
        "Você escolheu mais mesas do que o necessário para esta quantidade de pessoas",
        400,
      );
    }

    const janela = montarJanela(
      data.data_reserva,
      data.hora_inicio,
      data.hora_fim,
    );
    if (janela.fim <= janela.inicio) {
      throw new AppError("Hora fim deve ser posterior à hora início", 400);
    }

    // Quantas pessoas ficam em cada mesa
    let restantes = data.num_pessoas;
    const lugares = mesas.map((m, i) => {
      const ultima = i === mesas.length - 1;
      const ocupa =
        ultima && falta === 0 ? restantes : Math.min(m.capacidade, restantes);
      restantes -= ocupa;
      return { mesa_id: m.id, num_pessoas: Math.max(ocupa, 1) };
    });

    const { mesas_ids: _ignorado, ...resto } = data;
    const grupo_id = mesas.length > 1 ? randomUUID() : undefined;
    const linhas = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Trava as mesas sempre na mesma ordem (evita deadlock entre dois grupos que pegam as mesmas mesas)
        for (const id of [...mesas_ids].sort()) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        }

        for (const l of lugares) {
          const conflito = await this.repository.verificarConflito(
            estabelecimento.id,
            l.mesa_id,
            janela.data,
            janela.inicio,
            janela.fim,
            undefined,
            tx,
          );
          if (conflito) {
            throw new AppError(
              `Não é possível reservar estas mesas neste dia e horário: uma delas já tem reserva nesse período ou muito próxima (intervalo mínimo de ${MARGEM_ENTRE_RESERVAS_MIN} min entre reservas). Atualize a tela e escolha outro horário ou outras mesas.`,
              409,
            );
          }
        }

        // Faltando assentos só passa se o cliente pegou TODAS as mesas livres no horário
        // (se sobrar mesa livre, ele precisa escolhê-la antes de falar em falta)
        if (falta > 0) {
          const livres = await this.repository.mesasDisponiveis(
            estabelecimento.id,
            janela.data,
            janela.inicio,
            janela.fim,
            undefined,
            tx,
          );
          if (livres.some((m: any) => !mesas_ids.includes(m.id))) {
            throw new AppError(
              "Ainda há mesas livres neste horário. Selecione todas elas para esta reserva.",
              400,
            );
          }
        }

        const criadas = [];
        for (const l of lugares) {
          criadas.push(
            await this.repository.create(
              {
                ...resto,
                mesa_id: l.mesa_id,
                num_pessoas: l.num_pessoas,
                cliente_nome: cliente.nome,
                cliente_telefone: cliente.telefone,
                ...(cliente.email && { cliente_email: cliente.email }),
                estabelecimento_id: estabelecimento.id,
                cliente_id,
                ...(grupo_id && { grupo_id }),
                pessoas_total: data.num_pessoas,
                falta_assentos: falta,
              },
              tx,
            ),
          );
        }
        return criadas;
      },
    );

    return { ...linhas[0], mesas_do_grupo: linhas };
  }

  // CLIENTE: MINHAS RESERVAS (de hoje em diante)

  async listarDoCliente(slug: string, cliente_id: string) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug);
    const hoje = new Date(`${agoraNoBrasil().data}T00:00:00.000Z`);

    return this.repository.findByCliente(estabelecimento.id, cliente_id, hoje);
  }

  // CLIENTE: CANCELAR A PRÓPRIA RESERVA 
  // Só mexe na reserva: a mesa volta a aparecer como disponível no horário porque a disponibilidade
  // é calculada pelas reservas ativas (não pelo status da mesa).

  async cancelarDoCliente(slug: string, id: string, cliente_id: string) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug);
    const reserva = await this.repository.findByIdCompleto(id);

    if (
      !reserva ||
      (reserva as any).estabelecimento_id !== estabelecimento.id ||
      (reserva as any).cliente_id !== cliente_id
    ) {
      throw new AppError("Reserva não encontrada", 404);
    }

    const status = (reserva as any).status;
    if (!["PENDENTE", "CONFIRMADA"].includes(status)) {
      throw new AppError(
        `Esta reserva já está ${status}. Não é possível cancelar.`,
        400,
      );
    }

    const dados = { status: "CANCELADA", cancelada_por: "CLIENTE" };
    if ((reserva as any).grupo_id) {
      const linhas = await this.repository.updateGrupo(
        (reserva as any).grupo_id,
        dados,
      );
      return linhas[0];
    }
    return this.repository.update(id, dados);
  }

  //CLIENTE: MESAS DISPONÍVEIS 

  async mesasDisponiveis(slug: string, query: MesasDisponiveisQuery) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug);

    const janela = montarJanela(
      query.data_reserva,
      query.hora_inicio,
      query.hora_fim,
    );

    if (janela.fim <= janela.inicio) {
      throw new AppError("Hora fim deve ser posterior à hora início", 400);
    }

    return this.repository.mesasDisponiveis(
      estabelecimento.id,
      janela.data,
      janela.inicio,
      janela.fim,
      query.pessoas,
    );
  }

  // CLIENTE: HORÁRIOS LIVRES DE CADA MESA NO DIA 
  // Devolve, por mesa, os trechos do dia que NÃO dá para reservar ("bloqueios" = reservas ativas já
  // alargadas pelo intervalo mínimo). O app calcula os horários livres a partir disso, e o servidor
  // confere de novo na hora de reservar.

  async disponibilidadeDoDia(slug: string, query: DisponibilidadeQuery) {
    const estabelecimento = await this.buscarEstabelecimentoPorSlug(slug);
    const data = new Date(`${query.data_reserva}T00:00:00.000Z`);

    const mesas = await this.repository.mesasComReservasDoDia(
      estabelecimento.id,
      data,
      query.pessoas,
    );

    return {
      funcionamento: funcionamentoNoDia(
        estabelecimento.horario_funcionamento,
        query.data_reserva,
      ),
      mesas: mesas.map(({ reservas, ...mesa }: any) => ({
        ...mesa,
        bloqueios: reservas.map((r: any) => {
          const j = comMargem(r.hora_inicio, r.hora_fim);
          return { inicio: dateParaHHMM(j.inicio), fim: dateParaHHMM(j.fim) };
        }),
      })),
    };
  }

  // BUSCAR POR ID 

  async findById(id: string, estabelecimento_id: string) {
    const reserva = await this.repository.findByIdCompleto(id);

    if (!reserva) {
      throw new AppError("Reserva não encontrada", 404);
    }

    if ((reserva as any).estabelecimento_id !== estabelecimento_id) {
      throw new AppError("Acesso não autorizado", 403);
    }

    return reserva;
  }

  //LISTAR 

  async listar(
    estabelecimento_id: string,
    filtros?: {
      status?: string;
      data_inicio?: Date;
      data_fim?: Date;
    },
  ) {
    return this.repository.findByEstabelecimento(estabelecimento_id, filtros);
  }

  // ATUALIZAR STATUS

  async atualizarStatus(
    id: string,
    data: AtualizarStatusReservaDTO,
    confirmada_por_id: string,
    estabelecimento_id: string,
  ) {
    const reserva = await this.findById(id, estabelecimento_id);
    const statusAtual = (reserva as any).status;

    if (statusAtual === "CONCLUIDA" || statusAtual === "CANCELADA") {
      throw new AppError(
        `Reserva já está ${statusAtual}. Não é possível alterar o status.`,
        400,
      );
    }

    if (data.status === "CONFIRMADA" && statusAtual !== "PENDENTE") {
      throw new AppError(
        "Apenas reservas PENDENTES podem ser confirmadas",
        400,
      );
    }

    const grupo_id: string | null = (reserva as any).grupo_id ?? null;
    const recado = data.mensagem?.trim() || undefined;

    const dados: Record<string, any> = {
      status: data.status,
      confirmada_por_id,
      ...(data.status === "CANCELADA" && {
        // PENDENTE cancelada pelo restaurante = recusa; CONFIRMADA = cancelamento
        cancelada_por: statusAtual === "PENDENTE" ? "RECUSADA" : "RESTAURANTE",
      }),
      ...(recado && { mensagem_restaurante: recado, mensagem_em: new Date() }),
    };

    let linhas: any[];
    if (grupo_id) {
      // Reserva em várias mesas: a decisão vale para todas as mesas de uma vez
      // (trocar mesa não se aplica: o restaurante cancela e orienta o cliente)
      linhas = await this.repository.updateGrupo(grupo_id, dados);
    } else if (data.status === "CONFIRMADA" && data.mesa_id) {
      // Troca/atribui a mesa ao confirmar: mesma regra da criação. Trava a mesa, confere o conflito
      // (ignorando a própria reserva) e grava na mesma transação, para duas trocas simultâneas
      // para a mesma mesa não passarem juntas.
      const mesa_id = data.mesa_id;

      const atualizada = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mesa_id}))`;

          // O id da mesa vem do navegador: precisa ser uma mesa ativa DESTE restaurante
          const mesa = await tx.mesa.findFirst({
            where: { id: mesa_id, estabelecimento_id, ativo: true },
            select: { status: true },
          });
          if (!mesa || mesa.status === "INATIVA") {
            throw new AppError("Mesa não encontrada neste restaurante", 404);
          }

          const conflito = await this.repository.verificarConflito(
            estabelecimento_id,
            mesa_id,
            new Date((reserva as any).data_reserva),
            (reserva as any).hora_inicio,
            (reserva as any).hora_fim,
            id,
            tx,
          );

          if (conflito) {
            throw new AppError(
              "Mesa indisponível neste horário. Escolha outra mesa.",
              409,
            );
          }

          return this.repository.update(id, { ...dados, mesa_id }, tx);
        },
      );
      linhas = [atualizada];
    } else {
      linhas = [await this.repository.update(id, dados)];
    }

    // Avisa o cliente da decisão (e-mail; o app mostra no topo da tela de reservas)
    if (data.status === "CONFIRMADA")
      this.notificarCliente("CONFIRMADA", linhas, recado);
    if (data.status === "CANCELADA") {
      this.notificarCliente(
        statusAtual === "PENDENTE" ? "RECUSADA" : "CANCELADA",
        linhas,
        recado,
      );
    }

    return { ...linhas[0], mesas_do_grupo: linhas };
  }

  // MENSAGEM DO RESTAURANTE PARA O CLIENTE 
  async enviarMensagem(
    id: string,
    data: MensagemReservaDTO,
    estabelecimento_id: string,
  ) {
    const reserva = await this.findById(id, estabelecimento_id);

    if (!(reserva as any).cliente_id) {
      throw new AppError(
        "Esta reserva não foi feita pelo app: não há cliente para receber a mensagem",
        400,
      );
    }

    const dados = {
      mensagem_restaurante: data.mensagem,
      mensagem_em: new Date(),
    };
    const linhas: any[] = (reserva as any).grupo_id
      ? await this.repository.updateGrupo((reserva as any).grupo_id, dados)
      : [await this.repository.update(id, dados)];

    this.notificarCliente("MENSAGEM", linhas, data.mensagem);

    return { ...linhas[0], mesas_do_grupo: linhas };
  }

  //CANCELAR

  async cancelar(id: string, estabelecimento_id: string) {
    const reserva = await this.findById(id, estabelecimento_id);

    if (["CONCLUIDA", "CANCELADA"].includes((reserva as any).status)) {
      throw new AppError(
        `Reserva já está ${(reserva as any).status}. Não é possível cancelar.`,
        400,
      );
    }

    const linhas = await this.linhasDaReserva(reserva);
    const statusAtual = (reserva as any).status;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.reserva.updateMany({
        where: { id: { in: linhas.map((l: any) => l.id) } },
        data: {
          status: "CANCELADA",
          cancelada_por:
            statusAtual === "PENDENTE" ? "RECUSADA" : "RESTAURANTE",
        },
      });

      // Libera as mesas se estavam marcadas como RESERVADA por esta reserva
      const mesaIds = linhas.map((l: any) => l.mesa_id).filter(Boolean);
      if (mesaIds.length) {
        await tx.mesa.updateMany({
          where: { id: { in: mesaIds }, status: "RESERVADA" },
          data: { status: "LIVRE" },
        });
      }
    });

    // Quem cancelou foi o restaurante: avisa o cliente
    this.notificarCliente(
      statusAtual === "PENDENTE" ? "RECUSADA" : "CANCELADA",
      linhas,
    );
  }
}
