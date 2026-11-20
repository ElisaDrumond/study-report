'use client';
import { X } from 'lucide-react';
import op from '../../../app/operations.module.css';
import styles from '../../../app/page.module.css';
import {
calendarDaysBetween
} from '../../../lib/business-calendar';
import { isOverdue,negotiationLabels,outstandingCents } from '../../../lib/collection-status';
import { fmt } from '../../../lib/rules';
import { activityLabel,channelLabels,financialLabels,money,serviceLabels } from './operations-presenters';
import type { OperationsController } from './use-operations';
type Props=Pick<OperationsController,"s"|"setHistoryClient"|"openClient"|"today"|"setSelectedClient"|"setDialog">&{clientId:string};
export default function ClientHistory({clientId,s,setHistoryClient,openClient,today,setSelectedClient,setDialog}:Props){const id=clientId;
    const client = s.clients.find((c) => c.id === id);
    if (!client) return null;
    const installments = s.installments.filter((p) => p.clientId === id),
      activities = s.activities.filter((a) => a.clientId === id),
      negotiations = s.negotiations.filter((n) => n.clientId === id);
    const ids = new Set([
      id,
      ...installments.map((p) => p.id),
      ...s.pending.filter((t) => t.clientId === id).map((t) => t.id),
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
        <p>{client.notes}</p>
        <div className={op.actions}>
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
                      ? 'Quitada'
                      : p.status === 'partial'
                        ? 'Pagamento parcial'
                        : p.status === 'cancelled'
                          ? 'Cancelada'
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
                    <div className={op.actions}>
                      <button
                        className={styles.secondary}
                        disabled={p.status === 'paid'}
                        onClick={() => openClient('save_installment', 'Editar parcela', client, p)}
                      >
                        Editar
                      </button>
                      <button
                        className={styles.secondary}
                        disabled={p.status === 'paid' || p.status === 'cancelled'}
                        onClick={() =>
                          openClient('confirm_payment', 'Confirmar pagamento da parcela', client, p)
                        }
                      >
                        Confirmar pagamento
                      </button>
                      <button
                        className={styles.secondary}
                        disabled={p.status === 'paid' || p.status === 'cancelled'}
                        onClick={() =>
                          openClient('schedule_payment', 'Agendar pagamento', client, p)
                        }
                      >
                        Agendar
                      </button>
                    </div>
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
                      timeZone: s.settings.timezone,
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
        {s.audit
          .filter((a) => ids.has(a.entityId))
          .slice()
          .reverse()
          .map((a) => (
            <details key={a.id} className={op.history}>
              <summary>
                {new Date(a.at).toLocaleString('pt-BR', { timeZone: s.settings.timezone })} ·{' '}
                {a.reason}
              </summary>
              <pre className={op.audit}>
                {JSON.stringify({ antes: a.before, depois: a.after }, null, 2)}
              </pre>
            </details>
          ))}
      </section>
    );
  }
