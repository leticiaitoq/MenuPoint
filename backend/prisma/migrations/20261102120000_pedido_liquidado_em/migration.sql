-- A conta da mesa passa a incluir pedidos JÁ ENTREGUES e ainda não pagos.
-- `liquidado_em` marca quando o pedido saiu da conta (conta paga/encerrada); nulo = conta aberta.

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "liquidado_em" TIMESTAMPTZ;

-- Pedidos de mesa que já estavam entregues ou cancelados antes desta versão estão encerrados:
-- sem isto eles apareceriam como "conta aberta" no Caixa.
UPDATE "pedidos"
SET "liquidado_em" = COALESCE("entregue_em", "atualizado_em", "criado_em")
WHERE "mesa_id" IS NOT NULL AND "status" IN ('ENTREGUE', 'CANCELADO');

-- CreateIndex
CREATE INDEX "pedidos_mesa_id_liquidado_em_idx" ON "pedidos"("mesa_id", "liquidado_em");
