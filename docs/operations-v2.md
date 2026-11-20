# Guia operacional — v2.0

## Início

1. Abra Clientes e parcelas. Cadastre clientes ou use Importar nomes do histórico. A importação não infere contratos, valores ou vencimentos.
2. Cadastre as parcelas com referência/contrato, número, valor original e vencimento. Valores são armazenados em centavos inteiros. Encargos integram o saldo somente quando aplicados manualmente.
3. Ajuste exceções e parâmetros no Calendário Operacional.
4. Abra a Central Operacional. Filtre hoje e vencidas, próximos sete dias, atrasadas, prioridade, categoria, cliente e status.
5. Registre as ações efetivamente realizadas. Conclusões saem da fila pendente e permanecem no histórico e no filtro de concluídas.

O histórico mostra parcelas, valores pagos, saldo, renegociações, contatos e alterações. Contatos legados orientam o motor somente quando o nome corresponde a um único cliente; não são duplicados nos relatórios. Nomes anteriores permanecem associados após renomeação. Registros ambíguos continuam disponíveis em Atividades.

## Calendário

O padrão é segunda a sexta úteis e fins de semana não úteis. Não há API de feriados nem feriados nacionais presumidos. Exceções por data prevalecem sobre o padrão. Cadastre períodos de recesso (até 367 dias por operação), edite/exclua exceções ou marque fins de semana úteis.

A data operacional usa inicialmente America/Sao_Paulo, configurável em Calendário → Configurar regras. Datas civis são strings AAAA-MM-DD. A aritmética usa componentes de calendário sem converter meia-noite local para outro dia. Timestamps representam instantes, exibidos no fuso configurado.

Em `lib/business-calendar.ts`:

- `isBusinessDay`: aplica exceções antes do padrão semanal.
- `nextBusinessDay`: primeiro útil estritamente posterior.
- `addBusinessDays`: soma úteis, excluindo a data inicial; aceita valores negativos.
- `getBusinessDaysBetween`: conta úteis em (início, fim], com sinal negativo no sentido inverso.
- `getNextCollectionDate`: o próprio dia se útil, ou o útil seguinte.

Avisos antecipados usam o último útil igual ou anterior. Alterações recalculam tarefas abertas. Adiamentos guardam a data solicitada e a justificativa; ajustes e reagendamentos são auditados. Conclusões e atividades históricas não têm suas datas alteradas.

## Régua

| Etapa                     | Prazo e recomendação                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-15                      | E-mail e WhatsApp; antecipar ao útil anterior. Conclusão exige confirmação dos dois canais.                                                                                   |
| Vencimento                | Lembrete por WhatsApp no vencimento ou útil anterior. Não representa inadimplência antecipada.                                                                                |
| Primeiro útil após vencer | Cobrança inicial, início da janela e bloqueio pendente. Bloqueio efetivo exige registro separado.                                                                             |
| Janela                    | Dois úteis após o início, seguidos de nova cobrança no útil posterior ao término. Quarta → término sexta → próxima cobrança segunda, salvo exceções.                          |
| Atraso                    | Dias corridos desde o vencimento. Multa de 10% é apenas verificação contratual, sem cálculo ou aplicação automática. Verificação não concluída permanece aberta após 15 dias. |
| Duas parcelas vencidas    | Avaliar renegociação e solicitar decisão da gestão; calcular atraso real da mais antiga.                                                                                      |
| Cobrança continuada       | Após a janela, ações em úteis alternados, usando o último contato efetivo. Segunda → quarta → sexta no intervalo padrão de dois úteis.                                        |
| Proposta em análise       | Suspende cobranças incompatíveis nas parcelas envolvidas até decisão ou fim da suspensão autorizada. Acordo formalizado mantém essas cobranças suspensas.                     |
| Caso antigo               | A partir de 60 dias, sugerir análise externa; encaminhamento exige confirmação, justificativa e responsável.                                                                  |

Antecedência, janela, intervalo, prazo para análise externa, percentual a verificar e fuso são configuráveis. A política de aviso de vencimento é antecipar ao útil anterior. Nenhum canal é acionado pelo sistema.

## Pagamentos e atendimento

Pagamento previsto não altera valor pago. Exemplo: agendado sexta → segunda para conferir → terça alerta, sem confirmação, considerando exceções. Primeiro verifique no financeiro. Somente após registrar pagamento não localizado o motor volta a sugerir cobrança da parcela.

Uma confirmação registra conciliação somente da parcela escolhida, aceita pagamento parcial e preserva outras parcelas. Quitação encerra as pendências de cobrança dessa parcela. Comprovante e atualização do CRM são tarefas manuais. Sem outras parcelas vencidas, atendimento bloqueado recebe tarefa de desbloqueio; não passa automaticamente a ativo. Desbloqueio com outras parcelas vencidas exige decisão autorizada e justificativa. Essa decisão permanece registrada e impede nova sugestão de bloqueio até a regularização da carteira ou novo bloqueio manual; não encerra os saldos devidos.

Renegociações: proposta recebida, aguardando aprovação, aprovada, não aprovada, acordo formalizado e cancelada. Aprovação exige data, condições, responsável e confirmação. Formalização exige aprovação anteriormente registrada. Acordos não modificam automaticamente valores ou vencimentos: alterações de parcelas precisam de registro próprio com justificativa.

## Motor e persistência

O motor executa ao abrir a central, ao gerar relatórios e após mudanças operacionais. Não há cron nem serviço em segundo plano. IDs por regra, cliente, parcela e ciclo evitam duplicações; tarefas concluídas não são recriadas. Formulários têm identificadores de operação para evitar duplicação por reenvio.

Tabelas novas no mesmo banco: op_clients, op_installments, op_activities, op_pending, op_negotiations, op_calendar, op_audit, op_settings e op_commands. Cada entidade tem ID e documento JSON validado pelo SQLite. Há índices por cliente, prazo e unicidade da data do calendário. Relações e transições são validadas no servidor em transações. Atividades novas e auditoria são protegidas contra edição/exclusão por triggers.

Na primeira migração com dados legados, o SQLite cria uma cópia consistente `data/report-before-v2-*.db` com VACUUM INTO, incluindo dados do WAL. As tabelas antigas não são apagadas nem convertidas. Uma falha interrompe a inicialização em vez de prosseguir com migração incompleta. Preserve essa cópia e os backups regulares da pasta data com o servidor fechado.

Backup JSON inclui estado operacional e auditoria. A importação legada continua importando apenas registros válidos; use o banco SQLite para restauração integral.

O diretório padrão é `data`. A variável opcional de servidor `STUDY_REPORT_DATA_DIR` permite escolher outro diretório local. O script `node scripts/verify-local.cjs`, executado após `npm.cmd test` e `npm.cmd run build`, usa essa opção para validar a aplicação de produção com dados fictícios em `.test-build`, sem alterar o banco real. `--browser` também verifica telas e formulário usando Chrome instalado; `CHROME_PATH` permite indicar o executável.

## Relatórios e limites

Atividades efetivamente registradas entram nos totais da data; tarefas sugeridas não entram. Carteira operacional e pendências aparecem em seções separadas. A carteira representa a posição atual, explicitamente identificada, inclusive em relatórios de datas passadas; não há reconstrução retroativa de saldos. Relatórios salvos permanecem inalterados. O refinamento da v1.1 mantém seu funcionamento conservador.

Parcelas já quitadas não podem ter valores editados por esse formulário; correções de pagamentos e estornos exigem fluxo específico ainda não implementado. Arquivos de comprovantes não são armazenados: o sistema registra a tarefa de anexá-los no ambiente corporativo. Não há integração com CRM, instituição financeira ou empresa de cobrança.

## Verificação

`npm.cmd test` compila módulos TypeScript e usa SQLite em memória e OpenAI simulada. Cobre sexta-feira, feriado manual, recesso, sábado útil, vencimento não útil, pagamento antecipado/agendado/parcial, múltiplas parcelas vencidas, proposta pendente/recusada, bloqueio/desbloqueio, idempotência, alterações/exclusões do calendário, migração não destrutiva, contatos legados sem dupla contagem, relatórios sem sugestões nos totais, reenvio de pagamento e rollback. A suíte anterior de IA permanece ativa. Nenhuma chamada paga é feita nos testes.

## Arquivos da v2

Criados:

- `lib/business-calendar.ts`: datas civis, dias úteis e exceções.
- `lib/collection-types.ts`, `lib/collection-status.ts`: entidades, valores e situações.
- `lib/collection-rules.ts`, `lib/task-generator.ts`: recomendações e reconciliação idempotente da fila.
- `lib/operations-migration.ts`, `lib/operations-store.ts`: migração, persistência, validação e auditoria transacional.
- `lib/operational-reports.ts`: integração dos fatos e pendências com os relatórios existentes.
- `lib/local-request.ts`: validação do endereço público local e origem do navegador.
- `app/api/operations/route.ts`: leitura/reprocessamento e comandos manuais.
- `app/operations.tsx`, `app/operations.module.css`: central, carteira, calendário e formulários.
- `tests/operations.cjs`, `tsconfig.tests.json`: testes operacionais isolados e compilação multiplataforma.
- `scripts/verify-local.cjs`: verificação HTTP e opcionalmente Chrome com banco fictício.
- `docs/operations-v2.md`: este guia.

Modificados: `app/page.tsx`, `app/page.module.css`, `app/api/reports/route.ts`, `app/api/reports/refine/route.ts`, `lib/db.ts`, `lib/rules.ts`, `lib/types.ts`, `.env.example`, `package.json`, `package-lock.json` e `README.md`.
