-- Chamados de mesa (garçom / conta) feitos pelo cliente local. Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_chamado_mesa') THEN
    CREATE TYPE "tipo_chamado_mesa" AS ENUM ('GARCOM', 'CONTA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_chamado_mesa') THEN
    CREATE TYPE "status_chamado_mesa" AS ENUM ('ABERTO', 'ATENDIDO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "chamados_mesa" (
  "id"                 UUID                  NOT NULL DEFAULT gen_random_uuid(),
  "estabelecimento_id" UUID                  NOT NULL,
  "mesa_id"            UUID                  NOT NULL,
  "tipo"               "tipo_chamado_mesa"   NOT NULL,
  "status"             "status_chamado_mesa" NOT NULL DEFAULT 'ABERTO',
  "forma_pagamento"    "forma_pagamento",
  "criado_em"          TIMESTAMPTZ           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atendido_em"        TIMESTAMPTZ,
  "atendido_por_id"    UUID,
  CONSTRAINT "chamados_mesa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chamados_mesa_estabelecimento_id_status_criado_em_idx"
  ON "chamados_mesa"("estabelecimento_id", "status", "criado_em");
CREATE INDEX IF NOT EXISTS "chamados_mesa_mesa_id_tipo_status_idx"
  ON "chamados_mesa"("mesa_id", "tipo", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamados_mesa_estabelecimento_id_fkey') THEN
    ALTER TABLE "chamados_mesa" ADD CONSTRAINT "chamados_mesa_estabelecimento_id_fkey"
      FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamados_mesa_mesa_id_fkey') THEN
    ALTER TABLE "chamados_mesa" ADD CONSTRAINT "chamados_mesa_mesa_id_fkey"
      FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamados_mesa_atendido_por_id_fkey') THEN
    ALTER TABLE "chamados_mesa" ADD CONSTRAINT "chamados_mesa_atendido_por_id_fkey"
      FOREIGN KEY ("atendido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
