// Interface que define o contrato de todo Repository do sistema
// Todo Repository deve implementar esses métodos
// Isso garante consistência entre todos os módulos

// O T é um Generic — representa o tipo da entidade (Produto, Pedido, etc)
// O C é o tipo dos dados de criação (Create)
// O U é o tipo dos dados de atualização (Update)

export interface IRepository<T, C, U> {
  findById(id: string): Promise<T | null>
  findAll(filters?: Record<string, any>): Promise<T[]>
  create(data: C): Promise<T>
  update(id: string, data: U): Promise<T>
  delete(id: string): Promise<void>
}