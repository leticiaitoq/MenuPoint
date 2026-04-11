export class AppError extends Error {
  public readonly message: string
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(
    message: string,
    statusCode: number = 400,
    isOperational: boolean = true
  ) {
    super(message)

    this.message = message
    this.statusCode = statusCode

    this.isOperational = isOperational

    this.name = 'AppError'

    Error.captureStackTrace(this, this.constructor)
  }
}