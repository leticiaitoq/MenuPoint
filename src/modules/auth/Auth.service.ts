// src/modules/auth/Auth.service.ts

import bcrypt from 'bcryptjs'
import { AuthRepository } from './Auth.repository'
import { AppError } from '@shared/errors/AppError'
import { LoginDTO, LoginResponseDTO, JWTPayload } from './Auth.schema'

export class AuthService {

  // O Repository é injetado pelo constructor — injeção de dependência
  // O Service não cria o Repository, ele recebe pronto
  // Isso facilita testes: nos testes você passa um Repository falso
  constructor(
    private readonly repository: AuthRepository
  ) {}

  async login(
    data: LoginDTO,
    // jwtSign é a função do Fastify para gerar tokens
    // Recebemos ela como parâmetro para não acoplar o Service ao Fastify
    jwtSign: (payload: JWTPayload) => string
  ): Promise<LoginResponseDTO> {

    // PASSO 1 — Busca o usuário pelo e-mail
    const usuario = await this.repository.findByEmail(data.email)

    // Não revelamos se o e-mail existe ou não
    // Se dissesse "e-mail não encontrado", um atacante saberia quais e-mails estão cadastrados
    if (!usuario) {
      throw new AppError('E-mail ou senha incorretos', 401)
    }

    // PASSO 2 — Verifica se o usuário está ativo no sistema
    if (!usuario.ativo) {
      throw new AppError('Usuário inativo. Entre em contato com o administrador', 401)
    }

    // PASSO 3 — Verifica se o estabelecimento está ativo
    // Um usuário pode estar ativo mas o estabelecimento suspenso (ex: inadimplência)
    if (usuario.estabelecimento && !usuario.estabelecimento.ativo) {
      throw new AppError('Estabelecimento suspenso. Entre em contato com o suporte', 403)
    }

    // PASSO 4 — Compara a senha enviada com o hash salvo no banco
    // bcrypt nunca descriptografa — ele rehasha e compara
    const senhaCorreta = await bcrypt.compare(data.senha, usuario.senha_hash)

    if (!senhaCorreta) {
      throw new AppError('E-mail ou senha incorretos', 401)
    }

    // PASSO 5 — Registra o último acesso (não aguardamos para não atrasar a resposta)
    // O void é intencional — não queremos que um erro aqui quebre o login
    this.repository.atualizarUltimoAcesso(usuario.id).catch(console.error)

    // PASSO 6 — Monta o payload do token JWT
    const payload: JWTPayload = {
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      escopo: usuario.escopo,
      estabelecimento_id: usuario.estabelecimento_id,
      empresa_id: usuario.empresa_id,
    }

    // PASSO 7 — Gera o token com os dados do usuário
    const token = jwtSign(payload)

    // PASSO 8 — Retorna o token e os dados públicos do usuário
    // Nunca retornamos a senha, mesmo que seja o hash
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
}