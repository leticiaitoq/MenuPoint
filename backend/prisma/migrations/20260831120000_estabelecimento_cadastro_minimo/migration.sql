-- Permite cadastro mínimo do estabelecimento direto no registro da conta:
-- telefone, whatsapp e endereço passam a ser opcionais (preenchidos depois,
-- na tela de perfil), e passamos a rastrear se o perfil já foi completado.

ALTER TABLE "estabelecimentos" ALTER COLUMN "telefone" DROP NOT NULL;
ALTER TABLE "estabelecimentos" ALTER COLUMN "whatsapp" DROP NOT NULL;
ALTER TABLE "estabelecimentos" ALTER COLUMN "endereco" DROP NOT NULL;

ALTER TABLE "estabelecimentos" ADD COLUMN "perfil_completo" BOOLEAN NOT NULL DEFAULT false;
