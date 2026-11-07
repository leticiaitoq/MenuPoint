-- Reserva feita pelo cliente logado (app delivery): guarda quem reservou. Idempotente.
ALTER TABLE "reservas" ADD COLUMN IF NOT EXISTS "cliente_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_cliente_id_fkey') THEN
    ALTER TABLE "reservas"
      ADD CONSTRAINT "reservas_cliente_id_fkey"
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Consultas do Caixa (reservas do dia) e "minhas reservas" do cliente
CREATE INDEX IF NOT EXISTS "reservas_estabelecimento_id_data_reserva_idx" ON "reservas"("estabelecimento_id", "data_reserva");
CREATE INDEX IF NOT EXISTS "reservas_cliente_id_idx" ON "reservas"("cliente_id");
