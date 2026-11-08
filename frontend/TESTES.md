# Testes de tela (Fila ↔ Caixa)

Arquivos: `src/__testes__/Fila.test.tsx`, `src/__testes__/CaixaFila.test.tsx` e `src/setupTests.ts`.
Eles simulam a API (nenhuma chamada real) e cobrem: pedidos por etapa, avançar status chamando a API,
"aguardando pagamento" + atalho para o Caixa, filtro `?mesa=` vindo do Caixa, erro ao avançar,
selos da cozinha no card da mesa e "Ver na fila".

O Jest do Create React App não entende o formato novo do `react-router` v7. Para rodar, acrescente ao
`package.json` do frontend (só isso; não afeta o build):

```json
"jest": {
  "moduleNameMapper": {
    "^react-router/dom$": "<rootDir>/node_modules/react-router/dist/development/dom-export.js",
    "^react-router$": "<rootDir>/node_modules/react-router/dist/development/index.js"
  },
  "transformIgnorePatterns": ["/node_modules/(?!(react-router|react-router-dom)/)"]
}
```

Depois: `npm test -- --watchAll=false`
