'use client';
import { CalendarClock, CircleCheck, History, RefreshCw } from 'lucide-react';
import op from '../../../app/operations.module.css';
import styles from '../../../app/page.module.css';
import { taskLabels } from '../../../lib/collection-rules';
import { daysOverdue, isOverdue, outstandingCents } from '../../../lib/collection-status';
import { overdueDebt } from '../../../lib/overdue-debt';
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
> & { onNavigate: (destination: 'clients' | 'activities') => void };
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
  onNavigate,
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
          <div className={op.actions}>
            <button className={styles.secondary} onClick={() => onNavigate('clients')}>
              Clientes e parcelas
            </button>
            <button className={styles.secondary} onClick={() => onNavigate('activities')}>
              Atividades realizadas
            </button>
            <button className={styles.secondary} onClick={reload} disabled={busy}>
              <RefreshCw size={16} /> Recalcular
            </button>
          </div>
        </div>
        {(() => {
          const installments = operationsState.installments;
          const open = operationsState.pending.filter((task) =>
            ['open', 'deferred'].includes(task.status),
          );
          const unverified = installments.filter((p) =>
            p.verificationStatus === 'unverified' &&
            p.status !== 'paid' &&
            p.status !== 'cancelled' &&
            outstandingCents(p) > 0,
          );
          const future = open.filter((task) => task.dueDate > today);
          const pendingToday = open.filter((task) => task.dueDate <= today);
          const withoutInstallments = operationsState.clients.filter((client) =>
            !installments.some((installment) => installment.clientId === client.id),
          );
          return (
            <div className={styles.note}>
              <strong>Resumo da carteira</strong>
              <p>
                {operationsState.clients.length} cliente(s) · {installments.length} parcela(s) ·{' '}
                {pendingToday.length} tarefa(s) vencida(s) ou para hoje ·{' '}
                {future.length} tarefa(s) futura(s)
              </p>
              {withoutInstallments.length > 0 && (
                <p>
                  {withoutInstallments.length} cliente(s) ainda sem parcelas geradas. O cadastro do
                  contrato sozinho não cria tarefas. Gere as parcelas pelo histórico do cliente.
                </p>
              )}
              {unverified.length > 0 && (
                <p>
                  {unverified.length} parcela(s) aguardando conferência inicial. Elas não
                  entram em cobrança até que sua situação seja confirmada.
                </p>
              )}
              {future.length > 0 && pendingToday.length === 0 && (
                <p>Há tarefas programadas, mas nenhuma está vencida ou prevista para hoje.</p>
              )}
              <div className={op.actions}>
                {(withoutInstallments.length > 0 || unverified.length > 0) && (
                  <button className={styles.secondary} onClick={() => onNavigate('clients')}>
                    Conferir clientes e parcelas
                  </button>
                )}
                {future.length > 0 && (
                  <button className={styles.secondary} onClick={() => setRange('all')}>
                    Ver todas as tarefas programadas
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        <div className={op.filters}>
          <Field label="Período">
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="today">Hoje e vencidas</option>
              <option value="week">Vencidas e próximos 7 dias</option>
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
            {(() => {
              const debt = overdueDebt(operationsState.installments, task.clientId, today);
              return debt.count >= 2 &&
                ['alternate', 'initial', 'window', 'renegotiate'].includes(task.kind) ? (
                <p className={op.detail}>
                  <strong>Saldo vencido consolidado:</strong> {debt.count} parcelas ·{' '}
                  {money(debt.amountCents)} (sem as parcelas futuras).
                </p>
              ) : null;
            })()}
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
                        openTask('service', task, 'Registrar alteração de atendimento')
                      }
                    >
                      Registrar {task.kind === 'block' ? 'bloqueio' : 'desbloqueio'}
                    </button>
                  ) : ['advance', 'due', 'initial', 'window', 'alternate'].includes(task.kind) ? (
                    <button
                      className={styles.primary}
                      onClick={() =>
                        openTask('record_contact', task, 'Registrar cobrança realizada')
                      }
                    >
                      Registrar contato de cobrança
                    </button>
                  ) : task.kind === 'renegotiate' ? (
                    <button
                      className={styles.primary}
                      onClick={() =>
                        openTask('save_negotiation', task, 'Registrar proposta de renegociação')
                      }
                    >
                      Iniciar renegociação
                    </button>
                  ) : task.kind.startsWith('scheduled') ? (
                    <button
                      className={styles.primary}
                      disabled={task.dueDate > today}
                      onClick={() =>
                        openTask('payment_not_found', task, 'Registrar pagamento não localizado')
                      }
                    >
                      Pagamento não localizado
                    </button>
                  ) : task.kind === 'management' ? (
                    <button
                      className={styles.primary}
                      onClick={() => openTask('management', task, 'Solicitar decisão da gestão')}
                    >
                      Solicitar decisão da gestão
                    </button>
                  ) : (
                    <button
                      className={styles.primary}
                      onClick={() =>
                        openTask('complete_task', task, 'Registrar execução da tarefa')
                      }
                    >
                      Registrar tarefa executada
                    </button>
                  )}
                  {task.kind === 'alternate' &&
                    operationsState.clients.find((client) => client.id === task.clientId)
                      ?.financialStatus !== 'external' &&
                    operationsState.installments.some(
                      (installment) =>
                        installment.clientId === task.clientId &&
                        isOverdue(installment, today) &&
                        daysOverdue(installment, today) >=
                          operationsState.settings.externalReviewDays,
                    ) && (
                      <button
                        className={styles.secondary}
                        onClick={() => openTask('external', task, 'Confirmar cobrança externa')}
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
                  <button
                    className={styles.secondary}
                    onClick={() => openTask('defer_task', task, 'Agendar tarefa')}
                  >
                    <CalendarClock size={16} /> Agendar tarefa
                  </button>
                  {task.kind === 'renegotiate' && (
                    <button
                      className={styles.secondary}
                      onClick={() => openTask('management', task, 'Solicitar análise da gestão')}
                    >
                      Solicitar análise da gestão
                    </button>
                  )}
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
              ? 'Não há tarefas neste período e com estes filtros. Selecione “Todas as datas” para conferir tarefas futuras ou “Todos” no status para visualizar tarefas já concluídas e encerradas.'
              : operationsState.clients.length
                ? 'Você já possui clientes cadastrados, mas ainda não há parcelas para a régua calcular. Abra o histórico de um cliente e confirme a geração das parcelas.'
                : 'Cadastre um cliente e suas parcelas para habilitar as recomendações.'
            }
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
