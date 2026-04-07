import { Mesa, StatusMesa } from '@prisma/client'
import prisma from '@config/prisma'
import { CriarMesaDTO, AtualizarMesaDTO } from './Mesa.schema'

type AtualizarMesaData = {
  numero?: number
  capacidade?: number
  localizacao?: string
  ativo?: boolean
  status?: StatusMesa        
  qr_code_url?: string
}

export class MesaRepository {

  async findById(id: string): Promise<Mesa | null> {
    return prisma.mesa.findUnique({ where: { id } })
  }

  async findByNumero(
    numero: number,
    estabelecimento_id: string
  ): Promise<Mesa | null> {
    return prisma.mesa.findFirst({
      where: { numero, estabelecimento_id },
    })
  }


  async findByToken(qr_code_token: string): Promise<Mesa | null> {
    return prisma.mesa.findUnique({
      where: { qr_code_token },
      include: {
        estabelecimento: {
          select: {
            id: true,
            nome: true,
            slug: true,
            logo_url: true,
            tema: true,
            aceita_mesa: true,
          },
        },
      },
    })
  }

  async findByEstabelecimento(
    estabelecimento_id: string,
    apenasAtivas = true
  ): Promise<Mesa[]> {
    return prisma.mesa.findMany({
      where: {
        estabelecimento_id,
        ...(apenasAtivas && { ativo: true }),
      },
      orderBy: { numero: 'asc' },
    })
  }


  async create(
    data: CriarMesaDTO & {
      estabelecimento_id: string
      qr_code_token: string
      qr_code_url: string
    }
  ): Promise<Mesa> {
    return prisma.mesa.create({ data })
  }

async update(id: string, data: AtualizarMesaData): Promise<Mesa> {
  return prisma.mesa.update({
    where: { id },
    data,
  })
}
    async updateStatus(
    id: string,
    status: StatusMesa
    ): Promise<Mesa> {
    return prisma.mesa.update({
        where: { id },
        data: { status },
    })
    }

  async resumoOcupacao(estabelecimento_id: string) {
    const resultado = await prisma.mesa.groupBy({
      by: ['status'],
      where: { estabelecimento_id, ativo: true },
      _count: { status: true },
    })

    const resumo = {
      total: 0,
      livre: 0,
      ocupada: 0,
      reservada: 0,
      inativa: 0,
    }

    resultado.forEach((item) => {
      const status = item.status.toLowerCase() as keyof typeof resumo
      resumo[status] = item._count.status
      resumo.total += item._count.status
    })

    return resumo
  }
}