-- Mesas: o número da mesa é único dentro do estabelecimento.
-- Antes só o código conferia; duas requisições simultâneas podiam criar mesas duplicadas.
-- ATENÇÃO: se já existirem números repetidos no mesmo estabelecimento, este índice falha.
-- Para conferir antes de aplicar:
--   SELECT estabelecimento_id, numero, COUNT(*) FROM mesas GROUP BY 1, 2 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX "mesas_estabelecimento_id_numero_key" ON "mesas"("estabelecimento_id", "numero");
