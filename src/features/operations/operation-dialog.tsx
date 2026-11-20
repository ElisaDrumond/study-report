'use client';
import { CheckCircle2, X } from 'lucide-react';
import op from '../../../app/operations.module.css';
import styles from '../../../app/page.module.css';
import { shiftDate } from '../../../lib/business-calendar';
import { buildInstallmentPlan } from '../../../lib/installment-plan';
import { negotiationLabels, outstandingCents } from '../../../lib/collection-status';
import Field from '../../components/ui/form-field';
import { amountInput, channelLabels, money } from './operations-presenters';
import type { OperationsController } from './use-operations';
type Props = Pick<
  OperationsController,
  | 'activeDialog'
  | 'busy'
  | 'setDialog'
  | 'setError'
  | 'submit'
  | 'operationId'
  | 'selectedInstallment'
  | 'today'
  | 'selectedNegotiation'
  | 'operationsState'
  | 'exception'
  | 'collectionKinds'
  | 'error'
>;
export default function OperationDialog({
  activeDialog,
  busy,
  setDialog,
  setError,
  submit,
  operationId,
  selectedInstallment,
  today,
  selectedNegotiation,
  operationsState,
  exception,
  collectionKinds,
  error,
}: Props) {
  if (!activeDialog) return null;
  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={activeDialog.title}>
        <div className={styles.modalHead}>
          <h2>{activeDialog.title}</h2>
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
            activeDialog.type,
            activeDialog.client?.id,
            activeDialog.installment?.id,
            activeDialog.negotiation?.id,
            activeDialog.exceptionId,
          ])}
        >
          <input type="hidden" name="operationId" value={operationId} />
          <fieldset disabled={busy} className={op.fieldset}>
            <div className={styles.formGrid}>
              {activeDialog.client && (
                <p className={styles.wide}>
                  {activeDialog.client.name}
                  {selectedInstallment
                    ? ' · ' +
                      selectedInstallment.reference +
                      ' · parcela ' +
                      selectedInstallment.number
                    : ''}
                </p>
              )}
              {activeDialog.type === 'save_client' && (
                <>
                  <Field label="Nome completo" wide>
                    <input name="name" required defaultValue={activeDialog.client?.name} />
                  </Field>
                  <Field label="Referência externa CRM">
                    <input name="crmRef" defaultValue={activeDialog.client?.crmRef} />
                  </Field>
                  <Field label="Tipo de negócio / O que comprou" wide>
                    <textarea
                      name="purchaseDescription"
                      rows={2}
                      maxLength={500}
                      placeholder="Ex.: Curso profissionalizante de elétrica"
                      defaultValue={activeDialog.client?.paymentTerms?.purchaseDescription ?? ''}
                    />
                  </Field>
                  <Field label="Quantidade de parcelas contratadas">
                    <input
                      name="installmentCount"
                      type="number"
                      min="1"
                      max="240"
                      step="1"
                      placeholder="Ex.: 12"
                      defaultValue={activeDialog.client?.paymentTerms?.installmentCount ?? ''}
                    />
                  </Field>
                  <Field label="Valor de cada parcela (US$)">
                    <input
                      name="installmentAmount"
                      inputMode="decimal"
                      placeholder="Ex.: 350.00"
                      defaultValue={activeDialog.client?.paymentTerms?.installmentAmountCents
                        ? amountInput(activeDialog.client.paymentTerms.installmentAmountCents)
                        : ''}
                    />
                  </Field>
                  <Field label="Periodicidade do pagamento">
                    <select
                      name="frequency"
                      defaultValue={activeDialog.client?.paymentTerms?.frequency ?? 'monthly'}
                    >
                      <option value="monthly">Mensal</option>
                      <option value="biweekly">A cada 15 dias</option>
                      <option value="weekly">Semanal</option>
                      <option value="one_time">Pagamento único</option>
                    </select>
                  </Field>
                  <Field label="Dia habitual do vencimento (mensal)">
                    <input
                      name="dueDay"
                      type="number"
                      min="1"
                      max="31"
                      step="1"
                      placeholder="Ex.: 5"
                      defaultValue={activeDialog.client?.paymentTerms?.dueDay ?? ''}
                    />
                  </Field>
                  <Field label="Data do primeiro vencimento (opcional)">
                    <input
                      name="firstDueDate"
                      type="date"
                      defaultValue={activeDialog.client?.paymentTerms?.firstDueDate ?? ''}
                    />
                  </Field>
                  <div className={`${styles.note} ${styles.wide}`}>
                    Após salvar, revise a prévia e confirme a geração das parcelas no histórico.
                    Pagamentos, reagendamentos e multas exigem registro manual.
                  </div>
                  <Field label="Observações" wide>
                    <textarea name="notes" defaultValue={activeDialog.client?.notes} />
                  </Field>
                </>
              )}
              {activeDialog.type === 'generate_installments' && activeDialog.client?.paymentTerms && (
                <>
                  {(() => {
                    try {
                      const preview = buildInstallmentPlan(activeDialog.client.paymentTerms!);
                      return (
                        <div className={`${styles.note} ${styles.wide}`}>
                          <strong>{preview.length} parcelas · Total {money(
                            preview.reduce((sum, installment) => sum + installment.amountCents, 0),
                          )}</strong>
                          <p>
                            Primeiro vencimento: {preview[0].dueDate} · Último vencimento:
                            {' '}{preview[preview.length - 1].dueDate}
                          </p>
                          <p>Confira os valores e datas antes de confirmar. Nada será enviado automaticamente.</p>
                        </div>
                      );
                    } catch (error) {
                      return <p className={styles.alert}>{error instanceof Error ? error.message : 'Contrato incompleto'}</p>;
                    }
                  })()}
                  <Field label="Identificador do contrato" wide>
                    <input
                      name="reference"
                      required
                      defaultValue={activeDialog.client.crmRef || activeDialog.client.paymentTerms.purchaseDescription}
                    />
                  </Field>
                </>
              )}
              {activeDialog.type === 'save_installment' && (
                <>
                  <Field label="Contrato / identificador">
                    <input
                      name="reference"
                      required
                      defaultValue={selectedInstallment?.reference}
                    />
                  </Field>
                  <Field label="Número da parcela">
                    <input
                      name="number"
                      type="number"
                      min="1"
                      step="1"
                      required
                      defaultValue={selectedInstallment?.number || 1}
                    />
                  </Field>
                  <Field label="Valor original (US$)">
                    <input
                      name="amount"
                      inputMode="decimal"
                      required
                      defaultValue={
                        selectedInstallment ? amountInput(selectedInstallment.amountCents) : ''
                      }
                    />
                  </Field>
                  <Field label="Vencimento">
                    <input
                      name="dueDate"
                      type="date"
                      required
                      defaultValue={selectedInstallment?.dueDate || today}
                    />
                  </Field>
                  <Field label="Encargos registrados (US$)">
                    <input
                      name="charges"
                      inputMode="decimal"
                      required
                      defaultValue={amountInput(selectedInstallment?.chargesCents || 0)}
                    />
                  </Field>
                  <Field label="Situação do encargo">
                    <select
                      name="chargeStatus"
                      defaultValue={selectedInstallment?.chargeStatus || 'verify'}
                    >
                      <option value="verify">A verificar (não integra saldo)</option>
                      <option value="applied">Aplicado manualmente</option>
                      <option value="not_applicable">Não aplicável</option>
                    </select>
                  </Field>
                  {selectedInstallment && (
                    <Field label="Justificativa da alteração" wide>
                      <textarea name="reason" required />
                    </Field>
                  )}
                </>
              )}
              {activeDialog.type === 'schedule_payment' && (
                <Field label="Data prevista (não confirma pagamento)" wide>
                  <input
                    name="scheduledDate"
                    type="date"
                    min={today}
                    required
                    defaultValue={selectedInstallment?.scheduledDate || today}
                  />
                </Field>
              )}
              {activeDialog.type === 'verify_installment' && (
                <div className={`${styles.note} ${styles.wide}`}>
                  Confirme apenas após conferir no sistema financeiro da Study que esta parcela
                  permanece em aberto. Isso NÃO é a tarefa de conciliação da Study e não confirma pagamento.
                  Se já foi paga, use a ação Confirmar pagamento da parcela.
                </div>
              )}
              {activeDialog.type === 'confirm_payment' && (
                <>
                  <div className={`${styles.note} ${styles.wide}`}>
                    Confirme apenas o valor efetivamente identificado. O pagamento afeta somente
                    esta parcela. Saldo em aberto:{' '}
                    {money(selectedInstallment ? outstandingCents(selectedInstallment) : 0)}.
                  </div>
                  <Field label="Valor recebido nesta confirmação (US$)">
                    <input
                      name="amount"
                      inputMode="decimal"
                      required
                      defaultValue={
                        selectedInstallment
                          ? amountInput(outstandingCents(selectedInstallment))
                          : ''
                      }
                    />
                  </Field>
                  <Field label="Data efetiva do pagamento">
                    <input type="date" name="paidDate" max={today} defaultValue={today} required />
                  </Field>
                </>
              )}
              {activeDialog.type === 'save_negotiation' && (
                <>
                  <Field label="Parcelas envolvidas" wide>
                    <select
                      name="installmentIds"
                      multiple
                      required
                      size={4}
                      defaultValue={selectedNegotiation?.installmentIds || []}
                    >
                      {operationsState.installments
                        .filter((installment) => installment.clientId === activeDialog.client?.id)
                        .map((installment) => (
                          <option key={installment.id} value={installment.id}>
                            {installment.reference} · {installment.number} ·{' '}
                            {money(outstandingCents(installment))}
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
                      defaultValue={selectedNegotiation?.requestedDate || today}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      name="status"
                      defaultValue={selectedNegotiation?.status || 'proposal_received'}
                    >
                      {Object.entries(negotiationLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Proposta recebida" wide>
                    <textarea
                      name="proposal"
                      required
                      defaultValue={selectedNegotiation?.proposal}
                    />
                  </Field>
                  <Field label="Data da aprovação registrada">
                    <input
                      name="approvedDate"
                      type="date"
                      max={today}
                      defaultValue={selectedNegotiation?.approvedDate}
                    />
                  </Field>
                  <Field label="Suspensão autorizada até (opcional)">
                    <input
                      name="suspensionUntil"
                      type="date"
                      defaultValue={selectedNegotiation?.suspensionUntil}
                    />
                  </Field>
                  <Field label="Condições autorizadas pela gestão" wide>
                    <textarea
                      name="authorizedTerms"
                      defaultValue={selectedNegotiation?.authorizedTerms}
                    />
                  </Field>
                  <p className={`${styles.note} ${styles.wide}`}>
                    Para formalizar um acordo, registre primeiro a aprovação. Enquanto aguarda
                    decisão, as cobranças incompatíveis ficam suspensas até a data autorizada ou a
                    decisão. Valores e contratos não são alterados automaticamente.
                  </p>
                </>
              )}
              {activeDialog.type === 'save_calendar' && (
                <>
                  <Field label="Data inicial">
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={exception?.date || activeDialog.calendarDate || today}
                    />
                  </Field>
                  {!exception && (
                    <Field label="Data final do recesso (opcional)">
                      <input name="endDate" type="date" />
                    </Field>
                  )}
                  <Field label="Tipo de exceção">
                    <select name="exceptionType" defaultValue={exception?.type || 'non_business'}>
                      <option value="non_business">Dia não útil</option>
                      <option value="business">Dia útil excepcional</option>
                    </select>
                  </Field>
                  <Field label="Descrição / motivo" wide>
                    <input name="description" required defaultValue={exception?.description} />
                  </Field>
                </>
              )}
              {activeDialog.type === 'save_settings' && (
                <>
                  <Field label="Fuso horário operacional" wide>
                    <input
                      name="timezone"
                      required
                      defaultValue={operationsState.settings.timezone}
                    />
                  </Field>
                  {(
                    [
                      ['advanceDays', 'Antecedência do aviso (dias corridos)'],
                      ['followupBusinessDays', 'Janela de acompanhamento (dias úteis)'],
                      ['alternateBusinessDays', 'Intervalo de cobrança (dias úteis)'],
                      ['externalReviewDays', 'Atraso para sugerir análise externa (dias corridos)'],
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
                        defaultValue={operationsState.settings[key]}
                      />
                    </Field>
                  ))}
                  <p className={`${styles.note} ${styles.wide}`}>
                    D-15 e lembrete do vencimento são antecipados ao dia útil anterior. A multa é
                    apenas sinalizada, nunca calculada ou aplicada automaticamente.
                  </p>
                </>
              )}
              {activeDialog.type === 'defer_task' && (
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
              {activeDialog.type === 'service' && (
                <>
                  <Field label="Situação após a ação manual" wide>
                    <select
                      name="serviceStatus"
                      defaultValue={activeDialog.task?.kind === 'block' ? 'blocked' : 'active'}
                    >
                      <option value="blocked">Atendimento bloqueado</option>
                      <option value="active">Atendimento ativo</option>
                    </select>
                  </Field>
                  <label className={`${op.checkbox} ${styles.wide}`}>
                    <input name="authorizedOverride" type="checkbox" /> Há decisão autorizada para
                    desbloqueio mesmo com parcelas vencidas (descreva abaixo).
                  </label>
                </>
              )}
              {['complete_task', 'record_contact'].includes(activeDialog.type) && (
                <>
                  <Field label="Canal utilizado">
                    <select
                      name="channel"
                      defaultValue={
                        activeDialog.task?.kind === 'advance'
                          ? 'both'
                          : activeDialog.task?.kind === 'due'
                            ? 'whatsapp'
                            : activeDialog.type === 'record_contact' ||
                                (activeDialog.task &&
                                  collectionKinds.includes(activeDialog.task.kind))
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
                  {activeDialog.task?.kind === 'fine' && (
                    <>
                      <Field label="Resultado da verificação de encargos">
                        <select name="chargeStatus">
                          <option value="not_applicable">Não aplicável</option>
                          <option value="applied">Aplicado manualmente conforme contrato</option>
                        </select>
                      </Field>
                      <Field label="Encargo efetivamente registrado (US$)">
                        <input name="charges" required defaultValue="0.00" inputMode="decimal" />
                      </Field>
                    </>
                  )}
                </>
              )}
              {activeDialog.type === 'management' && (
                <Field label="Encaminhamento / solicitação de análise" wide>
                  <textarea name="result" required />
                </Field>
              )}
              {![
                'save_client',
                'save_installment',
                'save_calendar',
                'save_settings',
              ].includes(activeDialog.type) && (
                <>
                  <Field label="Responsável pelo registro" wide>
                    <select name="responsible" required defaultValue="Elisa Anjo">
                      <option value="Elisa Anjo">Elisa Anjo</option>
                    </select>
                  </Field>
                  <Field
                    label={
                      activeDialog.type === 'external'
                        ? 'Justificativa obrigatória'
                        : 'Observações / referência do registro corporativo'
                    }
                    wide
                  >
                    <textarea name="notes" required={activeDialog.type === 'external'} />
                  </Field>
                  {['generate_installments', 'confirm_payment', 'verify_installment', 'service', 'external', 'save_negotiation'].includes(
                    activeDialog.type,
                  ) && (
                    <label className={`${op.checkbox} ${styles.wide}`}>
                      <input type="checkbox" name="confirmed" required /> Confirmo que a ação ou
                      autorização foi verificada manualmente. Nenhuma comunicação será enviada pelo
                      sistema.
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
              <button className={styles.secondary} type="button" onClick={() => setDialog(null)}>
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
  );
}
