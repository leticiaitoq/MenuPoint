-- Foto de perfil do cliente (URL pública no Supabase Storage). Idempotente.
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "foto_url" VARCHAR(500);
