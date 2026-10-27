import { Estabelecimento, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import prisma from '@config/prisma'
import { BaseService } from '@shared/abstracts/BaseService'
import { AppError } from '@shared/errors/AppError'
import { enviarImagemPublica, extensaoDeImagem } from '@shared/storage/supabase'
import { EstabelecimentoRepository } from './Estabelecimento.repository'
import {
  CriarEstabelecimentoDTO,
  AtualizarEstabelecimentoDTO,
  AtualizarPixDTO,
} from './Estabelecimento.schema'

export class EstabelecimentoService extends BaseService <
  Estabelecimento,
  CriarEstabelecimentoDTO,
  AtualizarEstabelecimentoDTO
> {
  constructor(
    protected readonly repository: EstabelecimentoRepository
  ) {
    super(repository)
  }

  async create(data: CriarEstabelecimentoDTO): Promise<Estabelecimento> {

    const slugExistente = await this.repository.findBySlug(data.slug)
    if (slugExistente) {
      throw new AppError(
        'Este slug já está em uso. Escolha outro nome para a URL do cardápio',
        409
      )
    }

    return this.repository.create(data)
  }

  async findByIdCompleto(id: string) {
    const estabelecimento = await this.repository.findByIdCompleto(id)

    if (!estabelecimento) {
      throw new AppError('Estabelecimento não encontrado', 404)
    }

    return estabelecimento
  }

  async findBySlugPublico(slug: string) {
    const estabelecimento = await this.repository.findBySlugPublico(slug)

    if (!estabelecimento) {
      throw new AppError('Cardápio não encontrado', 404)
    }

    return estabelecimento
  }

  async listarPorEmpresa(empresa_id: string) {
    return this.repository.findByEmpresa(empresa_id)
  }

  async update(
    id: string,
    data: AtualizarEstabelecimentoDTO
  ): Promise<Estabelecimento> {

    const atual = await this.findById(id)

    // Valida o intervalo de entrega considerando o que já está salvo
    const min = data.tempo_entrega_min ?? (atual as any).tempo_entrega_min
    const max = data.tempo_entrega_max ?? (atual as any).tempo_entrega_max
    if (max < min) {
      throw new AppError('Tempo máximo de entrega deve ser maior ou igual ao mínimo', 422)
    }

    try {
      return await this.repository.update(id, data as any)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const alvo = String(err.meta?.target ?? '')
        if (alvo.includes('email')) throw new AppError('Este e-mail já está em uso por outro estabelecimento', 409)
        if (alvo.includes('cnpj')) throw new AppError('Este CNPJ já está em uso por outro estabelecimento', 409)
      }
      throw err
    }
  }

  // Envia a logo para o Storage e grava a URL pública no estabelecimento.
  async atualizarLogo(id: string, arquivo: { buffer: Buffer; mimetype: string }): Promise<string> {
    await this.findById(id)

    const ext = extensaoDeImagem(arquivo.buffer, arquivo.mimetype)
    if (!ext) throw new AppError('Envie uma imagem JPG ou PNG', 422)

    // Nome novo a cada envio evita cache do navegador com a logo antiga
    const url = await enviarImagemPublica(`${id}/logo-${Date.now()}.${ext}`, arquivo.buffer, arquivo.mimetype)
    await this.repository.update(id, { logo_url: url } as any)
    return url
  }
  
  async desativar(id: string): Promise<void> {
    await this.findById(id)
    await this.repository.update(id, { ativo: false } as any)
  }

  async reativar(id: string): Promise<Estabelecimento> {
    const estabelecimento = await this.findById(id)

    if ((estabelecimento as any).ativo) {
      throw new AppError('Estabelecimento já está ativo', 400)
    }

    return this.repository.update(id, { ativo: true } as any)
  }

  // ── Chave PIX: dado sensível. Só o dono da empresa (ADMIN com escopo
  // GLOBAL) altera, e só depois de confirmar a senha atual — igual ao fluxo
  // de dados sensíveis do usuário (nome/e-mail/razão social).
  async atualizarPix(
    id: string,
    usuario: { id: string; perfil: string; escopo: string },
    data: AtualizarPixDTO
  ): Promise<Estabelecimento> {
    await this.findById(id)

    if (usuario.perfil !== 'ADMIN' || usuario.escopo !== 'GLOBAL') {
      throw new AppError(
        'Apenas o dono da empresa pode alterar a chave PIX',
        403
      )
    }

    const atual = await prisma.usuario.findUnique({ where: { id: usuario.id } })
    if (!atual || !atual.ativo) {
      throw new AppError('Usuário não encontrado', 404)
    }

    // 403 (e não 401) de propósito: o front trata 401 como sessão expirada.
    const senhaCorreta = await bcrypt.compare(data.senha_atual, atual.senha_hash)
    if (!senhaCorreta) {
      throw new AppError('Senha incorreta', 403)
    }

    return this.repository.update(id, {
      chave_pix: data.chave_pix ?? null,
      tipo_chave_pix: data.chave_pix ? data.tipo_chave_pix ?? null : null,
    } as any)
  }
}