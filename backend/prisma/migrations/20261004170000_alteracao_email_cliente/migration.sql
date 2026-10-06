-- Troca de e-mail do cliente logado: o e-mail novo fica guardado junto do código de 6 dígitos
-- até o cliente confirmar. Idempotente (pode rodar mesmo que já tenha sido aplicada à mão).

CREATE TABLE IF NOT EXISTS "tokens_alteracao_email_cliente" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "novo_email" VARCHAR(150) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_alteracao_email_cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tokens_alteracao_email_cliente_token_key"
  ON "tokens_alteracao_email_cliente"("token");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tokens_alteracao_email_cliente_cliente_id_fkey'
  ) THEN
    ALTER TABLE "tokens_alteracao_email_cliente"
      ADD CONSTRAINT "tokens_alteracao_email_cliente_cliente_id_fkey"
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
