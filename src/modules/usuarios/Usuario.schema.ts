import { z } from "zod";

const RoleEnum = z.enum(["ADMIN", "ATENDENTE", "CAIXA"]);

// Cria usuário

export const criarUsuarioSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),

  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .email('Formato de e-mail inválido')
    .toLowerCase(),

  senha: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),

  perfil: z.enum(['ADMIN', 'ATENDENTE', 'CAIXA'])
    .superRefine((value, ctx) => {
      if (!['ADMIN', 'ATENDENTE', 'CAIXA'].includes(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Perfil deve ser ADMIN, ATENDENTE ou CAIXA',
        });
      }
    }),

  escopo: z.enum(['GLOBAL', 'LOCAL'])
    .superRefine((value, ctx) => {
      if (!['GLOBAL', 'LOCAL'].includes(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Escopo deve ser GLOBAL ou LOCAL',
        });
      }
    })
    .default('LOCAL'),

  empresa_id: z.string().uuid('ID da empresa inválido').optional(),

  estabelecimento_id: z
    .string()
    .uuid('ID do estabelecimento inválido')
    .optional(),
})
.refine(
  (data) => {
    if (data.escopo === 'LOCAL' && !data.estabelecimento_id) {
      return false;
    }
    return true;
  },
  {
    message: 'estabelecimento_id é obrigatório quando escopo é LOCAL',
    path: ['estabelecimento_id'],
  }
)
.refine(
  (data) => {
    if (data.escopo === 'GLOBAL' && !data.empresa_id) {
      return false;
    }
    return true;
  },
  {
    message: 'empresa_id é obrigatório quando escopo é GLOBAL',
    path: ['empresa_id'],
  }
);

export type CriarUsuarioDTO = z.infer<typeof criarUsuarioSchema>;

export const atualizarUsuarioSchema = z.object({
  nome: z
    .string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .optional(),

  email: z
    .string()
    .email('Formato de e-mail inválido')
    .toLowerCase()
    .optional(),

  senha: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .optional(),

  perfil: z.enum(['ADMIN', 'ATENDENTE', 'CAIXA']).optional(),

  ativo: z.boolean().optional(),
});

export type AtualizarUsuarioDTO = z.infer<typeof atualizarUsuarioSchema>;

export interface UsuarioResponseDTO {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  escopo: string;
  ativo: boolean;
  estabelecimento_id: string | null;
  empresa_id: string | null;
  ultimo_acesso: Date | null;
  criado_em: Date;
}