-- Ingredientes/adicionais padrão por categoria (modelo para cadastro de produtos). Idempotente.
CREATE TABLE IF NOT EXISTS "ingredientes_categoria" (
  "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
  "categoria_id"       UUID          NOT NULL,
  "nome"               VARCHAR(100)  NOT NULL,
  "descricao"          VARCHAR(255),
  "preco_extra"        DECIMAL(8,2)  NOT NULL DEFAULT 0,
  "quantidade_inclusa" INTEGER       NOT NULL DEFAULT 0,
  "quantidade_maxima"  INTEGER       NOT NULL DEFAULT 1,
  "ativo"              BOOLEAN       NOT NULL DEFAULT true,
  "ordem"              INTEGER       NOT NULL DEFAULT 0,
  "criado_em"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "ingredientes_categoria_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ingredientes_categoria_categoria_id_fkey"
    FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ingredientes_categoria_categoria_id_idx" ON "ingredientes_categoria"("categoria_id");
