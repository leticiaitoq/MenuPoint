-- Tipo de cozinha do restaurante (exibido ao cliente). Idempotente.
ALTER TABLE "estabelecimentos" ADD COLUMN IF NOT EXISTS "tipo_cozinha" VARCHAR(60);
