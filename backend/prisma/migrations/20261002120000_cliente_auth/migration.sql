-- Login/cadastro do cliente do restaurante (tabela "clientes", separada de "usuarios").
-- Idempotente: pode rodar mesmo que parte já tenha sido aplicada manualmente.

-- 1) Campos novos do cliente
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "cpf" VARCHAR(14);
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "email_verificado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "ultimo_acesso" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_cpf_key" ON "clientes"("cpf");

-- 2) Código de 6 dígitos para confirmar o e-mail do cliente
CREATE TABLE IF NOT EXISTS "tokens_confirmacao_email_cliente" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_confirmacao_email_cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tokens_confirmacao_email_cliente_token_key"
  ON "tokens_confirmacao_email_cliente"("token");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tokens_confirmacao_email_cliente_cliente_id_fkey'
  ) THEN
    ALTER TABLE "tokens_confirmacao_email_cliente"
      ADD CONSTRAINT "tokens_confirmacao_email_cliente_cliente_id_fkey"
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
