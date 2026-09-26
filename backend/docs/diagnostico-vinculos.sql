-- Rode no SQL Editor do Supabase. Os passos 1–3 só LEEM; o passo 4 (limpeza) está comentado.

-- 1) Empresas cadastradas (se estiver vazio, nenhum cadastro criou empresa)
SELECT id, nome, razao_social, cnpj, plano, criado_em
FROM empresas
ORDER BY criado_em DESC;

-- 2) Cada usuário e o que está vinculado a ele. Cadastro correto = todas as colunas *_ok = true
SELECT
  u.email,
  u.perfil, u.escopo,
  u.empresa_id IS NOT NULL                         AS usuario_tem_empresa,
  u.estabelecimento_id IS NOT NULL                 AS usuario_tem_estab,
  e.empresa_id = u.empresa_id                      AS estab_da_mesma_empresa,
  emp.nome AS empresa, e.nome AS estabelecimento, e.slug,
  u.criado_em
FROM usuarios u
LEFT JOIN estabelecimentos e ON e.id  = u.estabelecimento_id
LEFT JOIN empresas emp       ON emp.id = u.empresa_id
ORDER BY u.criado_em DESC;

-- 3) Estabelecimentos "de mentira" (vindos do scripts/seed.js) ou sem empresa
SELECT id, nome, slug, telefone, empresa_id, criado_em
FROM estabelecimentos
WHERE empresa_id IS NULL
   OR slug = 'estabelecimento-padrao'
   OR telefone = '(11) 99999-9999';

-- 4) LIMPEZA do seed — confira o resultado do passo 3 antes de rodar.
-- BEGIN;
--   DELETE FROM refresh_tokens              WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = 'adminglobal@email.com');
--   DELETE FROM tokens_recuperacao_senha    WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = 'adminglobal@email.com');
--   DELETE FROM tokens_confirmacao_email    WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = 'adminglobal@email.com');
--   DELETE FROM usuarios                    WHERE email = 'adminglobal@email.com';
--   DELETE FROM estabelecimentos            WHERE slug = 'estabelecimento-padrao';
-- COMMIT;
