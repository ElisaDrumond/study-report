import { formatCurrency, isUnpaid, outstandingCents } from '../../collection-status';
import { buildInstallmentPlan } from '../../installment-plan';
import { applyHistoricalPayment, validateHistoricalPayments } from '../../historical-installments';
import { type Installment } from '../../collection-types';
import { audit, put } from '../../database/operations-repository';
import { date, money, pick, text } from '../../validation/operation-values';
import type { OperationContext } from '../operation-context';
export function handleInstallmentCommand(type: string, context: OperationContext) {
  const { command, database, state, today, now, getClient, getInstallment, resolve, activity } =
    context;
  if (type === 'generate_installments') {
    const client = getClient(command.clientId);
    if (state.installments.some((installment) => installment.clientId === client.id)) {
      throw Error('Este cliente já possui parcelas. Revise a carteira para evitar duplicação.');
    }
    if (!client.paymentTerms) throw Error('Cadastre primeiro as condições de pagamento');
    if (command.confirmed !== true) throw Error('Confirmação manual obrigatória');
    const reference = text(command.reference, 'Referência do contrato', true);
    const plan = buildInstallmentPlan(client.paymentTerms);
    const historical = validateHistoricalPayments(command.historicalPayments, plan, today);
    for (const draft of plan) {
      const base: Installment = {
        id: crypto.randomUUID(),
        clientId: client.id,
        reference,
        number: draft.number,
        amountCents: draft.amountCents,
        dueDate: draft.dueDate,
        paidDate: '',
        paidCents: 0,
        verificationStatus: draft.dueDate < today ? 'unverified' : 'verified',
        status: 'open',
        chargesCents: 0,
        chargeStatus: 'verify',
        scheduledDate: '',
        createdAt: now,
      };
      const installment = applyHistoricalPayment(base, historical.get(draft.number));
      put(database, 'op_installments', installment, true);
      audit(
        database,
        'installment',
        installment.id,
        null,
        installment,
        installment.historicalPaid
          ? 'Importação de pagamento histórico confirmado, sem atividade operacional retroativa'
          : 'Geração contratual confirmada manualmente',
      );
    }
  } else if (type === 'save_installment') {
    const c = getClient(command.clientId),
      old = state.installments.find((p) => p.id === command.id);
    if (old && old.clientId !== c.id)
      throw Error('Não é permitido transferir uma parcela entre clientes');
    const number = money(command.number, 'Número da parcela');
    if (number < 1) throw Error('Número da parcela obrigatório');
    const p: Installment = {
      id: old?.id || crypto.randomUUID(),
      clientId: c.id,
      reference: text(command.reference, 'Referência/contrato', true),
      number,
      amountCents: money(command.amountCents),
      dueDate: date(command.dueDate),
      paidDate: old?.paidDate || '',
      paidCents: old?.paidCents || 0,
      verificationStatus: old ? old.verificationStatus : 'unverified',
      collectionStartDate: old?.collectionStartDate,
      status: old?.status || 'open',
      chargesCents: money(command.chargesCents ?? 0, 'Encargos'),
      chargeStatus: pick(
        command.chargeStatus ?? 'verify',
        ['verify', 'applied', 'not_applicable'] as const,
        'Situação do encargo',
      ),
      scheduledDate: old?.scheduledDate || '',
      createdAt: old?.createdAt || now,
    };
    if (p.amountCents <= 0) throw Error('Valor original deve ser positivo');
    if (
      state.installments.some(
        (x) =>
          x.id !== p.id &&
          x.clientId === p.clientId &&
          x.reference === p.reference &&
          x.number === p.number,
      )
    )
      throw Error('Já existe essa parcela para o contrato');
    if (
      old?.status === 'paid' ||
      p.paidCents >= p.amountCents + (p.chargeStatus === 'applied' ? p.chargesCents : 0)
    )
      throw Error('Parcela quitada exige revisão específica; valores não foram alterados');
    const reason = old
      ? text(command.reason, 'Justificativa da alteração', true)
      : 'Cadastro manual';
    put(database, 'op_installments', p);
    audit(database, 'installment', p.id, old ?? null, p, reason);
  } else if (type === 'verify_installment') {
    if (command.confirmed !== true) throw Error('Confirmação manual obrigatória');
    const old = getInstallment(command.installmentId);
    if (!isUnpaid(old)) throw Error('A parcela já está quitada ou cancelada');
    if (old.verificationStatus === 'verified')
      throw Error('Situação da parcela já foi verificada');
    const updated: Installment = {
      ...old,
      verificationStatus: 'verified',
      collectionStartDate: today,
    };
    put(database, 'op_installments', updated);
    audit(database, 'installment', old.id, old, updated,
      'Verificação inicial: parcela segue em aberto, segundo conferência humana');
    activity({
      clientId: old.clientId,
      installmentId: old.id,
      action: 'payment_status_checked',
      category: 'verification',
      status: 'recorded',
      result: 'Situação da parcela conferida: pagamento ainda não confirmado. ' +
        'A régua pode propor ações a partir desta verificação.',
    });
  } else if (type === 'schedule_payment') {
    const old = getInstallment(command.installmentId);
    if (!isUnpaid(old)) throw Error('Parcela já quitada ou cancelada');
    const scheduledDate = date(command.scheduledDate);
    if (scheduledDate < today) throw Error('Agendamento deve ser hoje ou futuro');
    const p = { ...old, scheduledDate };
    put(database, 'op_installments', p);
    audit(database, 'installment', p.id, old, p, 'Pagamento previsto, sem confirmação');
    activity({
      clientId: p.clientId,
      installmentId: p.id,
      action: 'payment_scheduled',
      result: 'Pagamento previsto para ' + scheduledDate + '; ainda não confirmado.',
    });
  } else if (type === 'confirm_payment') {
    if (command.confirmed !== true) throw Error('Confirmação humana obrigatória');
    const old = getInstallment(command.installmentId),
      amountCents = money(command.amountCents, 'Valor recebido'),
      paidDate = date(command.paidDate);
    if (
      !isUnpaid(old) ||
      amountCents <= 0 ||
      amountCents > outstandingCents(old) ||
      paidDate > today
    )
      throw Error('Pagamento inválido para o saldo ou data da parcela');
    const paidCents = old.paidCents + amountCents,
      settled =
        paidCents >= old.amountCents + (old.chargeStatus === 'applied' ? old.chargesCents : 0);
    const p = {
      ...old,
      paidCents,
      paidDate,
      verificationStatus: 'verified' as const,
      status: settled ? ('paid' as const) : ('partial' as const),
    };
    put(database, 'op_installments', p);
    audit(database, 'installment', p.id, old, p, 'Pagamento confirmado manualmente');
    const a = activity({
      clientId: p.clientId,
      installmentId: p.id,
      action: 'payment_confirmed',
      category: 'payment',
      status: settled ? 'paid' : 'partial',
      amountCents,
      result: `Pagamento confirmado no controle local: ${formatCurrency(amountCents)}. ${settled ? 'Parcela quitada.' : 'Pagamento parcial; saldo permanece aberto.'} Data do pagamento: ${paidDate}.`,
    });
    if (settled)
      for (const task of state.pending.filter(
        (t) => t.installmentId === p.id && ['open', 'deferred'].includes(t.status),
      ))
        resolve(task, a);
  } else return false;
  return true;
}
