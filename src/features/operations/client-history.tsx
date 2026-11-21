'use client';
import { CalendarClock, CircleCheck, ClipboardCheck, Pencil, X } from 'lucide-react';
import op from '../../../app/operations.module.css';
import styles from '../../../app/page.module.css';
import { calendarDaysBetween } from '../../../lib/business-calendar';
import { isOverdue, negotiationLabels, outstandingCents } from '../../../lib/collection-status';
import { fmt } from '../../../lib/rules';
import { buildInstallmentPlan } from '../../../lib/installment-plan';
import {
  activityLabel,
  channelLabels,
  financialLabels,
  money,
  serviceLabels,
} from './operations-presenters';
import type { OperationsController } from './use-operations';
type Props = Pick<
  OperationsController,
  | 'operationsState'
  | 'setHistoryClient'
  | 'openClient'
  | 'today'
  | 'setSelectedClient'
  | 'setDialog'
> & {
  clientId: string;
  onNavigate: (destination: 'central' | 'activities') => void;
};
export default function ClientHistory({
  clientId,
  operationsState,
  setHistoryClient,
  openClient,
  today,
  setSelectedClient,
  setDialog,
  onNavigate,
}: Props) {
  const id = clientId;
  const client = operationsState.clients.find((c) => c.id === id);
  if (!client) return null;
  const paymentTerms = client.paymentTerms;
  const installments = operationsState.installments.filter((p) => p.clientId === id),
    activities = operationsState.activities.filter((a) => a.clientId === id),
    negotiations = operationsState.negotiations.filter((n) => n.clientId === id);
  const ids = new Set([
    id,
    ...installments.map((p) => p.id),
    ...operationsState.pending.filter((t) => t.clientId === id).map((t) => t.id),
    ...negotiations.map((n) => n.id),
  ]);
  return (
    <section className={styles.card}>
      <div className={styles.cardhead}>
        <div>
          <p className={styles.eyebrow}>HISTÓRICO DO CLIENTE</p>
          <h2>{client.name}</h2>
          <p className={styles.subhead}>
            {client.crmRef || 'Sem referência CRM'} · {financialLabels[client.financialStatus]} ·{' '}
            {serviceLabels[client.serviceStatus]}
          </p>
        </div>
        <button
          className={styles.iconbtn}
          onClick={() => setHistoryClient('')}
          aria-label="Fechar histórico"
        >
          <X />
        </button>
      </div>
      {client.paymentTerms && (
        <div className={styles.note}>
          <div>
            <strong>Negócio contratado</strong>
            <p>{client.paymentTerms.purchaseDescription || 'Não informado'}</p>
            <p>
              {client.paymentTerms.installmentCount ?? 'Quantidade não informada'} parcela(s)
              {' · '}
              {
                (
                  {
                    monthly: 'Mensal',
                    biweekly: 'A cada 15 dias',
                    weekly: 'Semanal',
                    one_time: 'Pagamento único',
                  } as const
                )[client.paymentTerms.frequency]
              }
              {client.paymentTerms.installmentAmountCents
                ? ` · ${money(client.paymentTerms.installmentAmountCents)} por parcela`
                : ''}
              {client.paymentTerms.dueDay
                ? ` · Vencimento habitual: dia ${client.paymentTerms.dueDay}`
                : ''}
              {client.paymentTerms.firstDueDate
                ? ` · Primeiro vencimento: ${fmt(client.paymentTerms.firstDueDate)}`
                : ''}
            </p>
            <small>
              Condições cadastradas; parcelas e pagamentos são controlados separadamente.
            </small>
          </div>
        </div>
      )}
      <p>{client.notes}</p>
      <div className={op.actions}>
        <button className={styles.secondary} onClick={() => onNavigate('central')}>
          Próximas ações na Central
        </button>
        <button className={styles.secondary} onClick={() => onNavigate('activities')}>
          Atividades e relatórios
        </button>
        <button
          className={styles.secondary}
          onClick={() => openClient('service', 'Registrar bloqueio / desbloqueio', client)}
        >
          Registrar atendimento
        </button>
        <button
          className={styles.secondary}
          onClick={() => openClient('external', 'Encaminhar para cobrança externa', client)}
        >
          Encaminhar para cobrança externa
        </button>
        <button
          className={styles.secondary}
          onClick={() => openClient('record_contact', 'Registrar contato', client)}
        >
          Registrar contato
        </button>
        <button
          className={styles.secondary}
          onClick={() => openClient('save_negotiation', 'Registrar renegociação', client)}
        >
          Nova renegociação
        </button>
      </div>
      {!installments.length && paymentTerms && (
        <section className={styles.note}>
          {(() => {
            let planned;
            try {
              planned = buildInstallmentPlan(paymentTerms);
            } catch (error) {
              return (
                <div>
                  Para gerar as parcelas, complete quantidade, valor por parcela e primeiro
                  vencimento no cadastro do cliente. {error instanceof Error ? error.message : ''}
                </div>
              );
            }
            const total = planned.reduce((sum, installment) => sum + installment.amountCents, 0);
            return (
              <div>
                <strong>
                  Prévia: {planned.length} parcelas · Total {money(total)}
                </strong>
                <p>
                  Primeira: {fmt(planned[0].dueDate)} · Última:{' '}
                  {fmt(planned[planned.length - 1].dueDate)}
                </p>
                <p>
                  {planned
                    .slice(0, 3)
                    .map(
                      (item) =>
                        `#${item.number}: ${fmt(item.dueDate)} (${money(item.amountCents)})`,
                    )
                    .join(' | ')}
                </p>
                <button
                  className={styles.primary}
                  onClick={() =>
                    openClient('generate_installments', 'Revisar e gerar parcelas', client)
                  }
                >
                  Confirmar geração das parcelas
                </button>
              </div>
            );
          })()}
        </section>
      )}
      <h3>Parcelas e valores registrados</h3>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Vencimento</th>
              <th>Original / encargos</th>
              <th>Pago / saldo</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {installments.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.reference} · {p.number}
                </td>
                <td>
                  {fmt(p.dueDate)}
                  {isOverdue(p, today) && (
                    <small className={op.overdue}>
                      {calendarDaysBetween(p.dueDate, today)} dias corridos em atraso
                    </small>
                  )}
                </td>
                <td>
                  {money(p.amountCents)}
                  <small className={op.detail}>
                    {p.chargeStatus === 'applied'
                      ? money(p.chargesCents) + ' aplicados'
                      : p.chargeStatus === 'verify'
                        ? 'Multa/encargos a verificar'
                        : 'Encargos não aplicáveis'}
                  </small>
                </td>
                <td>
                  {money(p.paidCents)} / {money(outstandingCents(p))}
                  {p.paidDate && (
                    <small className={op.detail}>Último pagamento: {fmt(p.paidDate)}</small>
                  )}
                </td>
                <td>
                  {p.status === 'paid'
                    ? p.historicalPaid
                      ? 'Quitada (histórico)'
                      : 'Quitada'
                    : p.status === 'partial'
                      ? 'Pagamento parcial'
                      : p.status === 'cancelled'
                        ? 'Cancelada'
                        : p.verificationStatus === 'unverified'
                          ? 'Situação a verificar'
                          : isOverdue(p, today)
                            ? 'Vencida'
                            : 'Em aberto'}
                  {p.scheduledDate && p.status !== 'paid' && (
                    <small className={op.detail}>
                      Previsto: {fmt(p.scheduledDate)} (sem confirmação)
                    </small>
                  )}
                </td>
                <td>
                  {p.status === 'paid' || p.status === 'cancelled' ? (
                    <span className={op.installmentNoActions}>
                      {p.status === 'paid' ? 'Nenhuma ação pendente' : 'Parcela cancelada'}
                    </span>
                  ) : (
                    <div className={op.installmentActions}>
                      {p.verificationStatus === 'unverified' ? (
                        <button
                          className={op.actionReview}
                          onClick={() =>
                            openClient('verify_installment', 'Verificar situação da parcela', client, p)
                          }
                        >
                          <ClipboardCheck size={16} /> Verificar situação
                        </button>
                      ) : (
                        <button
                          className={op.actionPayment}
                          onClick={() =>
                            openClient('confirm_payment', 'Registrar pagamento identificado', client, p)
                          }
                        >
                          <CircleCheck size={16} /> Registrar pagamento
                        </button>
                      )}
                      <details className={op.installmentMore}>
                        <summary>Mais ações</summary>
                        <div className={op.installmentMoreMenu}>
                          {p.verificationStatus === 'unverified' && (
                            <button
                              type="button"
                              onClick={() =>
                                openClient('confirm_payment', 'Registrar pagamento identificado', client, p)
                              }
                            >
                              <CircleCheck size={15} /> Registrar pagamento identificado
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              openClient('schedule_payment', 'Registrar previsão de pagamento', client, p)
                            }
                          >
                            <CalendarClock size={15} /> Previsão de pagamento
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openClient('save_installment', 'Editar parcela', client, p)
                            }
                          >
                            <Pencil size={15} /> Editar parcela
                          </button>
                        </div>
                      </details>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!installments.length && (
        <p className={styles.empty}>
          Sem parcelas. Cadastre vencimentos e valores para habilitar a régua.
        </p>
      )}
      <h3>Renegociações</h3>
      {negotiations.map((n) => (
        <div key={n.id} className={op.history}>
          <b>
            {negotiationLabels[n.status]} · {fmt(n.requestedDate)}
          </b>
          <p>{n.proposal}</p>
          <small>
            {n.approvedDate ? 'Aprovação: ' + fmt(n.approvedDate) : 'Sem aprovação registrada'}
            {n.suspensionUntil ? ' · Suspensão autorizada até ' + fmt(n.suspensionUntil) : ''}
          </small>
          <p>{n.authorizedTerms}</p>
          <button
            className={styles.secondary}
            onClick={() => {
              setSelectedClient(client.id);
              setDialog({
                type: 'save_negotiation',
                title: 'Atualizar renegociação',
                client,
                negotiation: n,
              });
            }}
          >
            Registrar decisão
          </button>
        </div>
      ))}
      <h3>Atividades efetivamente registradas</h3>
      {activities
        .slice()
        .reverse()
        .map((a) => (
          <div key={a.id} className={op.history}>
            <b>
              {fmt(a.date)} · {activityLabel(a)} · {channelLabels[a.channel]}
            </b>
            <p>{a.result}</p>
            <p>{a.notes}</p>
            <small>
              Responsável: {a.responsible} ·{' '}
              {a.source === 'legacy'
                ? 'Legado (horario nao informado)'
                : new Date(a.occurredAt).toLocaleString('pt-BR', {
                    timeZone: operationsState.settings.timezone,
                  })}
            </small>
          </div>
        ))}
      {!activities.length && (
        <p className={styles.empty}>
          Nenhuma nova atividade operacional. Os registros legados permanecem na área Atividades.
        </p>
      )}
      <h3>Histórico de alterações e reagendamentos</h3>
      {operationsState.audit
        .filter((a) => ids.has(a.entityId))
        .slice()
        .reverse()
        .map((a) => (
          <details key={a.id} className={op.history}>
            <summary>
              {new Date(a.at).toLocaleString('pt-BR', {
                timeZone: operationsState.settings.timezone,
              })}{' '}
              · {a.reason}
            </summary>
            <pre className={op.audit}>
              {JSON.stringify({ antes: a.before, depois: a.after }, null, 2)}
            </pre>
          </details>
        ))}
    </section>
  );
}
