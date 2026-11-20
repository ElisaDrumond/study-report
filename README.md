# Study & Work — Report Financeiro Local (Next.js v1)

Primeira versão do dashboard financeiro local, com a interface Aurora + Glassmorphism, banco SQLite, registro de atividades, demandas da daily, relatórios padrão e histórico das versões salvas.

## Requisitos

- Windows 10 ou 11 (também funciona em macOS/Linux)
- Node.js **22 LTS** instalado: https://nodejs.org/
- Conexão à internet **uma vez** para baixar as dependências do npm. Depois, as funções desta v1 são locais.

## Iniciar no Windows

1. Descompacte este ZIP numa pasta sua **autorizada para dados corporativos** (por exemplo, um diretório aprovado pela TI). Não use pasta pública ou compartilhada sem autorização.
2. Abra um terminal (PowerShell) **dentro da pasta `study-report-next`**.
3. Execute:

   ```powershell
   npm install
   npm run dev
   ```

4. Acesse no navegador: **http://localhost:3000**.
5. Para encerrar o servidor, pressione `Ctrl + C` no terminal.

> Caso o Windows peça compiladores para `better-sqlite3`, confirme que está no Node.js 22 LTS e use `npm install` novamente. O pacote possui binários pré-compilados em plataformas suportadas, mas pode exigir ferramentas de compilação dependendo do ambiente.

## Onde ficam os dados?

Em `data/report.db`, criada automaticamente no primeiro acesso. **Faça backup desta pasta**, preferencialmente enquanto o servidor estiver fechado (o SQLite pode criar também arquivos `-wal` e `-shm` temporários). O botão "Backup JSON" exporta os registros e tarefas para uso complementar.

- A aplicação escuta somente em `127.0.0.1` (não fica disponível para computadores da rede).
- **Não existe autenticação nesta v1**; proteja o usuário do Windows e o diretório de dados. Não publique este servidor, não redirecione portas e não o exponha à internet.
- A geração padrão de reports **não** envia informações para serviços externos.
- A integração com OpenAI **não está ativa** nesta v1. A chave `.env.example` é só um marcador para a próxima fase.
- O banco serve para organização local e **não substitui o CRM oficial da empresa**.

## Recursos

- Cadastro/edição/exclusão de registros financeiros
- Categorias com ações/status válidos por contexto
- Atrasos separados em até 30 dias e mais de 30 dias
- Demandas da daily por data
- Indicadores de ações, clientes únicos e pendências
- Geração de e-mail formal, prévia editável, cópia e armazenamento das versões geradas
- Importação de backups JSON do dashboard HTML anterior (registros válidos)
- Cópia do dashboard HTML original para consulta: `public/dashboard-legado.html`

## Limitações da v1

- Relatórios baseados em modelos fixos, sem refino com IA.
- A importação JSON do HTML anterior recupera **registros válidos**; demandas antigas, textos livres e histórico do HTML não são importados automaticamente.
- A geração atual considera as atividades da data escolhida e a carteira de acompanhamento do banco, não apenas os clientes contatados naquele dia.
- O backup JSON via interface exporta os registros e demandas; restaure reports já salvos copiando também `data/report.db` com o servidor fechado.
- Esta entrega foi preparada sem acesso ao registro npm neste ambiente. A instalação e o funcionamento final devem ser testados no seu computador após `npm install`.

## Próxima etapa (v1.1)

Adicionar botão opcional “Refinar com IA” no backend, após revisão do formato dos dados enviados; nunca expor uma chave de API no navegador. Nenhum e-mail será enviado automaticamente.
