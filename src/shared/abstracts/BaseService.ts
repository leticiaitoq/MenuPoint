// Classe abstrata que implementa operações comuns a todos os Services
// Lida com a lógica de "não encontrado" de forma centralizada

import { AppError } from '@shared/errors/AppError'
import { IRepository } from '@shared/interfaces/IRepository'
import { IService } from '@shared/interfaces/IService'

export abstract class BaseService<T, C, U>
  implements IService<T, C, U> {

  // O Repository é injetado pelo construtor — isso é injeção de dependência
  // O Service não cria o Repository, ele recebe pronto
  constructor(
    protected repository: IRepository<T, C, U>
  ) {}

  async findById(id: string): Promise<T> {
    const entity = await this.repository.findById(id)

    // Se não encontrar, lança erro — o Service nunca retorna null
    if (!entity) {
      throw new AppError('Registro não encontrado', 404)
    }

    return entity
  }

  async findAll(filters?: Record<string, any>): Promise<T[]> {
    return this.repository.findAll(filters)
  }
  

  // async create(data: C): Promise<T> {
  //   return this.repository.create(data)
  // }

   async create(data: C, context?: Record<string, any>): Promise<T> {
    return this.repository.create(data)
  }

  async update(id: string, data: U): Promise<T> {
    // Verifica se existe antes de atualizar
    await this.findById(id)
    return this.repository.update(id, data)
  }

  async remove(id: string): Promise<void> {
    // Verifica se existe antes de deletar
    await this.findById(id)
    return this.repository.delete(id)
  }
}