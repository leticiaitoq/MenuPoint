import { Empresa } from '@prisma/client'
import { BaseService } from '@shared/abstracts/BaseService'
import { AppError } from '@shared/errors/AppError'
import { EmpresaRepository } from './Empresa.repository'
import { CriarEmpresaDTO, AtualizarEmpresaDTO } from './Empresa.schema'

export class EmpresaService extends BaseService<
  Empresa,
  CriarEmpresaDTO,
  AtualizarEmpresaDTO
> {
  constructor(protected readonly repository: EmpresaRepository) {
    super(repository)
  }

  async create(data: CriarEmpresaDTO): Promise<Empresa> {
    if (data.cnpj) {
      const cnpjExistente = await this.repository.findByCnpj(data.cnpj)
      if (cnpjExistente) {
        throw new AppError('CNPJ já cadastrado', 409)
      }
    }

    return this.repository.create(data)
  }

  async listarTodas(): Promise<Empresa[]> {
    return this.repository.findAllAtivas()
  }

  async buscarComDetalhes(id: string) {
    const empresa = await this.repository.findByIdComEstabelecimentos(id)

    if (!empresa) {
      throw new AppError('Empresa não encontrada', 404)
    }

    return empresa
  }

  async update(id: string, data: AtualizarEmpresaDTO): Promise<Empresa> {
    await this.findById(id)

    if (data.cnpj) {
      const cnpjExistente = await this.repository.findByCnpj(data.cnpj)
      if (cnpjExistente && cnpjExistente.id !== id) {
        throw new AppError('CNPJ já cadastrado', 409)
      }
    }

    return this.repository.update(id, data)
  }

  async desativar(id: string): Promise<void> {
    const empresa = await this.findById(id)

    if (!(empresa as any).ativo) {
      throw new AppError('Empresa já está desativada', 400)
    }

    await this.repository.update(id, { ativo: false } as any)
  }

  async reativar(id: string): Promise<Empresa> {
    const empresa = await this.findById(id)

    if ((empresa as any).ativo) {
      throw new AppError('Empresa já está ativa', 400)
    }

    return this.repository.update(id, { ativo: true } as any)
  }
}
