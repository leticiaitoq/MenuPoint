// Classe de erro personalizada usada em toda a aplicação
// Herda de Error para poder ser usada com throw
// Carrega o statusCode HTTP junto com a mensagem

export class AppError extends Error {
  public readonly message: string
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(
    message: string,
    statusCode: number = 400,
    isOperational: boolean = true
  ) {
    // Chama o constructor da classe Error pai
    // Necessário para que instanceof e stack trace funcionem
    super(message)

    this.message = message
    this.statusCode = statusCode

    // isOperational = true significa que é um erro esperado (validação, não encontrado)
    // isOperational = false seria um erro inesperado de sistema
    this.isOperational = isOperational

    // Garante que o nome da classe aparece corretamente no stack trace
    this.name = 'AppError'

    // Captura o stack trace excluindo o constructor do AppError
    // Para o stack trace começar de onde o erro foi lançado, não aqui
    Error.captureStackTrace(this, this.constructor)
  }
}