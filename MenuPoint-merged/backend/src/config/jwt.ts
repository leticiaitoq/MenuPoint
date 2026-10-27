import { env } from './env'

export const jwtConfig = {
  secret: env.JWT_SECRET,
  sign: {
    expiresIn: env.JWT_EXPIRES_IN,
  },
  verify: {},  
}