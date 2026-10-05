export class AppError extends Error {
  public readonly message: string
  public readonly statusCode: number
  public readonly isOperational: boolean
  // Código opcional (ex.: 'EMAIL_NAO_VERIFICADO') para o front reconhecer o erro sem ler o texto
  public readonly code?: string

  constructor(
    message: string,
    statusCode: number = 400,
    isOperational: boolean = true,
    code?: string
  ) {
    super(message)

    this.message = message
    this.statusCode = statusCode

    this.isOperational = isOperational
    this.code = code

    this.name = 'AppError'

    Error.captureStackTrace(this, this.constructor)
  }
}