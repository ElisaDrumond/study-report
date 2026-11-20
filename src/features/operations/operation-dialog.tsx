'use client';
import { CheckCircle2,X } from 'lucide-react';
import op from '../../../app/operations.module.css';
import styles from '../../../app/page.module.css';
import {
shiftDate
} from '../../../lib/business-calendar';
import { negotiationLabels,outstandingCents } from '../../../lib/collection-status';
import Field from '../../components/ui/form-field';
import { amountInput,channelLabels,money } from './operations-presenters';
import type { OperationsController } from './use-operations';
type Props=Pick<OperationsController,"d"|"busy"|"setDialog"|"setError"|"submit"|"operationId"|"p"|"today"|"n"|"s"|"exception"|"collectionKinds"|"error">;
export default function OperationDialog({d,busy,setDialog,setError,submit,operationId,p,today,n,s,exception,collectionKinds,error}:Props){if(!d)return null;return ((
        <div className={styles.modalBackdrop}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={d.title}>
            <div className={styles.modalHead}>
              <h2>{d.title}</h2>
              <button
                className={styles.iconbtn}
                disabled={busy}
                onClick={() => {
                  setDialog(null);
                  setError('');
                }}
                aria-label="Fechar"
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={submit}
              key={JSON.stringify([
                d.type,
                d.client?.id,
                d.installment?.id,
                d.negotiation?.id,
                d.exceptionId,
              ])}
            >
              <input type="hidden" name="operationId" value={operationId} />
              <fieldset disabled={busy} className={op.fieldset}>
                <div className={styles.formGrid}>
                  {d.client && (
                    <p className={styles.wide}>
                      {d.client.name}
                      {p ? ' · ' + p.reference + ' · parcela ' + p.number : ''}
                    </p>
                  )}
                  {d.type === 'save_client' && (
                    <>
                      <Field label="Nome completo" wide>
                        <input name="name" required defaultValue={d.client?.name} />
                      </Field>
                      <Field label="Referência externa CRM">
                        <input name="crmRef" defaultValue={d.client?.crmRef} />
                      </Field>
                      <Field label="Observações" wide>
                        <textarea name="notes" defaultValue={d.client?.notes} />
                      </Field>
                    </>
                  )}
                  {d.type === 'save_installment' && (
                    <>
                      <Field label="Contrato / identificador">
                        <input name="reference" required defaultValue={p?.reference} />
                      </Field>
                      <Field label="Número da parcela">
                        <input
                          name="number"
                          type="number"
                          min="1"
                          step="1"
                          required
                          defaultValue={p?.number || 1}
                        />
                      </Field>
                      <Field label="Valor original (R$)">
                        <input
                          name="amount"
                          inputMode="decimal"
                          required
                          defaultValue={p ? amountInput(p.amountCents) : ''}
                        />
                      </Field>
                      <Field label="Vencimento">
                        <input
                          name="dueDate"
                          type="date"
                          required
                          defaultValue={p?.dueDate || today}
                        />
                      </Field>
                      <Field label="Encargos registrados (R$)">
                        <input
                          name="charges"
                          inputMode="decimal"
                          required
                          defaultValue={amountInput(p?.chargesCents || 0)}
                        />
                      </Field>
                      <Field label="Situação do encargo">
                        <select name="chargeStatus" defaultValue={p?.chargeStatus || 'verify'}>
                          <option value="verify">A verificar (não integra saldo)</option>
                          <option value="applied">Aplicado manualmente</option>
                          <option value="not_applicable">Não aplicável</option>
                        </select>
                      </Field>
                      {p && (
                        <Field label="Justificativa da alteração" wide>
                          <textarea name="reason" required />
                        </Field>
                      )}
                    </>
                  )}
                  {d.type === 'schedule_payment' && (
                    <Field label="Data prevista (não confirma pagamento)" wide>
                      <input
                        name="scheduledDate"
                        type="date"
                        min={today}
                        required
                        defaultValue={p?.scheduledDate || today}
                      />
                    </Field>
                  )}
                  {d.type === 'confirm_payment' && (
                    <>
                      <div className={`${styles.note} ${styles.wide}`}>
                        Confirme apenas o valor efetivamente identificado. O pagamento afeta somente
                        esta parcela. Saldo em aberto: {money(p ? outstandingCents(p) : 0)}.
                      </div>
                      <Field label="Valor recebido nesta confirmação (R$)">
                        <input
                          name="amount"
                          inputMode="decimal"
                          required
                          defaultValue={p ? amountInput(outstandingCents(p)) : ''}
                        />
                      </Field>
                      <Field label="Data efetiva do pagamento">
                        <input
                          type="date"
                          name="paidDate"
                          max={today}
                          defaultValue={today}
                          required
                        />
                      </Field>
                    </>
                  )}
                  {d.type === 'save_negotiation' && (
                    <>
                      <Field label="Parcelas envolvidas" wide>
                        <select
                          name="installmentIds"
                          multiple
                          required
                          size={4}
                          defaultValue={n?.installmentIds || []}
                        >
                          {s.installments
                            .filter((p) => p.clientId === d.client?.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.reference} · {p.number} · {money(outstandingCents(p))}
                              </option>
                            ))}
                        </select>
                        <small>Use Ctrl para selecionar mais de uma parcela.</small>
                      </Field>
                      <Field label="Data da solicitação">
                        <input
                          name="requestedDate"
                          type="date"
                          max={today}
                          required
                          defaultValue={n?.requestedDate || today}
                        />
                      </Field>
                      <Field label="Status">
                        <select name="status" defaultValue={n?.status || 'proposal_received'}>
                          {Object.entries(negotiationLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Proposta recebida" wide>
                        <textarea name="proposal" required defaultValue={n?.proposal} />
                      </Field>
                      <Field label="Data da aprovação registrada">
                        <input
                          name="approvedDate"
                          type="date"
                          max={today}
                          defaultValue={n?.approvedDate}
                        />
                      </Field>
                      <Field label="Suspensão autorizada até (opcional)">
                        <input
                          name="suspensionUntil"
                          type="date"
                          defaultValue={n?.suspensionUntil}
                        />
                      </Field>
                      <Field label="Condições autorizadas pela gestão" wide>
                        <textarea name="authorizedTerms" defaultValue={n?.authorizedTerms} />
                      </Field>
                      <p className={`${styles.note} ${styles.wide}`}>
                        Para formalizar um acordo, registre primeiro a aprovação. Enquanto aguarda
                        decisão, as cobranças incompatíveis ficam suspensas até a data autorizada ou
                        a decisão. Valores e contratos não são alterados automaticamente.
                      </p>
                    </>
                  )}
                  {d.type === 'save_calendar' && (
                    <>
                      <Field label="Data inicial">
                        <input
                          name="date"
                          type="date"
                          required
                          defaultValue={exception?.date || d.calendarDate || today}
                        />
                      </Field>
                      {!exception && (
                        <Field label="Data final do recesso (opcional)">
                          <input name="endDate" type="date" />
                        </Field>
                      )}
                      <Field label="Tipo de exceção">
                        <select
                          name="exceptionType"
                          defaultValue={exception?.type || 'non_business'}
                        >
                          <option value="non_business">Dia não útil</option>
                          <option value="business">Dia útil excepcional</option>
                        </select>
                      </Field>
                      <Field label="Descrição / motivo" wide>
                        <input name="description" required defaultValue={exception?.description} />
                      </Field>
                    </>
                  )}
                  {d.type === 'save_settings' && (
                    <>
                      <Field label="Fuso horário operacional" wide>
                        <input name="timezone" required defaultValue={s.settings.timezone} />
                      </Field>
                      {(
                        [
                          ['advanceDays', 'Antecedência do aviso (dias corridos)'],
                          ['followupBusinessDays', 'Janela de acompanhamento (dias úteis)'],
                          ['alternateBusinessDays', 'Intervalo de cobrança (dias úteis)'],
                          [
                            'externalReviewDays',
                            'Atraso para sugerir análise externa (dias corridos)',
                          ],
                          ['finePercent', 'Multa a verificar (%)'],
                        ] as const
                      ).map(([key, label]) => (
                        <Field label={label} key={key}>
                          <input
                            type="number"
                            name={key}
                            min="1"
                            max="365"
                            step="1"
                            required
                            defaultValue={s.settings[key]}
                          />
                        </Field>
                      ))}
                      <p className={`${styles.note} ${styles.wide}`}>
                        D-15 e lembrete do vencimento são antecipados ao dia útil anterior. A multa
                        é apenas sinalizada, nunca calculada ou aplicada automaticamente.
                      </p>
                    </>
                  )}
                  {d.type === 'defer_task' && (
                    <>
                      <Field label="Nova data (ajustada para o próximo dia útil)">
                        <input
                          name="dueDate"
                          type="date"
                          min={shiftDate(today, 1)}
                          required
                          defaultValue={shiftDate(today, 1)}
                        />
                      </Field>
                      <Field label="Justificativa" wide>
                        <textarea name="reason" required />
                      </Field>
                    </>
                  )}
                  {d.type === 'service' && (
                    <>
                      <Field label="Situação após a ação manual" wide>
                        <select
                          name="serviceStatus"
                          defaultValue={d.task?.kind === 'block' ? 'blocked' : 'active'}
                        >
                          <option value="blocked">Atendimento bloqueado</option>
                          <option value="active">Atendimento ativo</option>
                        </select>
                      </Field>
                      <label className={`${op.checkbox} ${styles.wide}`}>
                        <input name="authorizedOverride" type="checkbox" /> Há decisão autorizada
                        para desbloqueio mesmo com parcelas vencidas (descreva abaixo).
                      </label>
                    </>
                  )}
                  {['complete_task', 'record_contact'].includes(d.type) && (
                    <>
                      <Field label="Canal utilizado">
                        <select
                          name="channel"
                          defaultValue={
                            d.task?.kind === 'advance'
                              ? 'both'
                              : d.task?.kind === 'due'
                                ? 'whatsapp'
                                : d.type === 'record_contact' ||
                                    (d.task && collectionKinds.includes(d.task.kind))
                                  ? 'whatsapp'
                                  : 'system'
                          }
                        >
                          {Object.entries(channelLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Resultado efetivamente registrado" wide>
                        <textarea name="result" required />
                      </Field>
                      <label className={`${op.checkbox} ${styles.wide}`}>
                        <input name="awaitingReply" type="checkbox" /> Aguardando retorno do cliente
                      </label>
                      {d.task?.kind === 'fine' && (
                        <>
                          <Field label="Resultado da verificação de encargos">
                            <select name="chargeStatus">
                              <option value="not_applicable">Não aplicável</option>
                              <option value="applied">
                                Aplicado manualmente conforme contrato
                              </option>
                            </select>
                          </Field>
                          <Field label="Encargo efetivamente registrado (R$)">
                            <input
                              name="charges"
                              required
                              defaultValue="0.00"
                              inputMode="decimal"
                            />
                          </Field>
                        </>
                      )}
                    </>
                  )}
                  {d.type === 'management' && (
                    <Field label="Encaminhamento / solicitação de análise" wide>
                      <textarea name="result" required />
                    </Field>
                  )}
                  {![
                    'save_client',
                    'save_installment',
                    'save_calendar',
                    'save_settings',
                    'defer_task',
                  ].includes(d.type) && (
                    <>
                      <Field label="Responsável pelo registro" wide>
                        <input name="responsible" required autoComplete="name" />
                      </Field>
                      <Field
                        label={
                          d.type === 'external'
                            ? 'Justificativa obrigatória'
                            : 'Observações / referência do registro corporativo'
                        }
                        wide
                      >
                        <textarea name="notes" required={d.type === 'external'} />
                      </Field>
                      {['confirm_payment', 'service', 'external', 'save_negotiation'].includes(
                        d.type,
                      ) && (
                        <label className={`${op.checkbox} ${styles.wide}`}>
                          <input type="checkbox" name="confirmed" required /> Confirmo que a ação ou
                          autorização foi verificada manualmente. Nenhuma comunicação será enviada
                          pelo sistema.
                        </label>
                      )}
                    </>
                  )}
                </div>
                {error && (
                  <div className={styles.alert} role="alert">
                    {error}
                  </div>
                )}
                <div className={styles.modalFoot}>
                  <button
                    className={styles.secondary}
                    type="button"
                    onClick={() => setDialog(null)}
                  >
                    Cancelar
                  </button>
                  <button className={styles.primary} type="submit" disabled={busy}>
                    <CheckCircle2 size={16} />
                    {busy ? 'Registrando…' : 'Registrar'}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      ));}
