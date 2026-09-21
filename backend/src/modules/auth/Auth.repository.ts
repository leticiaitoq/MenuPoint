import { Prisma, Plano } from '@prisma/client'
import prisma from '@config/prisma'
import crypto from 'crypto'
import { AppError } from '@shared/errors/AppError'

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
    token_pagamento?: string
  }) {
    return prisma.$transaction(async (tx) => {
      let plano: Plano = Plano.STARTER
      let assinaturaId: string | undefined

      if (data.token_pagamento) {
        const assinatura = await tx.assinatura.findUnique({
          where: { token_registro: data.token_pagamento },
        })

        if (!assinatura) {
          throw new AppError('Token de pagamento inválido ou inexistente', 400)
        }

        if (assinatura.status !== 'ATIVA') {
          throw new AppError(
            'Pagamento do plano não confirmado. Verifique seu e-mail ou finalize o pagamento.',
            402
          )
        }

        if (assinatura.expira_em && assinatura.expira_em < new Date()) {
          throw new AppError('Token de pagamento expirado. Renove sua assinatura.', 402)
        }

        plano = assinatura.plano as Plano
        assinaturaId = assinatura.id
      }

      const empresa = await tx.empresa.create({
        data: {
          nome: data.nome_empresa,
          cnpj: data.cnpj,
          plano,
        },
      })

      if (assinaturaId) {
        await tx.assinatura.update({
          where: { id: assinaturaId },
          data: { empresa_id: empresa.id },
        })
      }

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

  /** Gera um código numérico de 6 dígitos (ex: "042817") */
  private gerarCodigo6Digitos(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  }

  async criarTokenConfirmacaoEmail(
    usuario_id: string,
    expiracaoMinutos: number = 15
  ): Promise<string> {

    await prisma.tokenConfirmacaoEmail.updateMany({
      where: {
        usuario_id,
        usado: false,
      },
      data: { usado: true },
    })

    const expira_em = new Date()
    expira_em.setMinutes(expira_em.getMinutes() + expiracaoMinutos)

    // Códigos de 6 dígitos podem colidir entre usuários diferentes
    // (só 1 milhão de combinações) — tenta algumas vezes em caso de conflito.
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = this.gerarCodigo6Digitos()
      try {
        await prisma.tokenConfirmacaoEmail.create({
          data: { usuario_id, token: codigo, expira_em },
        })
        return codigo
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          continue
        }
        throw err
      }
    }
    throw new AppError('Não foi possível gerar o código. Tente novamente.', 500)
  }

  async findTokenConfirmacaoPorCodigo(email: string, codigo: string) {
    return prisma.tokenConfirmacaoEmail.findFirst({
      where: {
        token: codigo,
        usado: false,
        expira_em: { gt: new Date() },
        usuario: { email },
      },
      include: { usuario: true },
    })
  }

  async findTokenConfirmacaoValido(token: string) {
    return prisma.tokenConfirmacaoEmail.findFirst({
      where: {
        token,
        usado: false,
        expira_em: { gt: new Date() },
      },
      include: { usuario: true },
    })
  }

  async confirmarEmailUsuario(usuario_id: string, tokenId: string): Promise<void> {
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: usuario_id },
        data: { email_verificado: true },
      }),
      prisma.tokenConfirmacaoEmail.update({
        where: { id: tokenId },
        data: { usado: true },
      }),
    ])
  }

  async criarTokenRecuperacao(
    usuario_id: string,
    expiracaoMinutos: number = 15
  ): Promise<string> {

    await prisma.tokenRecuperacaoSenha.updateMany({
      where: {
        usuario_id,
        usado: false,
      },
      data: { usado: true },
    })

    const expira_em = new Date()
    expira_em.setMinutes(expira_em.getMinutes() + expiracaoMinutos)

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = this.gerarCodigo6Digitos()
      try {
        await prisma.tokenRecuperacaoSenha.create({
          data: { usuario_id, token: codigo, expira_em },
        })
        return codigo
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          continue
        }
        throw err
      }
    }
    throw new AppError('Não foi possível gerar o código. Tente novamente.', 500)
  }

  async findTokenRecuperacaoPorCodigo(email: string, codigo: string) {
    return prisma.tokenRecuperacaoSenha.findFirst({
      where: {
        token: codigo,
        usado: false,
        expira_em: { gt: new Date() },
        usuario: { email },
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, ativo: true },
        },
      },
    })
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