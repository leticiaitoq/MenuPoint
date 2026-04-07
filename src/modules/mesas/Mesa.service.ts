import { Mesa, StatusMesa } from '@prisma/client'
import { AppError } from '@shared/errors/AppError'
import { MesaRepository } from './Mesa.repository'
import {
  CriarMesaDTO,
  AtualizarMesaDTO,
  AtualizarStatusMesaDTO,
} from './Mesa.schema'
import { env } from '@config/env'
import crypto from 'crypto'

export class MesaService {

  constructor(
    private readonly repository: MesaRepository
  ) {}

  async create(
    data: CriarMesaDTO,
    estabelecimento_id: string
  ): Promise<Mesa> {

    const numeroExistente = await this.repository.findByNumero(
      data.numero,
      estabelecimento_id
    )

    if (numeroExistente) {
      if (!numeroExistente.ativo) {
        throw new AppError(
          `Mesa ${data.numero} já existe mas está inativa. Reative-a em vez de criar uma nova.`,
          409
        )
      }
      throw new AppError(
        `Já existe uma mesa com o número ${data.numero}`,
        409
      )
    }

    const qr_code_token = crypto.randomUUID()

    const qr_code_url = `${env.FRONTEND_URL}/mesa/${qr_code_token}`

    return this.repository.create({
      ...data,
      estabelecimento_id,
      qr_code_token,
      qr_code_url,
    })
  }

  async findById(id: string, estabelecimento_id: string): Promise<Mesa> {
    const mesa = await this.repository.findById(id)

    if (!mesa) {
      throw new AppError('Mesa não encontrada', 404)
    }

    if (mesa.estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    return mesa
  }

  async findByToken(token: string) {
    const mesa = await this.repository.findByToken(token)

    if (!mesa) {
      throw new AppError('QR Code inválido ou mesa não encontrada', 404)
    }

    if (!mesa.ativo) {
      throw new AppError('Esta mesa está inativa', 400)
    }

    const estab = (mesa as any).estabelecimento
    if (estab && !estab.aceita_mesa) {
      throw new AppError(
        'Este estabelecimento não aceita pedidos em mesa no momento',
        400
      )
    }

    return mesa
  }

  async listar(
    estabelecimento_id: string,
    apenasAtivas = true
  ): Promise<Mesa[]> {
    return this.repository.findByEstabelecimento(
      estabelecimento_id,
      apenasAtivas
    )
  }

  async update(
    id: string,
    data: AtualizarMesaDTO,
    estabelecimento_id: string
  ): Promise<Mesa> {
    const mesa = await this.findById(id, estabelecimento_id)

    if (data.numero && data.numero !== mesa.numero) {
      const numeroExistente = await this.repository.findByNumero(
        data.numero,
        estabelecimento_id
      )

      if (numeroExistente && numeroExistente.id !== id) {
        throw new AppError(
          `Já existe uma mesa com o número ${data.numero}`,
          409
        )
      }
    }

    return this.repository.update(id, data)
  }

  async reativar(id: string, estabelecimento_id: string): Promise<Mesa> {
    const mesa = await this.repository.findById(id)

    if (!mesa) {
      throw new AppError('Mesa não encontrada', 404)
    }

    if (mesa.estabelecimento_id !== estabelecimento_id) {
      throw new AppError('Acesso não autorizado', 403)
    }

    if (mesa.ativo) {
      throw new AppError('Mesa já está ativa', 400)
    }

    return this.repository.update(id, { ativo: true })
  }

  async atualizarStatus(
  id: string,
  data: AtualizarStatusMesaDTO,
  estabelecimento_id: string
): Promise<Mesa> {
  const mesa = await this.findById(id, estabelecimento_id)

  if (!mesa.ativo) {
    throw new AppError('Não é possível alterar o status de uma mesa inativa', 400)
  }

  return this.repository.update(id, {
    status: data.status as StatusMesa
  })
}

  async resumoOcupacao(estabelecimento_id: string) {
    return this.repository.resumoOcupacao(estabelecimento_id)
  }


  async remove(id: string, estabelecimento_id: string): Promise<void> {
    const mesa = await this.findById(id, estabelecimento_id)

    if (mesa.status === 'OCUPADA') {
      throw new AppError(
        'Não é possível desativar uma mesa ocupada. Libere a mesa primeiro.',
        400
      )
    }

    await this.repository.update(id, { ativo: false })
  }
}