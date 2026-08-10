import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AuthRepository } from './Auth.repository'
import { AppError } from '@shared/errors/AppError'
import { transporter } from '@config/mailer'
import { env } from '@config/env'
import prisma from '@config/prisma'
import {
  LoginDTO,
  LoginResponseDTO,
  JWTPayload,
  EsqueciSenhaDTO,
  RedefinirSenhaDTO,
} from './Auth.schema'
import {
  templateRecuperacaoSenha,
  templateSenhaRedefinida,
} from '@shared/emails/templates'

const EXPIRACAO_TOKEN_HORAS = 2

export class AuthService {

  constructor(
    private readonly repository: AuthRepository
  ) {}

  private async gerarEPersistirRefreshToken(
    payload: JWTPayload,
    usuario_id: string
  ): Promise<string> {
    const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })

    const expira_em = new Date()
    expira_em.setDate(expira_em.getDate() + 7)

    await prisma.refreshToken.create({
      data: {
        usuario_id,
        token,
        expira_em,
      },
    })

    return token
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────
  async login(
    data: LoginDTO,
    jwtSign: (payload: JWTPayload) => string
  ): Promise<LoginResponseDTO> {

    const usuario = await this.repository.findByEmail(data.email)

    if (!usuario) {
      throw new AppError('E-mail ou senha incorretos', 401)
    }

    if (!usuario.ativo) {
      throw new AppError('Usuário inativo. Entre em contato com o administrador', 401)
    }

    if (usuario.estabelecimento && !usuario.estabelecimento.ativo) {
      throw new AppError('Estabelecimento suspenso. Entre em contato com o suporte', 403)
    }

    const senhaCorreta = await bcrypt.compare(data.senha, usuario.senha_hash)

    if (!senhaCorreta) {
      throw new AppError('E-mail ou senha incorretos', 401)
    }

    this.repository.atualizarUltimoAcesso(usuario.id).catch(console.error)

    const payload: JWTPayload = {
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      escopo: usuario.escopo,
      estabelecimento_id: usuario.estabelecimento_id,
      empresa_id: usuario.empresa_id,
    }

    const token = jwtSign(payload)
    const refresh_token = await this.gerarEPersistirRefreshToken(payload, usuario.id)

    return {
      token,
      refresh_token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        escopo: usuario.escopo,
        estabelecimento_id: usuario.estabelecimento_id,
        empresa_id: usuario.empresa_id,
      },
    }
  }

  // ── REGISTRO ─────────────────────────────────────────────────────────────
  async registrar(
    data: import('./Auth.schema').RegistrarDTO,
    jwtSign: (payload: JWTPayload) => string
  ): Promise<import('./Auth.schema').RegistrarResponseDTO> {

    const emailExistente = await this.repository.findByEmail(data.email)
    if (emailExistente) {
      throw new AppError('Este e-mail já está cadastrado', 409)
    }

    const senha_hash = await bcrypt.hash(data.senha, 10)

    const { empresa, usuario } = await this.repository.registrar({
      nome_empresa: data.nome_restaurante,
      cnpj: data.cnpj,
      email: data.email,
      senha_hash,
      token_pagamento: data.token_pagamento,
    })

    const payload: JWTPayload = {
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      escopo: usuario.escopo,
      estabelecimento_id: usuario.estabelecimento_id,
      empresa_id: usuario.empresa_id,
    }

    const token = jwtSign(payload)
    const refresh_token = await this.gerarEPersistirRefreshToken(payload, usuario.id)

    return {
      token,
      refresh_token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        escopo: usuario.escopo,
        estabelecimento_id: usuario.estabelecimento_id!,
        empresa_id: usuario.empresa_id!,
      },
    }
  }

  // ── ESQUECI MINHA SENHA ──────────────────────────────────────────────────
  async esqueciSenha(data: EsqueciSenhaDTO): Promise<void> {

    const usuario = await this.repository.findByEmail(data.email)

    if (!usuario || !usuario.ativo) {
      return
    }

    const token = await this.repository.criarTokenRecuperacao(
      usuario.id,
      EXPIRACAO_TOKEN_HORAS
    )

    const linkRedefinicao = `${env.FRONTEND_URL}/redefinir-senha?token=${token}`

    await transporter.sendMail({
      from: env.MAIL_FROM,
      to: usuario.email,
      subject: '🔐 Recuperação de senha — Menupoint',
      html: templateRecuperacaoSenha(
        usuario.nome,
        linkRedefinicao,
        EXPIRACAO_TOKEN_HORAS
      ),
    })
  }

  // ── REDEFINIR SENHA ──────────────────────────────────────────────────────
  async redefinirSenha(data: RedefinirSenhaDTO): Promise<void> {

    const tokenRegistro = await this.repository.findTokenValido(data.token)

    if (!tokenRegistro) {
      throw new AppError(
        'Token inválido ou expirado. Solicite um novo link de recuperação.',
        400
      )
    }

    const usuario = tokenRegistro.usuario as any

    if (!usuario.ativo) {
      throw new AppError('Usuário inativo', 401)
    }

    const nova_senha_hash = await bcrypt.hash(data.nova_senha, 10)

    await this.repository.redefinirSenha(
      tokenRegistro.id,
      usuario.id,
      nova_senha_hash
    )

    transporter.sendMail({
      from: env.MAIL_FROM,
      to: usuario.email,
      subject: '✅ Senha redefinida com sucesso — Menupoint',
      html: templateSenhaRedefinida(usuario.nome),
    }).catch(console.error)
  }

  // ── REFRESH TOKEN ────────────────────────────────────────────────────────
  async refreshToken(
    data: { refresh_token: string },
    jwtSign: (payload: JWTPayload) => string
  ) {
    try {
      const decoded = jwt.verify(
        data.refresh_token,
        env.JWT_REFRESH_SECRET
      ) as JWTPayload

      const tokenNoBanco = await prisma.refreshToken.findFirst({
        where: {
          token: data.refresh_token,
          usado: false,
          expira_em: { gt: new Date() },
        },
      })

      if (!tokenNoBanco) {
        throw new AppError('Refresh token inválido, expirado ou já utilizado', 401)
      }

      // Marca o token atual como usado (rotação de tokens)
      await prisma.refreshToken.update({
        where: { id: tokenNoBanco.id },
        data: { usado: true },
      })

      const payload: JWTPayload = {
        sub: decoded.sub,
        nome: decoded.nome,
        email: decoded.email,
        perfil: decoded.perfil,
        escopo: decoded.escopo,
        estabelecimento_id: decoded.estabelecimento_id,
        empresa_id: decoded.empresa_id,
      }

      const token = jwtSign(payload)
      const refresh_token = await this.gerarEPersistirRefreshToken(
        payload,
        decoded.sub
      )

      return { token, refresh_token }

    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Refresh token inválido ou expirado', 401)
    }
  }

  // ── LOGOUT ───────────────────────────────────────────────────────────────
  async logout(refresh_token: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refresh_token },
      data: { usado: true },
    })
  }
}