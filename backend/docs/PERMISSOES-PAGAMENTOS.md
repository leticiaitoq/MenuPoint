# Permissões — pagamentos, pedidos de mesa e Caixa

Toda rota exige login (JWT) e só enxerga dados do **próprio estabelecimento** (`estabelecimento_id` do token).
Token de **CLIENTE** é recusado pelo hook global em qualquer rota que não esteja na lista pública.

## Pagamentos (`/api/v1/pagamentos`)

| Rota | Perfis | Observação |
|---|---|---|
| `GET /mesa/:mesa_id/resumo` | ADMIN, CAIXA | conta aberta da mesa, o que já foi pago e o saldo |
| `POST /mesa/:mesa_id/parcial` | ADMIN, CAIXA | pagamento parcial por itens |
| `POST /mesa/:mesa_id/abater` | ADMIN, CAIXA | abatimento de valor (itens opcionais) |
| `POST /mesa/:mesa_id/parcial/:id/desfazer` | ADMIN, CAIXA | desfaz parcial ainda não liquidado (motivo obrigatório, vai para auditoria) |
| `POST /mesa/:mesa_id/finalizar` | ADMIN, CAIXA | paga o que falta e encerra a conta da mesa |
| `POST /` (criar por pedido) | ADMIN, CAIXA | fluxo antigo, um pagamento por pedido |
| `PATCH /:id/confirmar` | ADMIN, CAIXA | fluxo antigo |
| `PATCH /:id/estornar` | **só ADMIN** | de propósito: estorno é mais sensível |
| `GET /`, `GET /pedido/:id`, `GET /:id` | qualquer perfil de equipe do estabelecimento | consulta; sem verificação de perfil (já era assim) |

## Pedidos (`/api/v1/pedidos`)

| Rota | Perfis | Observação |
|---|---|---|
| `POST /transferir` | ADMIN, CAIXA | pedidos de uma mesa para outra |
| `POST /juntar` | ADMIN, CAIXA | une pedidos da mesma mesa |
| `POST /mesa/:mesa_id/cancelar` | ADMIN, CAIXA | cancela os pedidos ainda na cozinha da mesa |
| `PATCH /:id/status` | qualquer perfil de equipe | cozinha/atendente precisam mudar o status; o cancelamento tem guardas (pago, parcial, conta) para todos |
| `PUT /:id` (editar) | qualquer perfil de equipe | tem guardas (item pago em parcial, conta menor que o pago) para todos |
| `GET /` (+ `conta_aberta=true`) | qualquer perfil de equipe | `conta_aberta=true` = só pedidos ainda na conta da mesa |

## Regras de negócio que as rotas aplicam
- **Conta aberta** da mesa = pedidos em andamento **ou entregues**, ainda não pagos (`liquidado_em` nulo e sem pagamento confirmado).
- Entregar o pedido **não** libera a mesa; ela só é liberada ao pagar a conta ou ao cancelar o último pedido da conta.
- Taxa de serviço: constante do servidor (`pagamentos/conta.ts`, hoje 10%). O percentual enviado pelo front é ignorado.
- Operações financeiras de uma mesa são serializadas (trava `FOR UPDATE` na linha da mesa).
- Pedido já servido (entregue) não se edita nem se cancela; para encerrar sem cobrar, feche a conta com desconto total.
- Estorno, cancelamento e edição não podem deixar a conta menor que o já pago em parcial/abatimento.
