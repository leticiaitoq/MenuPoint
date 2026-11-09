-- Quem cancelou a reserva (CLIENTE ou RESTAURANTE), para avisar o cliente quando foi o restaurante. Idempotente.
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "cancelada_por" VARCHAR(20);
