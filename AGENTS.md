# Manutenção do Study & Work Reports

- Leia a arquitetura e os arquivos do domínio antes de editar. O App Router permanece em `app/`.
- Escreva código legível, com uma instrução por linha. Use Prettier e ESLint.
- Preserve TypeScript strict; não esconda falhas com `any`, `@ts-ignore` ou desativações de lint.
- Separe apresentação, coordenação de operações, regras puras e persistência SQLite.
- Evite componentes monolíticos e abstrações artificiais; reutilize componentes existentes.
- Justifique dependências novas. Não atualize versões principais sem necessidade.
- Preserve os dados locais, o histórico, as rotas e os contratos de API.
- Não altere regras financeiras sem solicitação explícita. Pagamento previsto não é confirmação.
- Nunca automatize mensagens, bloqueios ou encaminhamentos sem solicitação explícita.
- Crie ou atualize testes quando houver mudança de comportamento; teste com SQLite isolado.
- Execute `npm.cmd run check`, `npm.cmd test` e `npm.cmd run build` antes de concluir.
- Para validar fluxos locais após o build, use `node scripts/verify-local.cjs`; não insira dados fictícios no banco real.
- Documente decisões de arquitetura e limitações relevantes no README ou em `docs/`.
- Mantenha refatorações dentro do escopo. Separe formatação de mudanças estruturais em commits.
- Não formate arquivos gerados, bancos, dados locais ou o HTML legado de referência.

Convenções: arquivos em kebab-case, componentes e tipos em PascalCase, funções em camelCase,
hooks com `use` e imports de tipos com `import type`. Campos persistidos mantêm os nomes atuais.
