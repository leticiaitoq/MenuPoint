import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'

export interface CriarClienteInput {
  nome: string
  cpf: string
  telefone: string
  email: string
  senha_hash: string
}

export class ClienteRepository {

  // ── Consultas ──────────────────────────────────────────────────────────────
  findByEmail(email: string) {
    return prisma.cliente.findUnique({ where: { email } })
  }

  findByCpf(cpf: string) {
    return prisma.cliente.findUnique({ where: { cpf } })
  }

  findById(id: string) {
    return prisma.cliente.findUnique({ where: { id } })
  }

  // ── Cadastro ───────────────────────────────────────────────────────────────
  async criar(data: CriarClienteInput) {
    try {
      return await prisma.cliente.create({
        data: { ...data, email_verificado: false },
      })
    } catch (err) {
      // Duas requisições simultâneas passam pela checagem e batem no índice único
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const alvo = String(err.meta?.target ?? '')
        if (alvo.includes('cpf')) throw new AppError('Este CPF já está cadastrado', 409)
        throw new AppError('Este e-mail já está cadastrado', 409)
      }
      throw err
    }
  }

  atualizarPerfil(id: string, data: { nome: string; telefone: string }) {
    return prisma.cliente.update({ where: { id }, data })
  }

  /** Troca a senha e derruba os refresh tokens abertos (o service abre uma sessão nova em seguida). */
  async atualizarSenha(id: string, senha_hash: string): Promise<void> {
    await prisma.$transaction([
      prisma.cliente.update({ where: { id }, data: { senha_hash } }),
      prisma.refreshToken.updateMany({ where: { cliente_id: id, usado: false }, data: { usado: true } }),
    ])
  }

  async atualizarUltimoAcesso(id: string): Promise<void> {
    await prisma.cliente.update({ where: { id }, data: { ultimo_acesso: new Date() } })
  }

  // ── Códigos de 6 dígitos ───────────────────────────────────────────────────
  /** "042817". Só 1 milhão de combinações: o token é UNIQUE, então a colisão é tratada com retry. */
  private gerarCodigo6Digitos(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  }

  async criarTokenConfirmacaoEmail(cliente_id: string, expiracaoMinutos = 15): Promise<string> {
    // Limpa os códigos do cliente + os vencidos/usados de todos (libera combinações do UNIQUE)
    await prisma.tokenConfirmacaoEmailCliente.deleteMany({
      where: {
        OR: [{ cliente_id }, { usado: true }, { expira_em: { lt: new Date() } }],
      },
    })

    const expira_em = new Date(Date.now() + expiracaoMinutos * 60_000)

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = this.gerarCodigo6Digitos()
      try {
        await prisma.tokenConfirmacaoEmailCliente.create({
          data: { cliente_id, token: codigo, expira_em },
        })
        return codigo
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue
        throw err
      }
    }
    throw new AppError('Não foi possível gerar o código. Tente novamente.', 500)
  }

  findTokenConfirmacao(email: string, codigo: string) {
    return prisma.tokenConfirmacaoEmailCliente.findFirst({
      where: {
        token: codigo,
        usado: false,
        expira_em: { gt: new Date() },
        cliente: { email },
      },
      include: { cliente: true },
    })
  }

  async confirmarEmail(cliente_id: string, tokenId: string): Promise<void> {
    await prisma.$transaction([
      prisma.cliente.update({
        where: { id: cliente_id },
        data: { email_verificado: true, ultimo_acesso: new Date() },
      }),
      prisma.tokenConfirmacaoEmailCliente.update({ where: { id: tokenId }, data: { usado: true } }),
    ])
  }

  async criarTokenRecuperacao(cliente_id: string, expiracaoMinutos = 15): Promise<string> {
    await prisma.tokenRecuperacaoSenhaCliente.deleteMany({
      where: {
        OR: [{ cliente_id }, { usado: true }, { expira_em: { lt: new Date() } }],
      },
    })

    const expira_em = new Date(Date.now() + expiracaoMinutos * 60_000)

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = this.gerarCodigo6Digitos()
      try {
        await prisma.tokenRecuperacaoSenhaCliente.create({
          data: { cliente_id, token: codigo, expira_em },
        })
        return codigo
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue
        throw err
      }
    }
    throw new AppError('Não foi possível gerar o código. Tente novamente.', 500)
  }

  findTokenRecuperacao(email: string, codigo: string) {
    return prisma.tokenRecuperacaoSenhaCliente.findFirst({
      where: {
        token: codigo,
        usado: false,
        expira_em: { gt: new Date() },
        cliente: { email },
      },
      include: {
        cliente: { select: { id: true, nome: true, email: true, ativo: true } },
      },
    })
  }

  /** Troca a senha, consome o código e derruba as sessões abertas (refresh tokens). */
  async redefinirSenha(tokenId: string, cliente_id: string, nova_senha_hash: string): Promise<void> {
    await prisma.$transaction([
      prisma.tokenRecuperacaoSenhaCliente.update({ where: { id: tokenId }, data: { usado: true } }),
      prisma.cliente.update({ where: { id: cliente_id }, data: { senha_hash: nova_senha_hash } }),
      prisma.refreshToken.updateMany({ where: { cliente_id, usado: false }, data: { usado: true } }),
    ])
  }

  // ── Refresh tokens (coluna cliente_id) ─────────────────────────────────────
  async salvarRefreshToken(cliente_id: string, token: string, expira_em: Date): Promise<void> {
    await prisma.refreshToken.create({ data: { cliente_id, token, expira_em } })
  }

  /**
   * Consome o refresh token de forma atômica: só um pedido consegue marcar
   * "usado". Devolve false se já foi usado, venceu ou não é de cliente.
   */
  async consumirRefreshToken(token: string): Promise<boolean> {
    const r = await prisma.refreshToken.updateMany({
      where: {
        token,
        usado: false,
        cliente_id: { not: null },
        expira_em: { gt: new Date() },
      },
      data: { usado: true },
    })
    return r.count === 1
  }

  async revogarRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token, cliente_id: { not: null } },
      data: { usado: true },
    })
  }
}
