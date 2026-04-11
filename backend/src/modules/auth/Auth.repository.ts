import { Prisma } from '@prisma/client'
import prisma from '@config/prisma'
import crypto from 'crypto'

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

  async registrar(data: {
    nome_empresa: string
    cnpj?: string
    email: string
    senha_hash: string
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Cria a empresa
      const empresa = await tx.empresa.create({
        data: {
          nome: data.nome_empresa,
          cnpj: data.cnpj,
          plano: 'STARTER',
        },
      })

      // 2. Cria o usuário ADMIN vinculado à empresa (escopo GLOBAL — sem estabelecimento ainda)
      const usuario = await tx.usuario.create({
        data: {
          empresa_id: empresa.id,
          nome: data.nome_empresa,
          email: data.email,
          senha_hash: data.senha_hash,
          perfil: 'ADMIN',
          escopo: 'GLOBAL',
        },
      })

      return { empresa, usuario }
    })
  }

  async atualizarUltimoAcesso(id: string): Promise<void> {
    await prisma.usuario.update({
      where: { id },
      data: { ultimo_acesso: new Date() },
    })
  }

  async criarTokenRecuperacao(
    usuario_id: string,
    expiracaoHoras: number = 2
  ): Promise<string> {

    await prisma.tokenRecuperacaoSenha.updateMany({
      where: {
        usuario_id,
        usado: false,
      },
      data: { usado: true },
    })

    const token = crypto.randomBytes(32).toString('hex')

    const expira_em = new Date()
    expira_em.setHours(expira_em.getHours() + expiracaoHoras)

    await prisma.tokenRecuperacaoSenha.create({
      data: {
        usuario_id,
        token,
        expira_em,
      },
    })

    return token
  }

  async findTokenValido(token: string) {
    return prisma.tokenRecuperacaoSenha.findFirst({
      where: {
        token,
        usado: false,
        expira_em: { gt: new Date() },
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            ativo: true,
          },
        },
      },
    })
  }

  async redefinirSenha(
    token_id: string,
    usuario_id: string,
    nova_senha_hash: string
  ): Promise<void> {
    await prisma.$transaction([
      // Marca o token como usado
      prisma.tokenRecuperacaoSenha.update({
        where: { id: token_id },
        data: { usado: true },
      }),
      // Atualiza a senha do usuário
      prisma.usuario.update({
        where: { id: usuario_id },
        data: { senha_hash: nova_senha_hash },
      }),
    ])
  }
}
