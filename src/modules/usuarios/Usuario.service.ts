import bcrypt from 'bcryptjs'
import { Usuario } from '@prisma/client'
import { BaseService } from '@shared/abstracts/BaseService'
import { AppError } from '@shared/errors/AppError'
import { UsuarioRepository } from './Usuario.repository'
import {
  CriarUsuarioDTO,
  AtualizarUsuarioDTO,
  UsuarioResponseDTO,
} from './Usuario.schema'

export class UsuarioService
  extends BaseService<Usuario, CriarUsuarioDTO, AtualizarUsuarioDTO> {

  constructor(
    protected readonly repository: UsuarioRepository
  ) {
    super(repository)
  }

  async create(data: CriarUsuarioDTO): Promise<Usuario> {

    const emailExistente = await this.repository.findByEmail(data.email)
    if (emailExistente) {
      throw new AppError('E-mail já cadastrado', 409)
    }

    const senha_hash = await bcrypt.hash(data.senha, 10)

    const { senha, ...resto } = data

    return this.repository.create({
      ...resto,
      senha: senha_hash,
    } as any)
  }


  async update(id: string, data: AtualizarUsuarioDTO): Promise<Usuario> {

    await this.findById(id)

    if (data.email) {
      const emailExistente = await this.repository.findByEmail(data.email)
      if (emailExistente && emailExistente.id !== id) {
        throw new AppError('E-mail já cadastrado', 409)
      }
    }

    let dadosParaSalvar: any = { ...data }
    if (data.senha) {
      const senha_hash = await bcrypt.hash(data.senha, 10)
      const { senha, ...resto } = dadosParaSalvar
      dadosParaSalvar = { ...resto, senha_hash }
    }

    return this.repository.update(id, dadosParaSalvar)
  }

  async listarPorEstabelecimento(
    estabelecimento_id: string
  ): Promise<UsuarioResponseDTO[]> {
    const usuarios = await this.repository.findByEstabelecimento(
      estabelecimento_id
    )
    return usuarios.map(this.sanitizar)
  }

  async listarPorEmpresa(empresa_id: string): Promise<UsuarioResponseDTO[]> {
    const usuarios = await this.repository.findByEmpresa(empresa_id)
    return usuarios.map(this.sanitizar)
  }

  // Filtra oq vai ser retornado para o usuário
  private sanitizar(usuario: Usuario): UsuarioResponseDTO {
    const {
      senha_hash, // não retorna a senha
      ...dados    // mantém todo o resto
    } = usuario as any

    return dados
  }
}