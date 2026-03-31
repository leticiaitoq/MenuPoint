// Centraliza as configurações do JWT
// Assim se precisar mudar algo, muda em um lugar só

import { env } from './env'

export const jwtConfig = {
  secret: env.JWT_SECRET,
  sign: {
    expiresIn: env.JWT_EXPIRES_IN,
  },
  verify: {},  
}