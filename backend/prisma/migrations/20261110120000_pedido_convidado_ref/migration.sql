-- Pedido feito por visitante (sem login) na mesa guarda um código aleatório do aparelho dele.
-- Se ele entrar na conta antes de a conta da mesa fechar, os pedidos com esse código são ligados
-- à conta (cliente_id) e entram no histórico fixo. Nulo = pedido de cliente logado, do salão ou já ligado.

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "convidado_ref" UUID;

-- CreateIndex
CREATE INDEX "pedidos_mesa_id_convidado_ref_idx" ON "pedidos"("mesa_id", "convidado_ref");
