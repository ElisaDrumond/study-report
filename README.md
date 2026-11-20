# Study & Work Reports v2.0

Central operacional local em Next.js, TypeScript e SQLite, com integração opcional OpenAI. Preserva atividades, demandas, relatórios e histórico existentes.

## Central Operacional v2.0

Comece em **Clientes e parcelas**: cadastre clientes ou importe explicitamente os nomes do histórico e registre os valores e vencimentos das parcelas. O sistema não infere contratos ou valores de textos antigos. A central gera automaticamente uma fila filtrável com próximas ações, conferências de pagamentos, renegociações e tarefas vencidas.

O **Calendário Operacional** permite exceções úteis/não úteis, recessos e configuração da régua. O padrão é segunda a sexta úteis, no fuso `America/Sao_Paulo`, sem feriados presumidos. Alterações recalculam tarefas abertas e preservam conclusões e histórico de reagendamentos.

Nenhuma comunicação, alteração de atendimento ou cobrança externa é executada automaticamente. Pagamentos são confirmados por parcela, aceitam valores parciais e geram registros de conciliação. Aprovações e encaminhamentos exigem confirmação humana.

Consulte o [guia operacional completo](docs/operations-v2.md) para os prazos, estados, critérios de suspensão, migração e limitações.

## Windows

Requer Node.js 22 LTS. Execute no PowerShell, na pasta do projeto:

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Abra http://127.0.0.1:3000. Encerre com Ctrl+C. Para produção local:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start
```

## OpenAI opcional

Edite `.env.local`, defina `OPENAI_API_KEY` com sua chave da plataforma OpenAI e `OPENAI_MODEL=gpt-4.1-mini` (ou outro modelo com Structured Outputs). Sua conta precisa de acesso ao modelo e créditos. Reinicie o servidor. Nunca use NEXT_PUBLIC_ para credenciais. Sem chave, as funções tradicionais continuam disponíveis.

Gere o report padrão, escolha Formal (padrão), Executivo ou Detalhado e clique em Refinar com IA. Compare as versões editáveis e escolha qual copiar ou salvar. Nenhum e-mail é enviado automaticamente.

## Integridade e privacidade

A rota `/api/reports/refine` reconstrói o relatório a partir do SQLite no servidor. Usa SDK oficial, API Responses, JSON Schema estrito, store:false, timeout de 30 segundos e sem tentativas automáticas adicionais. Respostas inválidas, incompletas, recusadas ou com seções ausentes/duplicadas são rejeitadas. A aplicação não registra prompts ou dados de clientes nos logs. A rota restringe a origem local e refinamentos simultâneos.

O refinamento é deliberadamente conservador: a IA recebe apenas títulos fixos e identificadores temporários de seções. Escolhe uma abertura previamente aprovada e a ordem das seções. O servidor insere integralmente os blocos originais com nomes, datas, valores, status, observações e indicadores. Os estilos orientam o plano editorial sem excluir detalhes. Não há reescrita livre nem correção gramatical das observações financeiras; isso exigiria validação semântica adicional. Edições manuais ficam sob revisão do usuário e não são enviadas à IA.

Referência: [documentação oficial de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Banco e histórico

Dados em `data/report.db`. Migração transacional e idempotente adiciona originalBody, refinedBody, refinementStyle e refinedAt sem apagar relatórios existentes. body mantém a versão escolhida; originalBody preserva o texto gerado. createdAt registra o salvamento e refinedAt a geração refinada. Cada salvamento cria uma nova linha.

Faça backup da pasta data com o servidor fechado, considerando arquivos WAL/SHM. O backup JSON exporta registros, demandas e histórico; a importação existente recupera apenas registros válidos. Restaure o banco para recuperação integral. A aplicação escuta em 127.0.0.1 e não possui autenticação; proteja a conta Windows e o diretório. Não exponha o servidor à internet. O banco não substitui o CRM oficial.

## Testes e limitações

npm.cmd test utiliza OpenAI simulada e SQLite em memória. A suíte inclui os cenários operacionais da v2, preservação dos dados e relatórios antigos e todos os testes anteriores de refinamento. Consulte a descrição dos cenários no guia operacional.

Validação desta entrega: 33 testes aprovados, TypeScript e build de produção aprovados. A verificação HTTP e no Chrome validou migração/backup, preservação de relatório antigo, calendário, fila, pagamentos parciais/totais, formulários de cliente/parcela/pagamento/exceção e visualização de celular, usando banco fictício isolado. Nenhum dado de teste foi inserido no banco real.

Não são feitas chamadas pagas nos testes. A chamada autenticada e a qualidade editorial do modelo real dependem da chave configurada pelo usuário e não foram verificadas nesta entrega.
