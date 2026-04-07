import { Categoria } from '@prisma/client'
import { BaseService } from '@shared/abstracts/BaseService'
import { AppError } from '@shared/errors/AppError'
import { CategoriaRepository } from './Categoria.repository'
import {
  CriarCategoriaDTO,
  AtualizarCategoriaDTO,
} from './Categoria.schema'

export class CategoriaService extends BaseService <
  Categoria,
  CriarCategoriaDTO,
  AtualizarCategoriaDTO
> {
  constructor(
    protected readonly repository: CategoriaRepository
  ) {
    super(repository)
  }

async create(
  data: CriarCategoriaDTO,
  context?: Record<string, any>
): Promise<Categoria> {
  const estabelecimento_id = context?.estabelecimento_id;

  if (!estabelecimento_id) {
    throw new AppError('Estabelecimento não informado', 400);
  }

  const nomeExistente = await this.repository.findByNome(
    data.nome,
    estabelecimento_id
  );

  if (nomeExistente) {
    throw new AppError('Já existe uma categoria com este nome', 409);
  }

  return this.repository.create({
    ...data,
    estabelecimento_id,
  });
}

  async listarPorEstabelecimento(
    estabelecimento_id: string
  ): Promise<Categoria[]> {
    return this.repository.findByEstabelecimento(estabelecimento_id)
  }

  async listarComProdutos(estabelecimento_id: string) {
    return this.repository.findByEstabelecimentoComProdutos(estabelecimento_id)
  }

  async update(
  id: string,
  data: AtualizarCategoriaDTO,
  context?: Record<string, any>
): Promise<Categoria> {
  const estabelecimento_id = context?.estabelecimento_id;

  if (!estabelecimento_id) {
    throw new AppError('Estabelecimento não informado', 400);
  }

  const categoria = await this.repository.findById(id);

  if (!categoria) {
    throw new AppError('Categoria não encontrada', 404);
  }

  if (categoria.estabelecimento_id !== estabelecimento_id) {
    throw new AppError('Acesso não autorizado', 403);
  }

  if (data.nome && data.nome !== categoria.nome) {
    const nomeExistente = await this.repository.findByNome(
      data.nome,
      estabelecimento_id
    );

    if (nomeExistente && nomeExistente.id !== id) {
      throw new AppError('Já existe uma categoria com este nome', 409);
    }
  }

  return this.repository.update(id, data);
}

  async reordenar(
  categorias: { id: string; ordem: number }[],
  context?: Record<string, any>
  ): Promise<void> {

    const estabelecimento_id = context?.estabelecimento_id;
    if (!estabelecimento_id) {
    throw new AppError("Estabelecimento não informado", 400);
    }

    const ids = categorias.map((c) => c.id)
    const encontradas = await Promise.all(
      ids.map((id) => this.repository.findById(id))
    )

    const todasPertencem = encontradas.every(
      (c) => c && (c as any).estabelecimento_id === estabelecimento_id
    )

    if (!todasPertencem) {
      throw new AppError(
        'Uma ou mais categorias não pertencem a este estabelecimento',
        403
      )
    }

    await this.repository.reordenar(categorias)
  }

  async delete(id: string, estabelecimento_id: string): Promise<void> {
    const categoria = await this.repository.findById(id)

    if (!categoria) {
      throw new AppError('Categoria não encontrada', 404)
    }

    if ((categoria as any).estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    await this.repository.update(id, { ativo: false } as any)
  }
}