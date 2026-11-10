-- Cliente que ainda não sabe quanto tempo vai ficar na mesa ("não sei ainda"). Idempotente.
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "duracao_indefinida" BOOLEAN NOT NULL DEFAULT false;
