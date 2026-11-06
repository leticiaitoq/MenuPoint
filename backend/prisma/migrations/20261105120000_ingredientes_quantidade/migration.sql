-- Ingredientes estilo totem: quantidade inclusa no produto e máximo permitido. Idempotente.
ALTER TABLE "adicionais" ADD COLUMN IF NOT EXISTS "quantidade_inclusa" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "adicionais" ADD COLUMN IF NOT EXISTS "quantidade_maxima" INTEGER NOT NULL DEFAULT 1;
