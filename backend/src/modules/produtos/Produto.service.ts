import { Produto } from '@prisma/client'
import { AppError } from '@shared/errors/AppError'
import { ProdutoRepository } from './Produto.repository'
import {
  CriarProdutoDTO,
  AtualizarProdutoDTO,
  ReordenarProdutosDTO,
} from './Produto.schema'
import prisma from '@config/prisma'

export class ProdutoService {

  constructor(
    private readonly repository: ProdutoRepository
  ) {}

  async create(data: CriarProdutoDTO, estabelecimento_id: string) {

    const categoria = await prisma.categoria.findFirst({
      where: { id: data.categoria_id, estabelecimento_id },
    })

    if (!categoria) {
      throw new AppError('Categoria não encontrada', 404)
    }

    if (!categoria.ativo) {
      throw new AppError(
        'Não é possível adicionar produtos a uma categoria inativa',
        400
      )
    }

    return this.repository.createComAdicionais({
      ...data,
      estabelecimento_id,
    })
  }

  async findById(id: string): Promise<Produto> {
    const produto = await this.repository.findById(id)

    if (!produto) {
      throw new AppError('Produto não encontrado', 404)
    }

    return produto
  }

  async findCompleto(id: string, estabelecimento_id: string) {
    const produto = await this.repository.findByIdCompleto(id)

    if (!produto) {
      throw new AppError('Produto não encontrado', 404)
    }

    if ((produto as any).estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    return produto
  }

  async listarPorEstabelecimento(
    estabelecimento_id: string,
    filtros?: {
      categoria_id?: string
      disponivel?: boolean
      destaque?: boolean
    }
  ) {
    return this.repository.findByEstabelecimento(estabelecimento_id, filtros)
  }

  async maisVendidos(estabelecimento_id: string, limite?: number) {
    return this.repository.findMaisVendidos(estabelecimento_id, limite)
  }

  async update(
    id: string,
    data: AtualizarProdutoDTO,
    estabelecimento_id: string
  ) {
    await this.findCompleto(id, estabelecimento_id)

    if (data.categoria_id) {
      const categoria = await prisma.categoria.findFirst({
        where: { id: data.categoria_id, estabelecimento_id },
      })

      if (!categoria) {
        throw new AppError('Categoria não encontrada', 404)
      }
    }

    return this.repository.update(id, data)
  }

  async reordenar(
    produtos: ReordenarProdutosDTO,
    estabelecimento_id: string
  ): Promise<void> {
    const encontrados = await Promise.all(
      produtos.map((p) => this.repository.findById(p.id))
    )

    const todasPertencem = encontrados.every(
      (p: unknown) => p && (p as any).estabelecimento_id === estabelecimento_id
    )

    if (!todasPertencem) {
      throw new AppError(
        'Um ou mais produtos não pertencem a este estabelecimento',
        403
      )
    }

    await this.repository.reordenar(produtos)
  }

  async alternarDisponibilidade(id: string, estabelecimento_id: string) {
    const produto = await this.findCompleto(id, estabelecimento_id)

    return this.repository.update(id, {
      disponivel: !(produto as any).disponivel,
    })
  }

  async remove(id: string, estabelecimento_id: string): Promise<void> {
    const produto = await this.findCompleto(id, estabelecimento_id)

    if (!(produto as any).disponivel && (produto as any).ativo === false) {
      throw new AppError('Produto já está desativado', 400)
    }

    await this.repository.update(id, { ativo: false } as any)
  }

  async reativar(id: string, estabelecimento_id: string): Promise<Produto> {
    const produto = await this.repository.findById(id)

    if (!produto) {
      throw new AppError('Produto não encontrado', 404)
    }

    if ((produto as any).estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    if ((produto as any).ativo !== false) {
      throw new AppError('Produto já está ativo', 400)
    }

    return this.repository.update(id, { ativo: true } as any)
  }
}