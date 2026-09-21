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
  VerificarCodigoDTO,
  ReenviarCodigoDTO,
} from './Auth.schema'
import {
  templateRecuperacaoSenha,
  templateSenhaRedefinida,
  templateConfirmacaoEmail,
} from '@shared/emails/templates'

const EXPIRACAO_CODIGO_MINUTOS = 15

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

    if (!usuario.email_verificado) {
      throw new AppError('Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.', 403)
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

    // E-mail de confirmação não bloqueia o cadastro se falhar — a conta
    // já foi criada e a pessoa já está logada mesmo sem confirmar ainda.
    try {
      const codigo = await this.repository.criarTokenConfirmacaoEmail(
        usuario.id,
        EXPIRACAO_CODIGO_MINUTOS
      )

      await transporter.sendMail({
        from: env.MAIL_FROM,
        to: usuario.email,
        subject: '✅ Confirme seu e-mail — Menupoint',
        html: templateConfirmacaoEmail(usuario.nome, codigo, EXPIRACAO_CODIGO_MINUTOS),
      })
    } catch (err) {
      console.error('Falha ao enviar e-mail de confirmação:', err)
    }

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

  // ── VERIFICAR CÓDIGO (cadastro ou recuperação) ─────────────────────────────
  async verificarCodigo(data: VerificarCodigoDTO): Promise<void> {
    if (data.tipo === 'registro') {
      const registro = await this.repository.findTokenConfirmacaoPorCodigo(
        data.email,
        data.codigo
      )

      if (!registro) {
        throw new AppError('Código inválido ou expirado.', 400)
      }

      await this.repository.confirmarEmailUsuario(registro.usuario_id, registro.id)
      return
    }

    // tipo === 'recuperacao': só valida a existência do código aqui.
    // Ele é consumido de fato no passo de redefinirSenha, junto com a nova senha.
    const registro = await this.repository.findTokenRecuperacaoPorCodigo(
      data.email,
      data.codigo
    )

    if (!registro) {
      throw new AppError('Código inválido ou expirado.', 400)
    }
  }

  // ── REENVIAR CÓDIGO (cadastro ou recuperação) ──────────────────────────────
  async reenviarCodigo(data: ReenviarCodigoDTO): Promise<void> {
    const usuario = await this.repository.findByEmail(data.email)

    // Resposta sempre "silenciosa" — não revela se o e-mail existe ou não.
    if (!usuario) return

    if (data.tipo === 'registro') {
      if (usuario.email_verificado) return

      const codigo = await this.repository.criarTokenConfirmacaoEmail(
        usuario.id,
        EXPIRACAO_CODIGO_MINUTOS
      )

      await transporter.sendMail({
        from: env.MAIL_FROM,
        to: usuario.email,
        subject: '✅ Confirme seu e-mail — Menupoint',
        html: templateConfirmacaoEmail(usuario.nome, codigo, EXPIRACAO_CODIGO_MINUTOS),
      })
      return
    }

    if (!usuario.ativo) return

    const codigo = await this.repository.criarTokenRecuperacao(
      usuario.id,
      EXPIRACAO_CODIGO_MINUTOS
    )

    await transporter.sendMail({
      from: env.MAIL_FROM,
      to: usuario.email,
      subject: '🔐 Recuperação de senha — Menupoint',
      html: templateRecuperacaoSenha(usuario.nome, codigo, EXPIRACAO_CODIGO_MINUTOS),
    })
  }

  // ── ESQUECI MINHA SENHA ──────────────────────────────────────────────────
  async esqueciSenha(data: EsqueciSenhaDTO): Promise<void> {

    const usuario = await this.repository.findByEmail(data.email)

    if (!usuario || !usuario.ativo) {
      return
    }

    const codigo = await this.repository.criarTokenRecuperacao(
      usuario.id,
      EXPIRACAO_CODIGO_MINUTOS
    )

    await transporter.sendMail({
      from: env.MAIL_FROM,
      to: usuario.email,
      subject: '🔐 Recuperação de senha — Menupoint',
      html: templateRecuperacaoSenha(
        usuario.nome,
        codigo,
        EXPIRACAO_CODIGO_MINUTOS
      ),
    })
  }

  // ── REDEFINIR SENHA ──────────────────────────────────────────────────────
  async redefinirSenha(data: RedefinirSenhaDTO): Promise<void> {

    const tokenRegistro = await this.repository.findTokenRecuperacaoPorCodigo(
      data.email,
      data.codigo
    )

    if (!tokenRegistro) {
      throw new AppError(
        'Código inválido ou expirado. Solicite um novo código de recuperação.',
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