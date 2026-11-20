'use client';
import { CircleCheck, History, RefreshCw } from 'lucide-react';
import op from '../../../app/operations.module.css';
import styles from '../../../app/page.module.css';
import { taskLabels } from '../../../lib/collection-rules';
import { outstandingCents } from '../../../lib/collection-status';
import { fmt } from '../../../lib/rules';
import Field from '../../components/ui/form-field';
import { money, stateLabels } from './operations-presenters';
import type { OperationsController } from './use-operations';
type Props = Pick<
  OperationsController,
  | 'stats'
  | 'reload'
  | 'busy'
  | 'range'
  | 'setRange'
  | 'priority'
  | 'setPriority'
  | 'category'
  | 'setCategory'
  | 'clientFilter'
  | 'setClientFilter'
  | 'operationsState'
  | 'status'
  | 'setStatus'
  | 'queue'
  | 'clientName'
  | 'installmentName'
  | 'today'
  | 'openTask'
  | 'setHistoryClient'
>;
export default function CentralPanel({
  stats,
  reload,
  busy,
  range,
  setRange,
  priority,
  setPriority,
  category,
  setCategory,
  clientFilter,
  setClientFilter,
  operationsState,
  status,
  setStatus,
  queue,
  clientName,
  installmentName,
  today,
  openTask,
  setHistoryClient,
}: Props) {
  return (
    <>
      <div className={styles.stats}>
        {stats.map(([label, value]) => (
          <div key={label} className={styles.stat}>
            <div className={styles.stathead}>{label}</div>
            <strong>{value}</strong>
            <small>Carteira operacional</small>
          </div>
        ))}
      </div>
      <section className={styles.card}>
        <div className={styles.cardhead}>
          <div>
            <p className={styles.eyebrow}>PRÓXIMAS AÇÕES</p>
            <h2>Fila operacional</h2>
          </div>
          <button className={styles.secondary} onClick={reload} disabled={busy}>
            <RefreshCw size={16} /> Recalcular
          </button>
        </div>
        <div className={op.filters}>
          <Field label="Período">
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="today">Hoje e vencidas</option>
              <option value="week">Próximos 7 dias</option>
              <option value="late">Atrasadas</option>
              <option value="all">Todas as datas</option>
            </select>
          </Field>
          <Field label="Prioridade">
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="all">Todas</option>
              <option value="high">Alta</option>
              <option value="normal">Normal</option>
              <option value="low">Baixa</option>
            </select>
          </Field>
          <Field label="Categoria">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Todas</option>
              {Object.entries(taskLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cliente">
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="all">Todos</option>
              {operationsState.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">Pendentes</option>
              <option value="open">Abertas</option>
              <option value="deferred">Adiadas</option>
              <option value="done">Concluídas</option>
              <option value="cancelled">Suspensas / encerradas</option>
              <option value="all">Todos</option>
            </select>
          </Field>
        </div>
        {queue.map((task) => (
          <article className={op.queueTask} key={task.id}>
            <div className={op.taskHeader}>
              <div>
                <b>{clientName(task.clientId)}</b>
                <small className={op.detail}>{installmentName(task.installmentId)}</small>
              </div>
              <span
                className={
                  task.dueDate < today && ['open', 'deferred'].includes(task.status)
                    ? op.overdue
                    : styles.pill
                }
              >
                {fmt(task.dueDate)} ·{' '}
                {task.priority === 'high'
                  ? 'Alta'
                  : task.priority === 'normal'
                    ? 'Normal'
                    : 'Baixa'}
              </span>
            </div>
            <h3>{task.recommendation}</h3>
            <p>{task.reason}</p>
            <p className={styles.subhead}>
              {stateLabels[task.status]}
              {task.deferReason ? ' · Adiamento: ' + task.deferReason : ''}
            </p>
            <details>
              <summary>Últimos registros</summary>
              {operationsState.activities
                .filter((a) => a.clientId === task.clientId)
                .slice(-3)
                .reverse()
                .map((a) => (
                  <p key={a.id}>
                    {fmt(a.date)} · {a.result}
                  </p>
                ))}
            </details>
            <div className={op.actions}>
              {['open', 'deferred'].includes(task.status) && (
                <>
                  {['block', 'unblock'].includes(task.kind) ? (
                    <button
                      className={styles.primary}
                      onClick={() =>
                        openTask('service', task, 'Confirmar alteração do atendimento')
                      }
                    >
                      Registrar {task.kind === 'block' ? 'bloqueio' : 'desbloqueio'}
                    </button>
                  ) : (
                    !task.kind.startsWith('scheduled') && (
                      <button
                        className={styles.primary}
                        onClick={() => openTask('complete_task', task, 'Registrar conclusão')}
                      >
                        Registrar conclusão
                      </button>
                    )
                  )}
                  {task.kind === 'external_review' && (
                    <button
                      className={styles.primary}
                      onClick={() =>
                        openTask('external', task, 'Confirmar encaminhamento à cobrança externa')
                      }
                    >
                      Encaminhar à cobrança externa
                    </button>
                  )}
                  {task.installmentId && (
                    <button
                      className={op.actionPayment}
                      onClick={() =>
                        openTask('confirm_payment', task, 'Registrar pagamento identificado')
                      }
                    >
                      <CircleCheck size={16} /> Registrar pagamento
                    </button>
                  )}
                  {task.kind.startsWith('scheduled') ? (
                    <button
                      className={styles.secondary}
                      disabled={task.dueDate > today}
                      onClick={() =>
                        openTask('payment_not_found', task, 'Registrar pagamento não localizado')
                      }
                    >
                      Pagamento não localizado
                    </button>
                  ) : (
                    <button
                      className={styles.secondary}
                      onClick={() => openTask('record_contact', task, 'Registrar contato efetivo')}
                    >
                      Registrar contato
                    </button>
                  )}
                  <button
                    className={styles.secondary}
                    onClick={() => openTask('defer_task', task, 'Adiar com justificativa')}
                  >
                    Adiar
                  </button>
                  <button
                    className={styles.secondary}
                    onClick={() => openTask('management', task, 'Encaminhar para análise')}
                  >
                    Encaminhar para análise
                  </button>
                </>
              )}
              <button className={styles.secondary} onClick={() => setHistoryClient(task.clientId)}>
                <History size={15} /> Histórico do cliente
              </button>
            </div>
          </article>
        ))}
        {!queue.length && (
          <div className={styles.empty}>
            {operationsState.installments.length
              ? 'Nenhuma tarefa para os filtros escolhidos.'
              : 'Cadastre clientes e parcelas na área Clientes e parcelas para habilitar as recomendações. Os dados antigos continuam nas áreas existentes.'}
          </div>
        )}
      </section>
      <section className={styles.card}>
        <h2>Próximos pagamentos</h2>
        {operationsState.installments
          .filter((p) => p.scheduledDate && p.status !== 'paid' && p.status !== 'cancelled')
          .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
          .map((p) => (
            <div key={p.id} className={styles.paymentItem}>
              <div>
                <b>{clientName(p.clientId)}</b>
                <small>
                  {p.reference} · parcela {p.number} · {money(outstandingCents(p))} · ainda não
                  confirmado
                </small>
              </div>
              <span className={styles.pill}>{fmt(p.scheduledDate)}</span>
            </div>
          ))}
      </section>
    </>
  );
}
