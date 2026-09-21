import { Empresa } from '@prisma/client'
import { BaseRepository } from '@shared/abstracts/BaseRepository'
import prisma from '@config/prisma'
import { CriarEmpresaDTO, AtualizarEmpresaDTO } from './Empresa.schema'

export class EmpresaRepository extends BaseRepository<
  Empresa,
  CriarEmpresaDTO,
  AtualizarEmpresaDTO
> {
  protected modelName = 'empresa' as any

  async findByCnpj(cnpj: string): Promise<Empresa | null> {
    return prisma.empresa.findUnique({ where: { cnpj } })
  }

  async findAllAtivas(): Promise<Empresa[]> {
    return prisma.empresa.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    })
  }

  async findByIdComEstabelecimentos(id: string) {
    return prisma.empresa.findUnique({
      where: { id },
      include: {
        estabelecimentos: {
          where: { ativo: true },
          orderBy: { nome: 'asc' },
          select: {
            id: true,
            nome: true,
            slug: true,
            telefone: true,
            ativo: true,
            criado_em: true,
          },
        },
        _count: {
          select: {
            estabelecimentos: true,
            usuarios: true,
          },
        },
      },
    })
  }
}
