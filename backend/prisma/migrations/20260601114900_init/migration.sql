-- CreateEnum
CREATE TYPE "plano" AS ENUM ('STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "tema" AS ENUM ('CLARO', 'ESCURO');

-- CreateEnum
CREATE TYPE "tipo_chave_pix" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA');

-- CreateEnum
CREATE TYPE "perfil" AS ENUM ('ADMIN', 'ATENDENTE', 'CAIXA');

-- CreateEnum
CREATE TYPE "escopo" AS ENUM ('GLOBAL', 'LOCAL');

-- CreateEnum
CREATE TYPE "status_mesa" AS ENUM ('LIVRE', 'OCUPADA', 'RESERVADA', 'INATIVA');

-- CreateEnum
CREATE TYPE "status_reserva" AS ENUM ('PENDENTE', 'CONFIRMADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "modalidade" AS ENUM ('ENTREGA', 'MESA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "status_pedido" AS ENUM ('RECEBIDO', 'PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "forma_pagamento" AS ENUM ('PIX_ONLINE', 'PIX_PRESENCIAL', 'DINHEIRO', 'CARTAO');

-- CreateEnum
CREATE TYPE "status_pagamento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'ESTORNADO', 'FALHOU');

-- CreateEnum
CREATE TYPE "status_assinatura" AS ENUM ('PENDENTE', 'ATIVA', 'CANCELADA', 'EXPIRADA', 'FALHOU');

-- CreateEnum
CREATE TYPE "periodo_assinatura" AS ENUM ('MENSAL', 'ANUAL');

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(150) NOT NULL,
    "cnpj" VARCHAR(18),
    "plano" "plano" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estabelecimentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID,
    "nome" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "cnpj" VARCHAR(18),
    "telefone" VARCHAR(20) NOT NULL,
    "whatsapp" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "endereco" JSONB NOT NULL,
    "logo_url" VARCHAR(500),
    "banner_url" VARCHAR(500),
    "tema" "tema" NOT NULL DEFAULT 'CLARO',
    "chave_pix" VARCHAR(150),
    "tipo_chave_pix" "tipo_chave_pix",
    "tempo_entrega_min" INTEGER NOT NULL DEFAULT 30,
    "tempo_entrega_max" INTEGER NOT NULL DEFAULT 60,
    "taxa_entrega" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "pedido_minimo" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "aceita_entrega" BOOLEAN NOT NULL DEFAULT true,
    "aceita_retirada" BOOLEAN NOT NULL DEFAULT true,
    "aceita_mesa" BOOLEAN NOT NULL DEFAULT true,
    "horario_funcionamento" JSONB,
    "desconto_boas_vindas_usado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estabelecimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID,
    "estabelecimento_id" UUID,
    "nome" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "perfil" "perfil" NOT NULL,
    "escopo" "escopo" NOT NULL DEFAULT 'LOCAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acesso" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estabelecimento_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" VARCHAR(255),
    "icone" VARCHAR(10),
    "imagem_url" VARCHAR(500),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estabelecimento_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "preco" DECIMAL(10,2) NOT NULL,
    "preco_promocional" DECIMAL(10,2),
    "imagem_url" VARCHAR(500),
    "codigo_interno" VARCHAR(50),
    "tempo_preparo_min" INTEGER,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "total_vendido" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_adicionais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "produto_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "selecao_multipla" BOOLEAN NOT NULL DEFAULT false,
    "min_selecoes" INTEGER NOT NULL DEFAULT 0,
    "max_selecoes" INTEGER NOT NULL DEFAULT 1,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grupos_adicionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adicionais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "preco_extra" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "adicionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estabelecimento_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "qr_code_token" VARCHAR(64) NOT NULL,
    "qr_code_url" VARCHAR(500),
    "localizacao" VARCHAR(100),
    "status" "status_mesa" NOT NULL DEFAULT 'LIVRE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estabelecimento_id" UUID NOT NULL,
    "mesa_id" UUID,
    "confirmada_por_id" UUID,
    "cliente_nome" VARCHAR(100) NOT NULL,
    "cliente_telefone" VARCHAR(20) NOT NULL,
    "cliente_email" VARCHAR(150),
    "data_reserva" DATE NOT NULL,
    "hora_inicio" TIME NOT NULL,
    "hora_fim" TIME NOT NULL,
    "num_pessoas" INTEGER NOT NULL,
    "observacoes" TEXT,
    "status" "status_reserva" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estabelecimento_id" UUID NOT NULL,
    "mesa_id" UUID,
    "reserva_id" UUID,
    "atendido_por_id" UUID,
    "cliente_id" UUID,
    "numero_pedido" SERIAL NOT NULL,
    "modalidade" "modalidade" NOT NULL,
    "status" "status_pedido" NOT NULL DEFAULT 'RECEBIDO',
    "cliente_nome" VARCHAR(100) NOT NULL,
    "cliente_telefone" VARCHAR(20) NOT NULL,
    "endereco_entrega" JSONB,
    "observacoes" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxa_entrega" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "forma_pagamento" "forma_pagamento",
    "troco_para" DECIMAL(10,2),
    "whatsapp_enviado" BOOLEAN NOT NULL DEFAULT false,
    "cancelamento_motivo" TEXT,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregue_em" TIMESTAMPTZ,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,
    "preco_total" DECIMAL(10,2) NOT NULL,
    "observacoes" TEXT,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_adicionais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_pedido_id" UUID NOT NULL,
    "adicional_id" UUID NOT NULL,
    "nome_adicional" VARCHAR(100) NOT NULL,
    "preco_extra" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "itens_adicionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "estabelecimento_id" UUID NOT NULL,
    "confirmado_por_id" UUID,
    "valor" DECIMAL(10,2) NOT NULL,
    "metodo" "forma_pagamento" NOT NULL,
    "status" "status_pagamento" NOT NULL DEFAULT 'PENDENTE',
    "chave_pix_usada" VARCHAR(150),
    "comprovante_url" VARCHAR(500),
    "valor_original" DECIMAL(10,2),
    "desconto_percentual" DECIMAL(5,2) DEFAULT 0,
    "desconto_valor" DECIMAL(10,2) DEFAULT 0,
    "observacoes" TEXT,
    "confirmado_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "cliente_id" UUID,
    "token" VARCHAR(128) NOT NULL,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(100) NOT NULL,
    "telefone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "senha_hash" VARCHAR(255),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_recuperacao_senha_cliente" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacao_senha_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "plano" "plano" NOT NULL,
    "status" "status_assinatura" NOT NULL DEFAULT 'PENDENTE',
    "gateway" VARCHAR(50) NOT NULL,
    "gateway_id" VARCHAR(200),
    "gateway_customer_id" VARCHAR(200),
    "checkout_url" VARCHAR(500),
    "token_registro" VARCHAR(128),
    "valor" DECIMAL(10,2) NOT NULL,
    "periodo" "periodo_assinatura" NOT NULL DEFAULT 'MENSAL',
    "inicia_em" TIMESTAMPTZ,
    "expira_em" TIMESTAMPTZ,
    "cancelada_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_recuperacao_senha" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(0) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "estabelecimentos_slug_key" ON "estabelecimentos"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "estabelecimentos_cnpj_key" ON "estabelecimentos"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "estabelecimentos_email_key" ON "estabelecimentos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_qr_code_token_key" ON "mesas"("qr_code_token");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_pedido_id_key" ON "pagamentos"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacao_senha_cliente_token_key" ON "tokens_recuperacao_senha_cliente"("token");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_token_registro_key" ON "assinaturas"("token_registro");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacao_senha_token_key" ON "tokens_recuperacao_senha"("token");

-- AddForeignKey
ALTER TABLE "estabelecimentos" ADD CONSTRAINT "estabelecimentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_adicionais" ADD CONSTRAINT "grupos_adicionais_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adicionais" ADD CONSTRAINT "adicionais_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_adicionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_confirmada_por_id_fkey" FOREIGN KEY ("confirmada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_atendido_por_id_fkey" FOREIGN KEY ("atendido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_adicionais" ADD CONSTRAINT "itens_adicionais_item_pedido_id_fkey" FOREIGN KEY ("item_pedido_id") REFERENCES "itens_pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_adicionais" ADD CONSTRAINT "itens_adicionais_adicional_id_fkey" FOREIGN KEY ("adicional_id") REFERENCES "adicionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_confirmado_por_id_fkey" FOREIGN KEY ("confirmado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_recuperacao_senha_cliente" ADD CONSTRAINT "tokens_recuperacao_senha_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_recuperacao_senha" ADD CONSTRAINT "tokens_recuperacao_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
