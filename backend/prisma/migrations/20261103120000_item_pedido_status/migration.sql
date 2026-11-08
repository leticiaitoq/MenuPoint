-- Cada item do pedido passa a ter a sua própria etapa na cozinha, para a comida sair da
-- cozinha e ser entregue item a item (sem esperar o pedido inteiro ficar pronto).

-- AlterTable
ALTER TABLE "itens_pedido" ADD COLUMN "status" "status_pedido" NOT NULL DEFAULT 'RECEBIDO';

-- Pedidos que já existiam: cada item herda a etapa do pedido (cancelados ficam como estão).
UPDATE "itens_pedido" AS i
SET "status" = p."status"
FROM "pedidos" AS p
WHERE p."id" = i."pedido_id" AND p."status" <> 'CANCELADO';

-- CreateIndex
CREATE INDEX "itens_pedido_pedido_id_status_idx" ON "itens_pedido"("pedido_id", "status");
