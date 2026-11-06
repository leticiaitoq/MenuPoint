-- Auditoria financeira: registra quem fez o quê (estorno, desfazer parcial, desconto)
CREATE TABLE "auditoria_financeira" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estabelecimento_id" UUID NOT NULL,
    "usuario_id" UUID,
    "acao" VARCHAR(50) NOT NULL,
    "entidade" VARCHAR(50) NOT NULL,
    "entidade_id" UUID,
    "motivo" TEXT,
    "dados" JSONB,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_financeira_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditoria_financeira_estabelecimento_id_criado_em_idx" ON "auditoria_financeira"("estabelecimento_id", "criado_em");
ALTER TABLE "auditoria_financeira" ADD CONSTRAINT "auditoria_financeira_estabelecimento_id_fkey"
  FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auditoria_financeira" ADD CONSTRAINT "auditoria_financeira_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pagamento dividido em várias formas: as linhas compartilham o mesmo grupo
ALTER TABLE "pagamentos_mesa" ADD COLUMN "grupo_id" UUID;
CREATE INDEX "pagamentos_mesa_grupo_id_idx" ON "pagamentos_mesa"("grupo_id");

-- Estorno com autor e data (sem sobrescrever observações)
ALTER TABLE "pagamentos" ADD COLUMN "estornado_em" TIMESTAMPTZ;
ALTER TABLE "pagamentos" ADD COLUMN "estornado_por_id" UUID;
ALTER TABLE "pagamentos" ADD COLUMN "estorno_motivo" TEXT;
ALTER TABLE "pagamentos" ADD COLUMN "desconto_motivo" TEXT;

ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_estornado_por_id_fkey"
  FOREIGN KEY ("estornado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Os adicionais passam a fazer parte de itens_pedido.preco_total (antes só entravam em pedidos.total).
-- Corrige só pedidos ainda abertos; o histórico já liquidado não é alterado.
UPDATE "itens_pedido" ip
SET "preco_total" = ip."preco_total" + ip."quantidade" * COALESCE(
  (SELECT SUM(ia."preco_extra") FROM "itens_adicionais" ia WHERE ia."item_pedido_id" = ip."id"), 0)
WHERE EXISTS (SELECT 1 FROM "itens_adicionais" ia WHERE ia."item_pedido_id" = ip."id")
  AND EXISTS (SELECT 1 FROM "pedidos" p WHERE p."id" = ip."pedido_id"
              AND p."liquidado_em" IS NULL AND p."status" <> 'CANCELADO');
