import { Estabelecimento } from '@prisma/client'
import { BaseService } from '@shared/abstracts/BaseService'
import { AppError } from '@shared/errors/AppError'
import { EstabelecimentoRepository } from './Estabelecimento.repository'
import {
  CriarEstabelecimentoDTO,
  AtualizarEstabelecimentoDTO,
} from './Estabelecimento.schema'

export class EstabelecimentoService extends BaseService <
  Estabelecimento,
  CriarEstabelecimentoDTO,
  AtualizarEstabelecimentoDTO
> {
  constructor(
    protected readonly repository: EstabelecimentoRepository
  ) {
    super(repository)
  }

  async create(data: CriarEstabelecimentoDTO): Promise<Estabelecimento> {

    const slugExistente = await this.repository.findBySlug(data.slug)
    if (slugExistente) {
      throw new AppError(
        'Este slug já está em uso. Escolha outro nome para a URL do cardápio',
        409
      )
    }

    return this.repository.create(data)
  }

  async findByIdCompleto(id: string) {
    const estabelecimento = await this.repository.findByIdCompleto(id)

    if (!estabelecimento) {
      throw new AppError('Estabelecimento não encontrado', 404)
    }

    return estabelecimento
  }

  async findBySlugPublico(slug: string) {
    const estabelecimento = await this.repository.findBySlugPublico(slug)

    if (!estabelecimento) {
      throw new AppError('Cardápio não encontrado', 404)
    }

    return estabelecimento
  }

  async listarPorEmpresa(empresa_id: string) {
    return this.repository.findByEmpresa(empresa_id)
  }

  async update(
    id: string,
    data: AtualizarEstabelecimentoDTO
  ): Promise<Estabelecimento> {

    await this.findById(id)

    return this.repository.update(id, data)
  }
  
  async desativar(id: string): Promise<void> {
    await this.findById(id)
    await this.repository.update(id, { ativo: false } as any)
  }

  async reativar(id: string): Promise<Estabelecimento> {
    const estabelecimento = await this.findById(id)

    if ((estabelecimento as any).ativo) {
      throw new AppError('Estabelecimento já está ativo', 400)
    }

    return this.repository.update(id, { ativo: true } as any)
  }
}