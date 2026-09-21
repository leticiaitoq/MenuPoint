import { AppError } from '@shared/errors/AppError'
import { PagamentoRepository } from './Pagamento.repository'
import {
  CriarPagamentoDTO,
  ConfirmarPagamentoDTO,
  EstornarPagamentoDTO,
} from './Pagamento.schema'
import prisma from '@config/prisma'

export class PagamentoService {
  constructor(private readonly repository: PagamentoRepository) {}

  async criar(data: CriarPagamentoDTO, estabelecimento_id: string) {
    // Verifica se o pedido existe e pertence ao estabelecimento
    const pedido = await prisma.pedido.findFirst({
      where: { id: data.pedido_id, estabelecimento_id },
    })

    if (!pedido) {
      throw new AppError('Pedido não encontrado', 404)
    }

    if (pedido.status === 'CANCELADO') {
      throw new AppError('Não é possível registrar pagamento de pedido cancelado', 400)
    }

    // Verifica se já existe pagamento para este pedido
    const pagamentoExistente = await this.repository.findByPedido(data.pedido_id)
    if (pagamentoExistente) {
      throw new AppError('Já existe um pagamento registrado para este pedido', 409)
    }

    return this.repository.create({
      ...data,
      estabelecimento_id,
    } as any)
  }

  async findById(id: string, estabelecimento_id: string) {
    const pagamento = await this.repository.findByIdCompleto(id)

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado', 404)
    }

    if ((pagamento as any).estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    return pagamento
  }

  async findByPedido(pedido_id: string, estabelecimento_id: string) {
    // Confirma que o pedido pertence ao estabelecimento
    const pedido = await prisma.pedido.findFirst({
      where: { id: pedido_id, estabelecimento_id },
    })

    if (!pedido) {
      throw new AppError('Pedido não encontrado', 404)
    }

    const pagamento = await this.repository.findByPedido(pedido_id)
    if (!pagamento) {
      throw new AppError('Pagamento não encontrado para este pedido', 404)
    }

    return pagamento
  }

  async listar(
    estabelecimento_id: string,
    filtros?: {
      status?: string
      metodo?: string
      data_inicio?: Date
      data_fim?: Date
    }
  ) {
    return this.repository.findByEstabelecimento(estabelecimento_id, filtros)
  }

  async confirmar(
    id: string,
    data: ConfirmarPagamentoDTO,
    confirmado_por_id: string,
    estabelecimento_id: string
  ) {
    const pagamento = await this.findById(id, estabelecimento_id)

    if ((pagamento as any).status !== 'PENDENTE') {
      throw new AppError(
        `Pagamento não pode ser confirmado pois está "${(pagamento as any).status}"`,
        400
      )
    }

    return this.repository.update(id, {
      status: 'CONFIRMADO',
      confirmado_por_id,
      confirmado_em: new Date(),
      ...(data.comprovante_url && { comprovante_url: data.comprovante_url }),
      ...(data.observacoes && { observacoes: data.observacoes }),
    })
  }

  async estornar(
    id: string,
    data: EstornarPagamentoDTO,
    estabelecimento_id: string
  ) {
    const pagamento = await this.findById(id, estabelecimento_id)

    if ((pagamento as any).status !== 'CONFIRMADO') {
      throw new AppError(
        'Apenas pagamentos confirmados podem ser estornados',
        400
      )
    }

    return this.repository.update(id, {
      status: 'ESTORNADO',
      observacoes: data.observacoes,
    })
  }
}
