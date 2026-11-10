-- Endereços de entrega salvos pelo cliente (app delivery). Idempotente.
CREATE TABLE IF NOT EXISTS "enderecos_cliente" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "cliente_id"  UUID         NOT NULL,
  "tipo"        VARCHAR(40)  NOT NULL,
  "cep"         VARCHAR(9)   NOT NULL,
  "rua"         VARCHAR(150) NOT NULL,
  "numero"      VARCHAR(20)  NOT NULL,
  "complemento" VARCHAR(100),
  "bairro"      VARCHAR(100) NOT NULL,
  "cidade"      VARCHAR(100) NOT NULL,
  "estado"      VARCHAR(2)   NOT NULL,
  "referencia"  VARCHAR(200),
  "telefone"    VARCHAR(20),
  "principal"   BOOLEAN      NOT NULL DEFAULT false,
  "criado_em"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "enderecos_cliente_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enderecos_cliente_cliente_id_fkey') THEN
    ALTER TABLE "enderecos_cliente"
      ADD CONSTRAINT "enderecos_cliente_cliente_id_fkey"
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "enderecos_cliente_cliente_id_idx" ON "enderecos_cliente"("cliente_id");
