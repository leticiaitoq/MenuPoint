import bcrypt from 'bcryptjs'
import { AuthRepository } from './Auth.repository'
import { AppError } from '@shared/errors/AppError'
import { transporter } from '@config/mailer'
import { env } from '@config/env'
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

  // O Repository é injetado pelo constructor — injeção de dependência
  // O Service não cria o Repository, ele recebe pronto
  constructor(
    private readonly repository: AuthRepository
  ) {}

  async login(
    data: LoginDTO,
    jwtSign: (payload: JWTPayload) => string // jwtSign é a função do Fastify para gerar tokens
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

    // Compara a senha enviada com o hash salvo no banco
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

    return {
      token,
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
  // ── ESQUECI MINHA SENHA ──────────────────────────────────────────────────
  async esqueciSenha(data: EsqueciSenhaDTO): Promise<void> {

    // Busca o usuário pelo e-mail
    const usuario = await this.repository.findByEmail(data.email)

    // IMPORTANTE: mesmo que o e-mail não exista, retornamos sucesso
    // Isso evita que alguém descubra quais e-mails estão cadastrados
    // tentando vários e-mails e vendo qual retorna erro
    if (!usuario || !usuario.ativo) {
      return
    }

    // Cria o token de recuperação no banco
    const token = await this.repository.criarTokenRecuperacao(
      usuario.id,
      EXPIRACAO_TOKEN_HORAS
    )

    // Monta o link que vai no e-mail
    // Quando o frontend estiver pronto, esse link vai abrir a tela de redefinição
    const linkRedefinicao = `${env.FRONTEND_URL}/redefinir-senha?token=${token}`

    // Envia o e-mail
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

    // Busca o token no banco — verifica se é válido e não expirou
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

    // Gera o hash da nova senha
    const nova_senha_hash = await bcrypt.hash(data.nova_senha, 10)

    // Marca o token como usado e atualiza a senha em uma transação
    await this.repository.redefinirSenha(
      tokenRegistro.id,
      usuario.id,
      nova_senha_hash
    )

    // Envia e-mail de confirmação informando que a senha foi alterada
    // Não aguardamos — se falhar, não afeta o fluxo principal
    transporter.sendMail({
      from: env.MAIL_FROM,
      to: usuario.email,
      subject: '✅ Senha redefinida com sucesso — Menupoint',
      html: templateSenhaRedefinida(usuario.nome),
    }).catch(console.error)
  }
}