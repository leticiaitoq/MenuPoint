-- Cadastro em 2 etapas: o registro passa a criar Empresa + Estabelecimento + Usuário.
-- Todos os comandos são idempotentes (podem rodar mesmo se o banco já tiver sido
-- ajustado manualmente, como aconteceu com perfil_completo).

-- 1) Estabelecimento nasce só com o essencial; o resto é preenchido no "completar perfil".
ALTER TABLE "estabelecimentos" ALTER COLUMN "telefone" DROP NOT NULL;
ALTER TABLE "estabelecimentos" ALTER COLUMN "whatsapp" DROP NOT NULL;
ALTER TABLE "estabelecimentos" ALTER COLUMN "endereco" DROP NOT NULL;
ALTER TABLE "estabelecimentos" ADD COLUMN IF NOT EXISTS "perfil_completo" BOOLEAN NOT NULL DEFAULT false;

-- 2) Razão social da empresa (dado do CNPJ)
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "razao_social" VARCHAR(200);

-- 3) CPF do responsável (dono do restaurante)
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "cpf" VARCHAR(14);
