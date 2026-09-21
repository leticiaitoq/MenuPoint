export interface IRepository<T, C, U> {
  findById(id: string): Promise<T | null>
  findAll(filters?: Record<string, any>): Promise<T[]>
  create(data: C): Promise<T>
  update(id: string, data: U): Promise<T>
  delete(id: string): Promise<void>
}