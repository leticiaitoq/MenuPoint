import { z } from 'zod'
import prisma from '@config/prisma'
import { AppError } from '@shared/errors/AppError'
import { telefoneValido, formatarTelefone } from '@shared/utils/telefone'
import { UFS_BR, numeroEnderecoValido } from '@shared/utils/endereco'

const MAX_ENDERECOS = 10

// Campo de texto vazio vira null
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null))

// Telefone de contato precisa ser um telefone brasileiro válido
const telefoneOpcional = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || telefoneValido(v), 'Informe um telefone válido com DDD, ex.: (16) 99999-9999')
  .transform((v) => (v ? formatarTelefone(v) : null))

export const criarEnderecoClienteSchema = z.object({
  tipo: z.string().trim().min(1, 'Informe o nome do endereço').max(40, 'Nome do endereço muito longo'),
  cep: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido')
    .transform((v) => (v.includes('-') ? v : `${v.slice(0, 5)}-${v.slice(5)}`)),
  rua: z.string().trim().min(3, 'Informe a rua').max(150),
  numero: z
    .string()
    .trim()
    .min(1, 'Informe o número')
    .max(20)
    .refine(numeroEnderecoValido, 'Número inválido. Use só o número (ex.: 245, 245A) ou S/N'),
  complemento: opcional(100),
  bairro: z.string().trim().min(2, 'Informe o bairro').max(100),
  cidade: z.string().trim().min(2, 'Informe a cidade').max(100),
  estado: z
    .string()
    .trim()
    .toUpperCase()
    .refine((uf) => (UFS_BR as readonly string[]).includes(uf), 'Estado inválido. Use a sigla (ex.: SP)'),
  referencia: opcional(200),
  telefone: telefoneOpcional,
  principal: z.boolean().optional(),
})

export type CriarEnderecoClienteDTO = z.infer<typeof criarEnderecoClienteSchema>

export class ClienteEnderecoService {
  /** Principal primeiro, depois do mais antigo para o mais novo */
  async listar(cliente_id: string) {
    return prisma.enderecoCliente.findMany({
      where: { cliente_id },
      orderBy: [{ principal: 'desc' }, { criado_em: 'asc' }],
    })
  }

  async criar(cliente_id: string, data: CriarEnderecoClienteDTO) {
    const total = await prisma.enderecoCliente.count({ where: { cliente_id } })
    if (total >= MAX_ENDERECOS) {
      throw new AppError(`Você pode salvar no máximo ${MAX_ENDERECOS} endereços. Exclua algum para adicionar outro.`, 400)
    }

    // O primeiro endereço sempre vira o principal
    const principal = total === 0 || Boolean(data.principal)

    return prisma.$transaction(async (tx) => {
      if (principal) {
        await tx.enderecoCliente.updateMany({ where: { cliente_id }, data: { principal: false } })
      }
      return tx.enderecoCliente.create({
        data: { ...data, principal, cliente_id },
      })
    })
  }

  /** Troca todos os dados do endereço */
  async atualizar(cliente_id: string, id: string, data: CriarEnderecoClienteDTO) {
    const atual = await this.buscarDoCliente(cliente_id, id)

    // Quem é o principal continua sendo (sempre precisa existir um); outro vira principal se pedir
    const principal = atual.principal || Boolean(data.principal)

    return prisma.$transaction(async (tx) => {
      if (principal && !atual.principal) {
        await tx.enderecoCliente.updateMany({ where: { cliente_id }, data: { principal: false } })
      }
      return tx.enderecoCliente.update({ where: { id }, data: { ...data, principal } })
    })
  }

  async definirPrincipal(cliente_id: string, id: string) {
    await this.buscarDoCliente(cliente_id, id)
    return prisma.$transaction(async (tx) => {
      await tx.enderecoCliente.updateMany({ where: { cliente_id }, data: { principal: false } })
      return tx.enderecoCliente.update({ where: { id }, data: { principal: true } })
    })
  }

  async excluir(cliente_id: string, id: string) {
    const endereco = await this.buscarDoCliente(cliente_id, id)
    await prisma.enderecoCliente.delete({ where: { id } })

    // Excluiu o principal: o mais antigo que sobrou assume
    if (endereco.principal) {
      const proximo = await prisma.enderecoCliente.findFirst({
        where: { cliente_id },
        orderBy: { criado_em: 'asc' },
      })
      if (proximo) {
        await prisma.enderecoCliente.update({ where: { id: proximo.id }, data: { principal: true } })
      }
    }
  }

  /** Só devolve se o endereço for MESMO deste cliente */
  async buscarDoCliente(cliente_id: string, id: string) {
    const endereco = await prisma.enderecoCliente.findFirst({ where: { id, cliente_id } })
    if (!endereco) throw new AppError('Endereço não encontrado', 404)
    return endereco
  }
}
