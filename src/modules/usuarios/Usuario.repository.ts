// src/modules/usuarios/Usuario.repository.ts

import { Usuario } from '@prisma/client'
import { BaseRepository } from '@shared/abstracts/BaseRepository'
import { CriarUsuarioDTO, AtualizarUsuarioDTO } from './Usuario.schema'
import prisma from '@config/prisma'

export class UsuarioRepository
  extends BaseRepository<Usuario, CriarUsuarioDTO, AtualizarUsuarioDTO> {

  protected modelName = 'usuario' as any


  async findByEmail(email: string): Promise<Usuario | null> {
    return prisma.usuario.findUnique({
      where: { email },
    })
  }

  // Lista todos os usuários de um único estabelecimento
  async findByEstabelecimento(estabelecimento_id: string): Promise<Usuario[]> {
    return prisma.usuario.findMany({
      where: { estabelecimento_id },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        escopo: true,
        ativo: true,
        estabelecimento_id: true,
        empresa_id: true,
        ultimo_acesso: true,
        criado_em: true,
        senha_hash: false,
      },
    }) as unknown as Usuario[]
  }

  // Lista todos os usuários da empresa na visão de todas as filiais
  async findByEmpresa(empresa_id: string): Promise<Usuario[]> {
    return prisma.usuario.findMany({
      where: { empresa_id },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        escopo: true,
        ativo: true,
        estabelecimento_id: true,
        empresa_id: true,
        ultimo_acesso: true,
        criado_em: true,
        senha_hash: false,
      },
    }) as unknown as Usuario[]
  }
}