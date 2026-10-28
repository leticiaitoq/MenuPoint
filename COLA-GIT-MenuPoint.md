# Cola de Git — MenuPoint

Guia rápido do grupo. Onde estiver `main`, use a branch base do time (ex.: `main` ou `feature/integracao-front`).
Troque o que está entre `< >` pelo seu valor.

## Regras de ouro (leia primeiro)

1. **Nunca copie um zip por cima do projeto.** Zip não tem histórico, e foi isso que corrompeu a `integracao-front`. Para trazer código de outra pessoa, use branch, merge ou cherry-pick (seção 6).
2. **Nunca trabalhe direto na branch compartilhada.** Crie sua branch (seção 2), faça PR e só então junte.
3. **Antes de qualquer operação arriscada, crie um backup:** `git branch backup/<nome>-<data>`.
4. **Nunca use `git push --force`.** Se o push for rejeitado, faça `git pull`, resolva e envie de novo (seção 4).
5. **Use `git add <arquivo>` em vez de `git add .`.** Assim `.env`, `node_modules` e zips não entram sem querer.
6. **Antes de todo push, rode o checklist da seção 9.**
7. **Nomes de arquivos e pastas sem acento, sem espaço e sem diferença só de maiúscula.** (`Gestao`, `CadastroEndereco`.) Acento vira `#U00e3` em zip e duplica pasta no Windows.

---

## 1. Configuração (uma vez por computador)

```bash
git config --global user.name  "Seu Nome"
git config --global user.email "seu@email.com"
git config --global core.quotepath false      # mostra acentos corretamente
git config --global pull.rebase false         # git pull = merge (sem perguntar)
git config --global init.defaultBranch main
git config --global core.autocrlf true        # só no Windows (quebra de linha)
```

---

## 2. Criar uma branch nova

### 2a. Do zero (sem mudanças locais)

```bash
git switch main                       # vai para a base
git pull                              # atualiza a base
git switch -c feature/<nome-curto>    # cria e entra na nova branch
# ...trabalhe...
git push -u origin feature/<nome-curto>   # 1º push (cria no GitHub)
```

### 2b. Já tenho mudanças locais (ainda não commitei)

As mudanças vão junto para a nova branch.

```bash
git status                            # veja o que mudou
git switch -c feature/<nome-curto>    # leva as mudanças junto
git add <arquivo1> <arquivo2>         # só o que pertence a essa tarefa
git commit -m "feat(escopo): descrição curta"
git push -u origin feature/<nome-curto>
```

Se o Git recusar o `switch` (conflito com arquivos modificados):

```bash
git stash push -u -m "wip <assunto>"  # guarda as mudanças (inclui arquivos novos)
git switch -c feature/<nome-curto> main
git stash pop                         # devolve as mudanças na nova branch
```

### 2c. Já fiz commits na branch errada (ex.: direto na main)

```bash
git branch feature/<nome-curto>       # cria a branch com os commits atuais
git reset --hard origin/main          # devolve a main ao estado do remoto (só se main NÃO foi enviada)
git switch feature/<nome-curto>
git push -u origin feature/<nome-curto>
```

Se a main já tinha sido enviada com esses commits, **não** use `reset`: peça ajuda ao grupo.

---

## 3. Inserir dados numa branch que já existe

### 3a. Com mudanças locais (o caso mais comum)

```bash
git switch feature/<nome>             # entra na branch (se já estiver nela, pule)
git pull                              # traz o que os outros enviaram ANTES de commitar
git status                            # confira os arquivos
git add <arquivo1> <pasta/arquivo2>   # adicione só o necessário
git diff --staged --stat              # revisão final do que vai no commit
git commit -m "fix(caixa): corrige total da mesa"
git push
```

Se o `git switch` reclamar das suas mudanças:

```bash
git stash push -u -m "wip"
git switch feature/<nome>
git pull
git stash pop                         # se der conflito, veja a seção 5
```

### 3b. Começando do zero numa branch que já existe (ex.: baixar a branch do colega)

```bash
git fetch origin
git switch feature/<nome>             # o Git cria a local a partir da origin/feature/<nome>
git pull
```

### 3c. Várias mudanças → vários commits (recomendado)

```bash
git add frontend/src/App/pages/Restaurante/Cadastros/Produtos/
git commit -m "feat(produtos): destaca mensagem de erro no cadastro"
git add backend/src/modules/mesas/
git commit -m "fix(mesas): impede liberar mesa com pedido em andamento"
git push
```

Um commit = uma ideia. Fica fácil de revisar e desfazer.

---

## 4. Atualizar sua branch e push rejeitado

### Trazer novidades da base para sua branch

```bash
git fetch origin
git switch feature/<nome>
git merge origin/main                 # resolva conflitos se aparecerem (seção 5)
git push
```

### `! [rejected] ... (non-fast-forward)` ou `diverged`

Significa que alguém enviou algo que você não tem. **Não use force.**

```bash
git fetch origin
git log --oneline --stat -3 origin/feature/<nome>   # veja o que chegou (tecle q para sair)
git pull                                            # junta; resolva conflitos se houver
git push
```

---

## 5. Resolver conflitos

```bash
git status                            # lista "both modified"
```

Abra o arquivo. O trecho em conflito fica assim:

```
<<<<<<< HEAD
sua versão (a branch em que você está)
=======
versão que veio de fora
>>>>>>> origin/feature/<nome>
```

1. Edite deixando só o código final e apague as 3 linhas de marcador.
2. Salve, e depois:

```bash
git add <arquivo>
git commit                            # (ou: git merge --continue)
```

Atalhos para ficar com um lado inteiro (use só se tiver certeza):

```bash
git checkout --ours   <arquivo>       # fica com a SUA versão (branch atual)
git checkout --theirs <arquivo>       # fica com a versão que veio de fora
git add <arquivo>
```

Desistiu? Volte ao estado de antes: `git merge --abort`.

Antes de commitar, procure marcadores esquecidos:

```bash
git grep -nE "^(<<<<<<<|=======$|>>>>>>>)"
```

---

## 6. Trazer código de outra branch (ou de um zip) com segurança

### Só alguns arquivos de outra branch

```bash
git fetch origin
git restore --source=origin/feature/<outra> -- caminho/do/arquivo.tsx
git add caminho/do/arquivo.tsx
git commit -m "feat(escopo): traz <arquivo> da branch <outra>"
```

### Só um commit específico

```bash
git log origin/feature/<outra> --oneline    # ache o código do commit
git cherry-pick <hash>
```

### A branch inteira

```bash
git merge origin/feature/<outra>
```

### Alguém me mandou um zip

Não solte por cima do projeto. Peça para a pessoa dar `push` na branch dela. Se não der:

```bash
git switch -c integra/<nome-da-pessoa> <commit-base>   # branch nova a partir do commit certo
# extraia o zip FORA da pasta do projeto (ex.: Desktop/temp), nunca dentro dele
git diff --no-index --stat <pasta-do-projeto> <pasta-do-zip>   # veja só o que mudou
# copie apenas os arquivos necessários, confira com git status e git diff
```

Cuidado com zips: nomes acentuados viram `#U00e3`, e uma pasta extra (`MenuPoint-merged/`) pode ser commitada por engano.

---

## 7. Desfazer e recuperar

| Situação | Comando |
|---|---|
| Tirar arquivo do "staged" (antes do commit) | `git restore --staged <arquivo>` |
| Descartar mudanças de um arquivo (**sem volta**) | `git restore <arquivo>` |
| Desfazer o último commit **mantendo** as mudanças | `git reset --soft HEAD~1` |
| Desfazer commit **já enviado** (seguro) | `git revert <hash>` e `git push` |
| Corrigir a mensagem do último commit (ainda não enviado) | `git commit --amend -m "nova mensagem"` |
| Guardar mudanças pela metade | `git stash push -u -m "wip"` / `git stash pop` |
| Ver o que foi enviado por último | `git log --oneline --stat -5` |

### Perdi um commit ou fiz besteira

O Git guarda o histórico de tudo que você fez nos últimos ~90 dias:

```bash
git reflog                            # lista os estados anteriores (tecle q para sair)
git switch -c recuperada <hash>       # cria uma branch a partir do estado perdido
```

### Branch foi sobrescrita no remoto (como aconteceu)

```bash
git fetch origin
git branch backup/<nome>-v1 origin/feature/<nome>   # guarda o estado ruim
git switch -c restaura/<nome> <hash-bom>            # volta ao commit correto numa branch nova
```

Depois abra um PR de `restaura/<nome>` para a branch. **Sem force.**

---

## 8. Padrão de nomes

### Branches

`tipo/assunto-curto`, tudo minúsculo, com hífen.

| Prefixo | Uso | Exemplo |
|---|---|---|
| `feature/` | funcionalidade nova | `feature/tela-caixa` |
| `fix/` | correção de bug | `fix/total-da-mesa` |
| `hotfix/` | correção urgente em produção | `hotfix/login-quebrado` |
| `refactor/` | reorganizar sem mudar comportamento | `refactor/services-pedido` |
| `docs/` | documentação | `docs/cola-git` |
| `backup/` | cópia de segurança (não mexer) | `backup/integracao-front-v1` |

### Commits

Formato: `tipo(escopo): o que foi feito` — no presente, minúsculo, sem ponto final, até ~70 caracteres.

| Tipo | Quando |
|---|---|
| `feat` | funcionalidade nova |
| `fix` | correção de bug |
| `refactor` | reorganização sem mudar comportamento |
| `style` | só visual/CSS/formatação |
| `docs` | documentação |
| `chore` | configuração, dependências, lockfile |
| `revert` | desfaz um commit anterior |

Escopos sugeridos: `auth`, `assinatura`, `pagamento`, `mesas`, `pedidos`, `produtos`, `caixa`, `relatorios`, `config`, `cliente`, `backend`, `frontend`.

```
feat(mesas): permite juntar pedidos de mesas diferentes
fix(assinatura): sincroniza status sem depender do webhook
style(produtos): destaca mensagem de erro no cadastro
chore(frontend): atualiza lockfile
```

---

## 9. Checklist antes do push

```bash
git status                                  # árvore como esperado? nenhuma pasta estranha (ex.: MenuPoint-merged/)?
git diff --staged --stat                    # só os arquivos que eu queria?
git ls-files | grep -E "\.env$|\.zip$|node_modules|logs\.tx"   # NÃO deve listar nada
git grep -nE "^(<<<<<<<|>>>>>>>)"           # sem marcador de conflito
git log --oneline -3                        # mensagens ok?
```

Se algo indevido já foi versionado, tire do Git sem apagar do disco:

```bash
git rm --cached <arquivo>                   # ou: git rm -r --cached <pasta>
echo "<arquivo>" >> .gitignore
git commit -m "chore: remove <arquivo> do versionamento"
```

`.gitignore` mínimo recomendado:

```
node_modules/
.env
.env.*
!.env.example
*.zip
*.log
logs.tx
build/
dist/
```

---

## 10. Fluxo diário em 6 passos (resumo)

```bash
git switch main && git pull                       # 1. base atualizada
git switch -c feature/<assunto>                   # 2. minha branch
# 3. trabalhar
git add <arquivos> && git commit -m "feat(...): ..."   # 4. commits pequenos
git push -u origin feature/<assunto>              # 5. enviar
# 6. abrir Pull Request no GitHub e pedir revisão de alguém do grupo
```

## 11. Dica para o grupo (configuração no GitHub)

Em **Settings → Branches → Add rule** na branch base e na `feature/integracao-front` (a que faz deploy): marque **Require a pull request before merging** e **Do not allow force pushes**. Assim ninguém sobrescreve a branch por engano.
