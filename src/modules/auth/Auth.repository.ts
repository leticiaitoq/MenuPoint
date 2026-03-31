import { Prisma } from '@prisma/client'
import prisma from '@config/prisma'

export class AuthRepository {

  async findByEmail(email: string): Promise<
    Prisma.UsuarioGetPayload<{
      include: {
        estabelecimento: {
          select: {
            id: true
            nome: true
            ativo: true
            slug: true
          }
        }
        empresa: {
          select: {
            id: true
            nome: true
            ativo: true
            plano: true
          }
        }
      }
    }> | null
  > {

    return prisma.usuario.findUnique({
      where: { email },
      include: {
        estabelecimento: {
          select: {
            id: true,
            nome: true,
            ativo: true,
            slug: true,
          },
        },
        empresa: {
          select: {
            id: true,
            nome: true,
            ativo: true,
            plano: true,
          },
        },
      },
    })
  }

  async atualizarUltimoAcesso(id: string): Promise<void> {
    await prisma.usuario.update({
      where: { id },
      data: { ultimo_acesso: new Date() },
    })
  }
}