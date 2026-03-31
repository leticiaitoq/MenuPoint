// Classe abstrata que implementa operações comuns a todos os Repositories
// Os Repositories específicos herdam essa classe e ganham os métodos prontos
// Só precisam implementar o que for específico de cada entidade

import { PrismaClient } from '@prisma/client'
import prisma from '@config/prisma'
import { IRepository } from '@shared/interfaces/IRepository'

// abstract class não pode ser instanciada diretamente
// só pode ser usada como base para outras classes
export abstract class BaseRepository<T, C, U>
  implements IRepository<T, C, U> {

  // O nome do model no Prisma (ex: 'produto', 'pedido')
  // Cada subclasse define o seu
  protected abstract modelName: keyof PrismaClient

  // A instância do Prisma é compartilhada
  protected prisma = prisma

  // Retorna o model do Prisma dinamicamente baseado no modelName
  // Isso permite que a classe base execute queries sem saber qual model é
  protected get model(): any {
    return (this.prisma as any)[this.modelName]
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } })
  }

  async findAll(filters?: Record<string, any>): Promise<T[]> {
    return this.model.findMany({ where: filters })
  }

  async create(data: C): Promise<T> {
    return this.model.create({ data })
  }

  async update(id: string, data: U): Promise<T> {
    return this.model.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    await this.model.delete({ where: { id } })
  }
}