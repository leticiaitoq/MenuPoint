import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { ClienteRepository } from './Cliente.repository'
import { AppError } from '@shared/errors/AppError'
import { transporter } from '@config/mailer'
import { env } from '@config/env'
import {
  ClienteJWTPayload,
  ClienteResumoDTO,
  ClienteSessaoDTO,
  RegistrarClienteDTO,
  LoginClienteDTO,
  VerificarCodigoClienteDTO,
  ReenviarCodigoClienteDTO,
  EsqueciSenhaClienteDTO,
  RedefinirSenhaClienteDTO,
  ClientePerfilDTO,
  AtualizarPerfilClienteDTO,
  AlterarSenhaClienteDTO,
} from './Cliente.schema'
import {
  templateConfirmacaoEmail,
  templateRecuperacaoSenha,
  templateSenhaRedefinida,
} from '@shared/emails/templates'

const EXPIRACAO_CODIGO_MINUTOS = 15
const REFRESH_DIAS = 7

// Usado quando o e-mail não existe, para o tempo de resposta ser parecido
// com o de um e-mail existente (não revela quem tem conta).
const HASH_FALSO = bcrypt.hashSync('senha-inexistente', 10)

type JwtSign = (payload: ClienteJWTPayload) => string

type ClienteBanco = NonNullable<Awaited<ReturnType<ClienteRepository['findById']>>>

export class ClienteService {

  constructor(private readonly repository: ClienteRepository) {}

  // ── helpers ────────────────────────────────────────────────────────────────
  private resumo(c: ClienteBanco): ClienteResumoDTO {
    return {
      id: c.id,
      nome: c.nome,
      email: c.email as string,
      telefone: c.telefone,
      email_verificado: c.email_verificado,
    }
  }

  private payload(c: ClienteBanco): ClienteJWTPayload {
    return {
      sub: c.id,
      nome: c.nome,
      email: c.email as string,
      perfil: 'CLIENTE',
      escopo: 'CLIENTE',
      estabelecimento_id: null,
      empresa_id: null,
    }
  }

  /** Envia e-mail sem travar a resposta: se o SMTP estiver lento/fora, o cadastro não falha. */
  private enviarEmail(para: string, assunto: string, html: string): void {
    void transporter
      .sendMail({ from: env.MAIL_FROM, to: para, subject: assunto, html })
      .catch((err: unknown) => console.error(`Falha ao enviar e-mail "${assunto}":`, err))
  }

  private async enviarCodigoConfirmacao(c: ClienteBanco): Promise<void> {
    const codigo = await this.repository.criarTokenConfirmacaoEmail(c.id, EXPIRACAO_CODIGO_MINUTOS)
    this.enviarEmail(
      c.email as string,
      '✅ Confirme seu e-mail — Menupoint',
      templateConfirmacaoEmail(c.nome, codigo, EXPIRACAO_CODIGO_MINUTOS)
    )
  }

  private async abrirSessao(c: ClienteBanco, jwtSign: JwtSign): Promise<ClienteSessaoDTO> {
    const payload = this.payload(c)

    const refresh_token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: `${REFRESH_DIAS}d`,
      jwtid: crypto.randomUUID(), // evita dois refresh idênticos no mesmo segundo (token é UNIQUE)
    })

    await this.repository.salvarRefreshToken(
      c.id,
      refresh_token,
      new Date(Date.now() + REFRESH_DIAS * 86_400_000)
    )

    return { token: jwtSign(payload), refresh_token, cliente: this.resumo(c) }
  }

  // ── CADASTRO ───────────────────────────────────────────────────────────────
  // Não devolve token: o cliente só entra depois de confirmar o e-mail.
  async registrar(data: RegistrarClienteDTO): Promise<{ email: string }> {
    const existente = await this.repository.findByEmail(data.email)
    if (existente) {
      throw new AppError(
        existente.email_verificado
          ? 'Este e-mail já está cadastrado'
          : 'Este e-mail já foi cadastrado, mas ainda não foi confirmado. Entre com sua senha para receber um novo código.',
        409
      )
    }

    if (await this.repository.findByCpf(data.cpf)) {
      throw new AppError('Este CPF já está cadastrado', 409)
    }

    const senha_hash = await bcrypt.hash(data.senha, 10)

    const cliente = await this.repository.criar({
      nome: data.nome,
      cpf: data.cpf,
      telefone: data.telefone,
      email: data.email,
      senha_hash,
    })

    await this.enviarCodigoConfirmacao(cliente)

    return { email: data.email }
  }

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  async login(data: LoginClienteDTO, jwtSign: JwtSign): Promise<ClienteSessaoDTO> {
    const cliente = await this.repository.findByEmail(data.email)

    // Confere a senha ANTES de revelar qualquer status da conta
    const senhaCorreta = await bcrypt.compare(
      data.senha,
      cliente?.senha_hash ?? HASH_FALSO
    )

    if (!cliente || !cliente.senha_hash || !senhaCorreta) {
      throw new AppError('E-mail ou senha incorretos', 401)
    }

    if (!cliente.ativo) {
      throw new AppError('Conta inativa. Entre em contato com o suporte.', 401)
    }

    if (!cliente.email_verificado) {
      // 403 (não 401): o front leva o cliente para a tela de código
      await this.enviarCodigoConfirmacao(cliente)
      throw new AppError(
        'Confirme seu e-mail antes de entrar. Enviamos um novo código para a sua caixa de entrada.',
        403
      )
    }

    this.repository.atualizarUltimoAcesso(cliente.id).catch(console.error)

    return this.abrirSessao(cliente, jwtSign)
  }

  // ── VERIFICAR CÓDIGO ───────────────────────────────────────────────────────
  // registro    → confirma o e-mail e já devolve a sessão (cliente cai logado)
  // recuperacao → só valida; o código é consumido em redefinirSenha
  async verificarCodigo(
    data: VerificarCodigoClienteDTO,
    jwtSign: JwtSign
  ): Promise<ClienteSessaoDTO | null> {
    if (data.tipo === 'registro') {
      const registro = await this.repository.findTokenConfirmacao(data.email, data.codigo)
      if (!registro) throw new AppError('Código inválido ou expirado.', 400)

      if (!registro.cliente.ativo) throw new AppError('Conta inativa.', 401)

      // Cria a sessão primeiro: se algo falhar aqui, o código continua válido e o
      // cliente pode tentar de novo. Só depois confirma o e-mail e consome o código.
      const sessao = await this.abrirSessao(
        { ...registro.cliente, email_verificado: true },
        jwtSign
      )
      await this.repository.confirmarEmail(registro.cliente_id, registro.id)

      return sessao
    }

    const registro = await this.repository.findTokenRecuperacao(data.email, data.codigo)
    if (!registro) throw new AppError('Código inválido ou expirado.', 400)
    return null
  }

  // ── REENVIAR CÓDIGO ────────────────────────────────────────────────────────
  // Resposta sempre igual: não revela se o e-mail existe.
  async reenviarCodigo(data: ReenviarCodigoClienteDTO): Promise<void> {
    const cliente = await this.repository.findByEmail(data.email)
    if (!cliente || !cliente.ativo) return

    if (data.tipo === 'registro') {
      if (cliente.email_verificado) return
      await this.enviarCodigoConfirmacao(cliente)
      return
    }

    await this.enviarCodigoRecuperacao(cliente)
  }

  private async enviarCodigoRecuperacao(c: ClienteBanco): Promise<void> {
    const codigo = await this.repository.criarTokenRecuperacao(c.id, EXPIRACAO_CODIGO_MINUTOS)
    this.enviarEmail(
      c.email as string,
      '🔐 Recuperação de senha — Menupoint',
      templateRecuperacaoSenha(c.nome, codigo, EXPIRACAO_CODIGO_MINUTOS)
    )
  }

  // ── ESQUECI A SENHA ────────────────────────────────────────────────────────
  async esqueciSenha(data: EsqueciSenhaClienteDTO): Promise<void> {
    const cliente = await this.repository.findByEmail(data.email)
    if (!cliente || !cliente.ativo) return
    await this.enviarCodigoRecuperacao(cliente)
  }

  // ── REDEFINIR SENHA ────────────────────────────────────────────────────────
  async redefinirSenha(data: RedefinirSenhaClienteDTO): Promise<void> {
    const registro = await this.repository.findTokenRecuperacao(data.email, data.codigo)

    if (!registro) {
      throw new AppError('Código inválido ou expirado. Solicite um novo código de recuperação.', 400)
    }

    if (!registro.cliente.ativo) throw new AppError('Conta inativa.', 401)

    const nova_senha_hash = await bcrypt.hash(data.nova_senha, 10)
    await this.repository.redefinirSenha(registro.id, registro.cliente.id, nova_senha_hash)

    this.enviarEmail(
      registro.cliente.email as string,
      '✅ Senha redefinida com sucesso — Menupoint',
      templateSenhaRedefinida(registro.cliente.nome)
    )
  }

  // ── REFRESH TOKEN (rotação) ────────────────────────────────────────────────
  async refreshToken(refresh_token: string, jwtSign: JwtSign): Promise<ClienteSessaoDTO> {
    const invalido = () => new AppError('Refresh token inválido, expirado ou já utilizado', 401)

    let decoded: { sub?: string; perfil?: string }
    try {
      decoded = jwt.verify(refresh_token, env.JWT_REFRESH_SECRET) as typeof decoded
    } catch {
      throw invalido()
    }

    if (decoded.perfil !== 'CLIENTE' || !decoded.sub) throw invalido()

    if (!(await this.repository.consumirRefreshToken(refresh_token))) throw invalido()

    // Dados atuais do banco (nome/e-mail podem ter mudado; conta pode ter sido desativada)
    const cliente = await this.repository.findById(decoded.sub)
    if (!cliente || !cliente.ativo || !cliente.email_verificado) throw invalido()

    return this.abrirSessao(cliente, jwtSign)
  }

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  async logout(refresh_token: string): Promise<void> {
    await this.repository.revogarRefreshToken(refresh_token)
  }

  // ── ME / PERFIL ────────────────────────────────────────────────────────────
  private perfil(c: ClienteBanco): ClientePerfilDTO {
    return { ...this.resumo(c), cpf: c.cpf, criado_em: c.criado_em }
  }

  private async buscarAtivo(id: string): Promise<ClienteBanco> {
    const c = await this.repository.findById(id)
    if (!c) throw new AppError('Cliente não encontrado', 404)
    if (!c.ativo) throw new AppError('Conta inativa', 401)
    return c
  }

  async me(id: string): Promise<ClientePerfilDTO> {
    return this.perfil(await this.buscarAtivo(id))
  }

  async atualizarPerfil(id: string, data: AtualizarPerfilClienteDTO): Promise<ClientePerfilDTO> {
    await this.buscarAtivo(id)
    return this.perfil(await this.repository.atualizarPerfil(id, data))
  }

  // ── ALTERAR SENHA (logado) ─────────────────────────────────────────────────
  // Exige a senha atual. Erro de senha atual é 400 (não 401) de propósito: o front
  // trata 401 como "sessão expirada" e deslogaria o cliente.
  // Devolve uma sessão nova: as outras sessões abertas (refresh tokens) são encerradas.
  async alterarSenha(
    id: string,
    data: AlterarSenhaClienteDTO,
    jwtSign: JwtSign
  ): Promise<ClienteSessaoDTO> {
    const cliente = await this.buscarAtivo(id)

    const senhaCorreta = cliente.senha_hash
      ? await bcrypt.compare(data.senha_atual, cliente.senha_hash)
      : false
    if (!senhaCorreta) throw new AppError('Senha atual incorreta', 400)

    const nova_senha_hash = await bcrypt.hash(data.nova_senha, 10)
    await this.repository.atualizarSenha(id, nova_senha_hash)

    this.enviarEmail(
      cliente.email as string,
      '✅ Senha alterada com sucesso — Menupoint',
      templateSenhaRedefinida(cliente.nome)
    )

    return this.abrirSessao(cliente, jwtSign)
  }
}
