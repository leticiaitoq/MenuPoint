import { Prisma, Plano } from '@prisma/client'
import prisma from '@config/prisma'
import crypto from 'crypto'
import { AppError } from '@shared/errors/AppError'
import { gerarSlug } from '@shared/utils/slug'

export type EnderecoEstabelecimento = {
  rua: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

export interface RegistrarInput {
  // restaurante
  nome_empresa: string
  razao_social: string
  cnpj: string
  endereco: EnderecoEstabelecimento
  // responsável
  nome_responsavel: string
  cpf: string
  email: string
  senha_hash: string
  token_pagamento?: string
}

export class AuthRepository {

  async findByEmail(email: string): Promise<
    Prisma.UsuarioGetPayload<{
      include: {
        estabelecimento: {
          select: {
            id: true
            nome: true
            ativo: true
            slug: true
          }
        }
        empresa: {
          select: {
            id: true
            nome: true
            ativo: true
            plano: true
          }
        }
      }
    }> | null
  > {

    return prisma.usuario.findUnique({
      where: { email },
      include: {
        estabelecimento: {
          select: {
            id: true,
            nome: true,
            ativo: true,
            slug: true,
          },
        },
        empresa: {
          select: {
            id: true,
            nome: true,
            ativo: true,
            plano: true,
          },
        },
      },
    })
  }

  // ── PERFIL DO USUÁRIO LOGADO ──────────────────────────────────────────────
  // Usuário + empresa + estabelecimento lidos do BANCO (não do token).
  // É o que a tela de perfil exibe logo após o login.
  async findPerfilPorId(id: string) {
    return prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        perfil: true,
        escopo: true,
        ativo: true,
        email_verificado: true,
        ultimo_acesso: true,
        criado_em: true,
        empresa_id: true,
        estabelecimento_id: true,
        empresa: {
          select: {
            id: true,
            nome: true,
            razao_social: true,
            cnpj: true,
            plano: true,
            ativo: true,
            criado_em: true,
          },
        },
        estabelecimento: true,
      },
    })
  }

  // ── CNPJ já usado? (empresa ou estabelecimento) ───────────────────────────
  async cnpjEmUso(cnpj: string): Promise<boolean> {
    const [empresa, estabelecimento] = await Promise.all([
      prisma.empresa.findUnique({ where: { cnpj }, select: { id: true } }),
      prisma.estabelecimento.findUnique({ where: { cnpj }, select: { id: true } }),
    ])
    return Boolean(empresa || estabelecimento)
  }

  // ── Slug único para a URL do cardápio ─────────────────────────────────────
  // "sabor-da-vila", "sabor-da-vila-2", "sabor-da-vila-3"...
  private async gerarSlugUnico(
    tx: Prisma.TransactionClient,
    nome: string,
    forcarSufixoAleatorio: boolean
  ): Promise<string> {
    const base = gerarSlug(nome)

    if (forcarSufixoAleatorio) {
      return `${base}-${crypto.randomBytes(3).toString('hex')}`
    }

    let candidato = base
    for (let n = 2; n <= 50; n++) {
      const existe = await tx.estabelecimento.findUnique({
        where: { slug: candidato },
        select: { id: true },
      })
      if (!existe) return candidato
      candidato = `${base}-${n}`
    }
    return `${base}-${crypto.randomBytes(3).toString('hex')}`
  }

  // ── REGISTRO: Empresa + Estabelecimento + Usuário (tudo ou nada) ───────────
  async registrar(data: RegistrarInput) {
    // Se dois cadastros com o mesmo nome acontecerem no mesmo instante, o slug pode
    // colidir mesmo depois da checagem: nesse caso tentamos de novo com sufixo aleatório.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        return await this.registrarEmTransacao(data, tentativa > 0)
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const alvo = String(err.meta?.target ?? '')
          if (alvo.includes('slug')) continue
          if (alvo.includes('cnpj')) throw new AppError('Este CNPJ já está cadastrado', 409)
          if (alvo.includes('email')) throw new AppError('Este e-mail já está cadastrado', 409)
        }
        throw err
      }
    }
    throw new AppError('Não foi possível concluir o cadastro. Tente novamente.', 500)
  }

  private async registrarEmTransacao(data: RegistrarInput, forcarSufixoAleatorio: boolean) {
    return prisma.$transaction(async (tx) => {
      let plano: Plano = Plano.STARTER
      let assinaturaId: string | undefined

      if (data.token_pagamento) {
        const assinatura = await tx.assinatura.findUnique({
          where: { token_registro: data.token_pagamento },
        })

        if (!assinatura) {
          throw new AppError('Token de pagamento inválido ou inexistente', 400)
        }

        if (assinatura.status !== 'ATIVA') {
          throw new AppError(
            'Pagamento do plano não confirmado. Verifique seu e-mail ou finalize o pagamento.',
            402
          )
        }

        if (assinatura.expira_em && assinatura.expira_em < new Date()) {
          throw new AppError('Token de pagamento expirado. Renove sua assinatura.', 402)
        }

        plano = assinatura.plano as Plano
        assinaturaId = assinatura.id
      }

      // 1) Empresa (pessoa jurídica: nome fantasia, razão social e CNPJ)
      const empresa = await tx.empresa.create({
        data: {
          nome: data.nome_empresa,
          razao_social: data.razao_social,
          cnpj: data.cnpj,
          plano,
        },
      })

      if (assinaturaId) {
        await tx.assinatura.update({
          where: { id: assinaturaId },
          data: { empresa_id: empresa.id },
        })
      }

      // 2) Estabelecimento — criado SEMPRE junto com a empresa.
      //    Telefone, WhatsApp, horários etc. ficam para o "completar perfil".
      const slug = await this.gerarSlugUnico(tx, data.nome_empresa, forcarSufixoAleatorio)

      const estabelecimento = await tx.estabelecimento.create({
        data: {
          empresa_id: empresa.id,
          nome: data.nome_empresa,
          slug,
          cnpj: data.cnpj,
          endereco: data.endereco, // mesmo formato do enderecoSchema de Estabelecimento
          perfil_completo: false,
        },
      })

      // 3) Usuário dono — já vinculado à empresa E ao estabelecimento.
      //    Escopo LOCAL: ele administra o próprio estabelecimento, sem acesso
      //    às rotas de plataforma (listar todas as empresas etc.).
      const usuario = await tx.usuario.create({
        data: {
          empresa_id: empresa.id,
          estabelecimento_id: estabelecimento.id,
          nome: data.nome_responsavel,
          cpf: data.cpf,
          email: data.email,
          senha_hash: data.senha_hash,
          perfil: 'ADMIN',
          escopo: 'LOCAL',
        },
      })

      return { empresa, estabelecimento, usuario }
    })
  }

  // ── ALTERAR DADOS SENSÍVEIS: usuário + empresa numa transação ──────────────
  async atualizarDadosSensiveis(
    usuario_id: string,
    empresa_id: string | null,
    d: {
      nome_responsavel?: string
      email?: string
      razao_social?: string
      nome_empresa?: string
    }
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const dadosUsuario: Prisma.UsuarioUncheckedUpdateInput = {}
        if (d.nome_responsavel !== undefined) dadosUsuario.nome = d.nome_responsavel
        if (d.email !== undefined) {
          dadosUsuario.email = d.email
          // e-mail novo precisa ser confirmado de novo
          dadosUsuario.email_verificado = false
        }

        const usuario = await tx.usuario.update({
          where: { id: usuario_id },
          data: dadosUsuario,
        })

        if (empresa_id && (d.razao_social !== undefined || d.nome_empresa !== undefined)) {
          await tx.empresa.update({
            where: { id: empresa_id },
            data: {
              ...(d.razao_social !== undefined ? { razao_social: d.razao_social } : {}),
              ...(d.nome_empresa !== undefined ? { nome: d.nome_empresa } : {}),
            },
          })
        }

        // O nome do restaurante é o da empresa: o estabelecimento acompanha, na mesma
        // transação (se uma das duas gravações falhar, nenhuma vale).
        // O slug NÃO muda de propósito: o link /r/:slug já divulgado continua funcionando.
        if (empresa_id && d.nome_empresa !== undefined) {
          let estabelecimentoId = usuario.estabelecimento_id

          // Usuário sem estabelecimento próprio: só atualiza se a empresa tiver um único
          if (!estabelecimentoId) {
            const lista = await tx.estabelecimento.findMany({
              where: { empresa_id },
              select: { id: true },
              take: 2,
            })
            if (lista.length === 1) estabelecimentoId = lista[0].id
          }

          if (estabelecimentoId) {
            await tx.estabelecimento.update({
              where: { id: estabelecimentoId },
              data: { nome: d.nome_empresa },
            })
          }
        }

        return usuario
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError('Este e-mail já está cadastrado', 409)
      }
      throw err
    }
  }

  async atualizarUltimoAcesso(id: string): Promise<void> {
    await prisma.usuario.update({
      where: { id },
      data: { ultimo_acesso: new Date() },
    })
  }

  /** Gera um código numérico de 6 dígitos (ex: "042817") */
  private gerarCodigo6Digitos(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  }

  async criarTokenConfirmacaoEmail(
    usuario_id: string,
    expiracaoMinutos: number = 15
  ): Promise<string> {

    await prisma.tokenConfirmacaoEmail.updateMany({
      where: {
        usuario_id,
        usado: false,
      },
      data: { usado: true },
    })

    const expira_em = new Date()
    expira_em.setMinutes(expira_em.getMinutes() + expiracaoMinutos)

    // Códigos de 6 dígitos podem colidir entre usuários diferentes
    // (só 1 milhão de combinações) — tenta algumas vezes em caso de conflito.
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = this.gerarCodigo6Digitos()
      try {
        await prisma.tokenConfirmacaoEmail.create({
          data: { usuario_id, token: codigo, expira_em },
        })
        return codigo
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          continue
        }
        throw err
      }
    }
    throw new AppError('Não foi possível gerar o código. Tente novamente.', 500)
  }

  async findTokenConfirmacaoPorCodigo(email: string, codigo: string) {
    return prisma.tokenConfirmacaoEmail.findFirst({
      where: {
        token: codigo,
        usado: false,
        expira_em: { gt: new Date() },
        usuario: { email },
      },
      include: { usuario: true },
    })
  }

  async findTokenConfirmacaoValido(token: string) {
    return prisma.tokenConfirmacaoEmail.findFirst({
      where: {
        token,
        usado: false,
        expira_em: { gt: new Date() },
      },
      include: { usuario: true },
    })
  }

  async confirmarEmailUsuario(usuario_id: string, tokenId: string): Promise<void> {
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: usuario_id },
        data: { email_verificado: true },
      }),
      prisma.tokenConfirmacaoEmail.update({
        where: { id: tokenId },
        data: { usado: true },
      }),
    ])
  }

  async criarTokenRecuperacao(
    usuario_id: string,
    expiracaoMinutos: number = 15
  ): Promise<string> {

    await prisma.tokenRecuperacaoSenha.updateMany({
      where: {
        usuario_id,
        usado: false,
      },
      data: { usado: true },
    })

    const expira_em = new Date()
    expira_em.setMinutes(expira_em.getMinutes() + expiracaoMinutos)

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = this.gerarCodigo6Digitos()
      try {
        await prisma.tokenRecuperacaoSenha.create({
          data: { usuario_id, token: codigo, expira_em },
        })
        return codigo
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          continue
        }
        throw err
      }
    }
    throw new AppError('Não foi possível gerar o código. Tente novamente.', 500)
  }

  async findTokenRecuperacaoPorCodigo(email: string, codigo: string) {
    return prisma.tokenRecuperacaoSenha.findFirst({
      where: {
        token: codigo,
        usado: false,
        expira_em: { gt: new Date() },
        usuario: { email },
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, ativo: true },
        },
      },
    })
  }

  async findTokenValido(token: string) {
    return prisma.tokenRecuperacaoSenha.findFirst({
      where: {
        token,
        usado: false,
        expira_em: { gt: new Date() },
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            ativo: true,
          },
        },
      },
    })
  }

  async redefinirSenha(
    token_id: string,
    usuario_id: string,
    nova_senha_hash: string
  ): Promise<void> {
    await prisma.$transaction([
      // Marca o token como usado
      prisma.tokenRecuperacaoSenha.update({
        where: { id: token_id },
        data: { usado: true },
      }),
      // Atualiza a senha do usuário
      prisma.usuario.update({
        where: { id: usuario_id },
        data: { senha_hash: nova_senha_hash },
      }),
    ])
  }
}