// Interface base para os Services
// Define que todo Service trabalha com DTOs (Data Transfer Objects)
// DTOs são objetos simples que carregam dados entre camadas

export interface IService<T, C, U> {
  findById(id: string): Promise<T>
  findAll(filters?: Record<string, any>): Promise<T[]>
  create(data: C): Promise<T>
  update(id: string, data: U): Promise<T>
  remove(id: string): Promise<void>
}