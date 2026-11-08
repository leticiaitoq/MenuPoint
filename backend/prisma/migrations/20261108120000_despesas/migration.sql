-- Despesas do estabelecimento e categorias próprias. Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'forma_pagamento_despesa') THEN
    CREATE TYPE "forma_pagamento_despesa" AS ENUM ('PIX', 'BOLETO', 'CARTAO', 'DINHEIRO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "despesas" (
  "id"                 UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "estabelecimento_id" UUID                     NOT NULL,
  "descricao"          VARCHAR(100)             NOT NULL,
  "categoria"          VARCHAR(50)              NOT NULL,
  "fornecedor"         VARCHAR(100),
  "forma_pagamento"    "forma_pagamento_despesa" NOT NULL,
  "valor"              DECIMAL(10,2)            NOT NULL,
  "data_despesa"       DATE                     NOT NULL,
  "observacoes"        TEXT,
  "criado_em"          TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"      TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "despesas_estabelecimento_id_data_despesa_idx"
  ON "despesas"("estabelecimento_id", "data_despesa");

CREATE TABLE IF NOT EXISTS "categorias_despesa" (
  "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  "estabelecimento_id" UUID         NOT NULL,
  "nome"               VARCHAR(50)  NOT NULL,
  "criado_em"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "categorias_despesa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "categorias_despesa_estabelecimento_id_nome_key"
  ON "categorias_despesa"("estabelecimento_id", "nome");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'despesas_estabelecimento_id_fkey') THEN
    ALTER TABLE "despesas"
      ADD CONSTRAINT "despesas_estabelecimento_id_fkey"
      FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorias_despesa_estabelecimento_id_fkey') THEN
    ALTER TABLE "categorias_despesa"
      ADD CONSTRAINT "categorias_despesa_estabelecimento_id_fkey"
      FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
