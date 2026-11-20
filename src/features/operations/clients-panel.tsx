'use client';
import { Download, Plus, Upload } from 'lucide-react';
import { exportClientsCsv, parseClientsCsv } from '../../../lib/client-csv';
import op from '../../../app/operations.module.css';
import styles from '../../../app/page.module.css';
import { isOverdue, outstandingCents } from '../../../lib/collection-status';
import Field from '../../components/ui/form-field';
import ClientHistory from './client-history';
import { financialLabels, money, serviceLabels } from './operations-presenters';
import type { OperationsController } from './use-operations';
type Props = Pick<
  OperationsController,
  | 'busy'
  | 'run'
  | 'setError'
  | 'setDialog'
  | 'selectClient'
  | 'setSelectedClient'
  | 'operationsState'
  | 'openClient'
  | 'setHistoryClient'
  | 'today'
  | 'historyClient'
>;
export default function ClientsPanel({
  busy,
  run,
  setError,
  setDialog,
  selectClient,
  setSelectedClient,
  operationsState,
  openClient,
  setHistoryClient,
  today,
  historyClient,
}: Props) {
  const downloadClients = () => {
    const csv = exportClientsCsv(operationsState.clients, operationsState.installments);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'study-work-clientes.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const uploadClients = async (file: File) => {
    try {
      if (file.size > 2_000_000) throw Error('Arquivo CSV muito grande (máximo 2 MB)');
      const rows = parseClientsCsv(await file.text());
      if (
        !window.confirm(
          `Importar ${rows.length} clientes? Cadastros existentes poderão receber atualizações de nome, CRM e observações. Parcelas e pagamentos serão preservados.`,
        )
      )
        return;
      await run({ type: 'import_clients', rows });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha ao importar CSV');
    }
  };

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardhead}>
          <div>
            <p className={styles.eyebrow}>CARTEIRA OPERACIONAL</p>
            <h2>Clientes e parcelas</h2>
          </div>
          <div className={op.actions}>
            <button
              className={styles.secondary}
              onClick={downloadClients}
              disabled={!operationsState.clients.length}
            >
              <Download size={16} /> Exportar clientes CSV
            </button>
            <label className={styles.secondary}>
              <Upload size={16} /> Importar clientes CSV
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                disabled={busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) await uploadClients(file);
                }}
              />
            </label>
            <button
              className={styles.secondary}
              disabled={busy}
              onClick={() => run({ type: 'import_legacy_clients' })}
            >
              Importar nomes do histórico
            </button>
            <button
              className={styles.primary}
              onClick={() => {
                setError('');
                setDialog({ type: 'save_client', title: 'Novo cliente' });
              }}
            >
              <Plus size={16} /> Novo cliente
            </button>
          </div>
        </div>
        <Field label="Selecionar cliente">
          <select
            value={selectClient?.id || ''}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="" disabled>
              Selecione
            </option>
            {operationsState.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {financialLabels[c.financialStatus]}
              </option>
            ))}
          </select>
        </Field>
        {selectClient && (
          <div className={op.actions}>
            <button
              className={styles.secondary}
              onClick={() => openClient('save_client', 'Editar cliente')}
            >
              Editar cliente
            </button>
            <button
              className={styles.primary}
              onClick={() => openClient('save_installment', 'Nova parcela')}
            >
              <Plus size={16} /> Nova parcela
            </button>
            <button
              className={styles.secondary}
              onClick={() => openClient('save_negotiation', 'Registrar renegociação')}
            >
              Renegociação
            </button>
            <button className={styles.secondary} onClick={() => setHistoryClient(selectClient.id)}>
              Abrir histórico completo
            </button>
          </div>
        )}
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Financeiro</th>
                <th>Atendimento</th>
                <th>Parcelas vencidas</th>
                <th>Saldo registrado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {operationsState.clients.map((c) => {
                const parcels = operationsState.installments.filter((p) => p.clientId === c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.crmRef}
                    </td>
                    <td>{financialLabels[c.financialStatus]}</td>
                    <td>{serviceLabels[c.serviceStatus]}</td>
                    <td>{parcels.filter((p) => isOverdue(p, today)).length}</td>
                    <td>
                      {money(
                        parcels
                          .filter((p) => p.status !== 'cancelled')
                          .reduce((n, p) => n + outstandingCents(p), 0),
                      )}
                    </td>
                    <td>
                      <button
                        className={styles.secondary}
                        onClick={() => {
                          setSelectedClient(c.id);
                          setHistoryClient(c.id);
                        }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {!historyClient && selectClient && (
        <ClientHistory
          clientId={selectClient.id}
          operationsState={operationsState}
          setHistoryClient={setHistoryClient}
          openClient={openClient}
          today={today}
          setSelectedClient={setSelectedClient}
          setDialog={setDialog}
          run={run}
        />
      )}
    </>
  );
}
