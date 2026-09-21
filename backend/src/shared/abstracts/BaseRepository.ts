import { PrismaClient } from '@prisma/client'
import prisma from '@config/prisma'
import { IRepository } from '@shared/interfaces/IRepository'

export abstract class BaseRepository<T, C, U>
  implements IRepository<T, C, U> {

  protected abstract modelName: keyof PrismaClient

  protected prisma = prisma

  protected get model(): any {
    return (this.prisma as any)[this.modelName]
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } })
  }

  async findAll(filters?: Record<string, any>): Promise<T[]> {
  return this.model.findMany({
    where: filters ?? undefined
  })
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