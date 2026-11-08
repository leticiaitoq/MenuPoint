-- Pagamentos parciais da mesa: pagar só alguns itens (PARCIAL) ou abater um valor da conta (ABATIMENTO).
-- Ficam "abertos" (liquidado_em IS NULL) até a conta da mesa ser fechada.

-- CreateEnum
CREATE TYPE "tipo_pagamento_mesa" AS ENUM ('PARCIAL', 'ABATIMENTO');

-- CreateTable
CREATE TABLE "pagamentos_mesa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estabelecimento_id" UUID NOT NULL,
    "mesa_id" UUID NOT NULL,
    "registrado_por_id" UUID,
    "tipo" "tipo_pagamento_mesa" NOT NULL,
    "metodo" "forma_pagamento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "valor_recebido" DECIMAL(10,2),
    "troco" DECIMAL(10,2),
    "observacoes" TEXT,
    "liquidado_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_mesa_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pagamento_mesa_id" UUID NOT NULL,
    "item_pedido_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pagamentos_mesa_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagamentos_mesa_mesa_id_liquidado_em_idx" ON "pagamentos_mesa"("mesa_id", "liquidado_em");

-- CreateIndex
CREATE INDEX "pagamentos_mesa_itens_item_pedido_id_idx" ON "pagamentos_mesa_itens"("item_pedido_id");

-- AddForeignKey
ALTER TABLE "pagamentos_mesa" ADD CONSTRAINT "pagamentos_mesa_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_mesa" ADD CONSTRAINT "pagamentos_mesa_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_mesa" ADD CONSTRAINT "pagamentos_mesa_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_mesa_itens" ADD CONSTRAINT "pagamentos_mesa_itens_pagamento_mesa_id_fkey" FOREIGN KEY ("pagamento_mesa_id") REFERENCES "pagamentos_mesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_mesa_itens" ADD CONSTRAINT "pagamentos_mesa_itens_item_pedido_id_fkey" FOREIGN KEY ("item_pedido_id") REFERENCES "itens_pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
