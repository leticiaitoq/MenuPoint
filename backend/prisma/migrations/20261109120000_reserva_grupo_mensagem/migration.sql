-- Reserva que ocupa várias mesas (uma linha por mesa, ligadas pelo mesmo grupo_id), aviso de falta
-- de assentos e mensagem do restaurante para o cliente. Idempotente.
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "grupo_id" UUID;
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "pessoas_total" INTEGER;
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "falta_assentos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "mensagem_restaurante" VARCHAR(500);
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "mensagem_em" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "reservas_grupo_id_idx" ON "reservas"("grupo_id");
