import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'
import { agoraNoBrasil, dateParaHHMM, minutosDoDate, montarJanela } from './Reserva.horario'

/**
 * Chegada do cliente à mesa reservada.
 *
 * A reserva "segura" a mesa de ANTECEDENCIA_CHEGADA_MIN minutos antes do início até o fim.
 * Nesse período só quem é o dono da reserva (valida com o telefone da reserva ou estando logado
 * na conta que reservou) ocupa a mesa. Ao chegar, a reserva vira CONCLUIDA e a mesa OCUPADA:
 * o Caixa passa a ver a mesa ocupada pelo nome de quem reservou, mesmo sem nenhum pedido.
 */
export const ANTECEDENCIA_CHEGADA_MIN = 30

const soDigitos = (t: string) => t.replace(/\D/g, '')

/** "+55 (16) 99999-0000" e "16999990000" são o mesmo telefone */
export const mesmoTelefone = (a: string, b: string): boolean => {
  const norm = (t: string) => {
    const d = soDigitos(t)
    return d.length >= 12 && d.startsWith('55') ? d.slice(2) : d
  }
  const x = norm(a)
  const y = norm(b)
  return x.length >= 10 && x === y
}

/**
 * Reserva CONFIRMADA que está segurando a mesa AGORA (ou null).
 * Só vale reserva feita pelo cliente (tem cliente_id): a do Caixa não tem telefone para validar.
 * Devolve todas as linhas do grupo (reserva em várias mesas = uma linha por mesa).
 */
export async function reservaSegurandoMesa(mesa_id: string, estabelecimento_id: string) {
  const agora = agoraNoBrasil()
  const hoje = montarJanela(agora.data, '00:00', '00:01').data

  const candidatas = await prisma.reserva.findMany({
    where: {
      estabelecimento_id,
      mesa_id,
      status: 'CONFIRMADA',
      cliente_id: { not: null },
      data_reserva: hoje,
    },
    orderBy: { hora_inicio: 'asc' },
  })

  const base = candidatas.find(
    (r) =>
      minutosDoDate(r.hora_inicio) - ANTECEDENCIA_CHEGADA_MIN <= agora.minutos &&
      minutosDoDate(r.hora_fim) > agora.minutos
  )
  if (!base) return null

  const linhas = base.grupo_id
    ? await prisma.reserva.findMany({ where: { grupo_id: base.grupo_id, status: 'CONFIRMADA' } })
    : [base]

  return { base, linhas, hora_inicio: dateParaHHMM(base.hora_inicio) }
}

/** Reserva vira CONCLUIDA e as mesas dela passam a OCUPADA (tudo na mesma transação) */
export async function registrarChegada(linhas: { id: string; mesa_id: string | null }[]) {
  const mesaIds = linhas.map((l) => l.mesa_id).filter((id): id is string => !!id)

  await prisma.$transaction([
    prisma.reserva.updateMany({
      where: { id: { in: linhas.map((l) => l.id) }, status: { in: ['PENDENTE', 'CONFIRMADA'] } },
      data: { status: 'CONCLUIDA' },
    }),
    prisma.mesa.updateMany({
      where: { id: { in: mesaIds }, status: { not: 'INATIVA' } },
      data: { status: 'OCUPADA' },
    }),
  ])
}

/** Caixa clicou "Cliente chegou": ocupa a(s) mesa(s) em nome de quem reservou */
export async function chegadaPeloCaixa(id: string, estabelecimento_id: string) {
  const reserva = await prisma.reserva.findFirst({ where: { id, estabelecimento_id } })
  if (!reserva) throw new AppError('Reserva não encontrada', 404)
  if (reserva.status === 'CONCLUIDA' || reserva.status === 'CANCELADA') {
    throw new AppError(`Reserva já está ${reserva.status}.`, 400)
  }

  const linhas = reserva.grupo_id
    ? await prisma.reserva.findMany({ where: { grupo_id: reserva.grupo_id, estabelecimento_id } })
    : [reserva]

  await registrarChegada(linhas)
  return { ok: true, mesas: linhas.map((l) => l.mesa_id).filter(Boolean) }
}

/**
 * O próprio cliente confirma que chegou (QR Code da mesa).
 * Valida o dono da reserva: conta logada que reservou OU telefone igual ao da reserva.
 */
export async function chegadaPeloCliente(
  mesa: { id: string; estabelecimento_id: string },
  telefone: string | undefined,
  cliente_id: string | undefined
) {
  const segurando = await reservaSegurandoMesa(mesa.id, mesa.estabelecimento_id)
  if (!segurando) throw new AppError('Esta mesa não tem reserva para este horário.', 404)

  const { base, linhas } = segurando
  const donoLogado = !!cliente_id && base.cliente_id === cliente_id
  const donoPeloTelefone = !!telefone && mesmoTelefone(telefone, base.cliente_telefone)

  if (!donoLogado && !donoPeloTelefone) {
    throw new AppError('Não encontramos uma reserva com esse telefone para esta mesa.', 403)
  }

  await registrarChegada(linhas)
  return { ok: true, nome: base.cliente_nome }
}
