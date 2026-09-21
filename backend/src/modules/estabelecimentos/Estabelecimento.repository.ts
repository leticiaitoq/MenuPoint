import { Estabelecimento } from '@prisma/client'
import { BaseRepository } from '@shared/abstracts/BaseRepository'
import prisma from '@config/prisma'
import {
  CriarEstabelecimentoDTO,
  AtualizarEstabelecimentoDTO,
} from './Estabelecimento.schema'

export class EstabelecimentoRepository extends BaseRepository<
  Estabelecimento,
  CriarEstabelecimentoDTO,
  AtualizarEstabelecimentoDTO
> {
  protected modelName = 'estabelecimento' as const

  async findBySlug(slug: string): Promise<Estabelecimento | null> {
    return prisma.estabelecimento.findUnique({ where: { slug } })
  }

  async findByEmpresa(empresa_id: string): Promise<Estabelecimento[]> {
    return prisma.estabelecimento.findMany({
      where: { empresa_id, ativo: true },
      orderBy: { nome: 'asc' },
    })
  }

  async findByIdCompleto(id: string): Promise<Estabelecimento | null> {
    return prisma.estabelecimento.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            produtos: { where: { disponivel: true } },
            mesas: { where: { ativo: true } },
            usuarios: { where: { ativo: true } },
          },
        },
      },
    }) as any
  }

  async findBySlugPublico(slug: string): Promise<Estabelecimento | null> {
    return prisma.estabelecimento.findUnique({
      where: { slug, ativo: true },
      select: {
        id: true,
        nome: true,
        slug: true,
        logo_url: true,
        banner_url: true,
        tema: true,
        telefone: true,
        whatsapp: true,
        endereco: true,
        horario_funcionamento: true,
        taxa_entrega: true,
        pedido_minimo: true,
        tempo_entrega_min: true,
        tempo_entrega_max: true,
        aceita_entrega: true,
        aceita_retirada: true,
        aceita_mesa: true,
        chave_pix: false,
        cnpj: false,
        desconto_boas_vindas_usado: false,
      },
    }) as any
  }
}
