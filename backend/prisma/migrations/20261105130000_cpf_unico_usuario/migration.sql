-- CPF do responsável passa a ser único (como já é o CPF do cliente).
-- Idempotente. Se já houver CPFs repetidos em "usuarios", PARA com uma mensagem clara em
-- vez de criar o índice pela metade: corrija os repetidos e rode de novo.
--
-- Para listar os repetidos antes (não mostra dado pessoal além do próprio CPF):
--   SELECT cpf, COUNT(*) AS qtd, array_agg(email) AS emails
--   FROM usuarios WHERE cpf IS NOT NULL GROUP BY cpf HAVING COUNT(*) > 1;

DO $$
DECLARE
  repetidos integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'usuarios_cpf_key') THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO repetidos FROM (
    SELECT cpf FROM usuarios WHERE cpf IS NOT NULL GROUP BY cpf HAVING COUNT(*) > 1
  ) d;

  IF repetidos > 0 THEN
    RAISE EXCEPTION 'Existem % CPF(s) repetidos na tabela usuarios. Resolva-os (veja a consulta no topo deste arquivo) e rode a migration de novo.', repetidos;
  END IF;

  CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");
END $$;