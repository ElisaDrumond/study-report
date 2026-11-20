'use client';
import { useEffect, useMemo, useState } from 'react';
import { operationToday, shiftDate } from '../../../lib/business-calendar';
import type { Installment, OperationActivity, PendingTask } from '../../../lib/collection-types';
import { cents, empty } from './operations-presenters';
import type { Dialog } from './operations-view-types';
export function useOperations(view: 'central' | 'clients' | 'calendar') {
  const [operationsState, setOperationsState] = useState(empty),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null),
    [historyClient, setHistoryClient] = useState(''),
    [selectedClient, setSelectedClient] = useState('');
  const [range, setRange] = useState('today'),
    [priority, setPriority] = useState('all'),
    [category, setCategory] = useState('all'),
    [status, setStatus] = useState('pending'),
    [clientFilter, setClientFilter] = useState('all');
  const [month, setMonth] = useState(() => operationToday().slice(0, 7));
  const operationId = useMemo(() => (dialog ? crypto.randomUUID() : ''), [dialog]);
  const today = operationToday(operationsState.settings.timezone);
  async function request(command?: Record<string, unknown>) {
    const response = await fetch('/api/operations', {
      method: command ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: command ? JSON.stringify(command) : undefined,
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Não foi possível carregar as operações');
    setOperationsState(data);
    return data;
  }
  useEffect(() => {
    let mounted = true;
    fetch('/api/operations', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (mounted) setOperationsState(data);
      })
      .catch((e) => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [view]);
  async function run(command: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request(command);
      setDialog(null);
      setMessage('Operação registrada. A fila foi recalculada.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    setError('');
    try {
      await request();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const clientName = (id: string) =>
    operationsState.clients.find((c) => c.id === id)?.name || 'Cliente não localizado';
  const installmentName = (id: string) => {
    const p = operationsState.installments.find((p) => p.id === id);
    return p ? `${p.reference} · parcela ${p.number}` : 'Carteira do cliente';
  };
  const active = operationsState.pending.filter(
    (t) => t.status === 'open' || t.status === 'deferred',
  );
  const collectionKinds = ['advance', 'due', 'initial', 'window', 'alternate'];
  const lastActions = new Map<string, OperationActivity>();
  for (const a of operationsState.activities) if (a.contact) lastActions.set(a.clientId, a);
  const stats = [
    [
      'Cobranças a realizar',
      active.filter((t) => collectionKinds.includes(t.kind) && t.dueDate <= today).length,
    ],
    [
      'Pagamentos a conferir',
      new Set(
        active
          .filter((t) => t.kind.startsWith('scheduled') && t.dueDate <= today)
          .map((t) => t.installmentId),
      ).size,
    ],
    [
      'Renegociações pendentes',
      operationsState.negotiations.filter((n) =>
        ['proposal_received', 'awaiting_approval'].includes(n.status),
      ).length,
    ],
    ['Atividades vencidas', active.filter((t) => t.dueDate < today).length],
    [
      'Clientes aguardando retorno',
      [...lastActions.values()].filter((a) => a.status === 'awaiting_reply').length,
    ],
    [
      'Casos para análise da gestão',
      new Set(
        active
          .filter((t) => ['management', 'renegotiate'].includes(t.kind))
          .map((t) => t.clientId),
      ).size,
    ],
    [
      'Pagamentos agendados',
      operationsState.installments.filter(
        (p) => p.scheduledDate && p.status !== 'paid' && p.status !== 'cancelled',
      ).length,
    ],
    [
      'Atividades concluídas no dia',
      operationsState.activities.filter((a) => a.date === today).length,
    ],
  ];
  const queue = operationsState.pending
    .filter(
      (t) =>
        (status === 'all' || status === 'pending'
          ? status === 'all' || ['open', 'deferred'].includes(t.status)
          : t.status === status) &&
        (clientFilter === 'all' || t.clientId === clientFilter) &&
        (priority === 'all' || t.priority === priority) &&
        (category === 'all' || t.kind === category) &&
        (range === 'all' ||
          (range === 'today' && t.dueDate <= today) ||
          (range === 'week' && t.dueDate >= today && t.dueDate <= shiftDate(today, 7)) ||
          (range === 'late' && t.dueDate < today)),
    )
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        { high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority],
    );
  const selectClient =
    operationsState.clients.find((c) => c.id === selectedClient) || operationsState.clients[0];
  function openTask(type: string, task: PendingTask, title: string) {
    setError('');
    setDialog({
      type,
      title,
      task,
      client: operationsState.clients.find((c) => c.id === task.clientId),
      installment: operationsState.installments.find((p) => p.id === task.installmentId),
    });
  }
  function openClient(
    type: string,
    title: string,
    client = selectClient,
    installment?: Installment,
  ) {
    setError('');
    setDialog({ type, title, client, installment });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    setError('');
    const data = new FormData(event.currentTarget),
      values = Object.fromEntries(data.entries());
    const command: Record<string, unknown> = {
      ...values,
      type: dialog.type,
      clientId: values.clientId || dialog.client?.id,
      installmentId: dialog.installment?.id,
      taskId: dialog.task?.id,
      confirmed: data.get('confirmed') === 'on',
      authorizedOverride: data.get('authorizedOverride') === 'on',
      awaitingReply: data.get('awaitingReply') === 'on',
    };
    try {
      if (dialog.type === 'save_client') {
        command.id = dialog.client?.id;
        command.paymentTerms = {
          purchaseDescription: String(data.get('purchaseDescription') ?? ''),
          installmentCount: String(data.get('installmentCount') ?? ''),
          installmentAmountCents: data.get('installmentAmount')
            ? cents(data.get('installmentAmount'))
            : '',
          frequency: String(data.get('frequency') ?? 'monthly'),
          dueDay: String(data.get('dueDay') ?? ''),
          firstDueDate: String(data.get('firstDueDate') ?? ''),
        };
      }
      if (dialog.type === 'generate_installments') {
        const paidNumbers = [...data.keys()]
          .map((key) => /^historicalPaid_(\d+)$/.exec(key)?.[1])
          .filter((value): value is string => !!value);
        command.historicalPayments = paidNumbers.map((numberString) => {
          const number = Number(numberString);
          return {
            number,
            paidDate: String(data.get(`historicalDate_${number}`) ?? ''),
            paidCents: cents(data.get(`historicalAmount_${number}`)),
            chargesCents: cents(data.get(`historicalCharges_${number}`)),
          };
        });
      }
      if (dialog.type === 'save_installment') {
        command.id = dialog.installment?.id;
        command.amountCents = cents(data.get('amount'));
        command.chargesCents = cents(data.get('charges'));
        command.number = Number(data.get('number'));
      }
      if (dialog.type === 'confirm_payment') command.amountCents = cents(data.get('amount'));
      if (dialog.type === 'save_negotiation') {
        command.id = dialog.negotiation?.id;
        command.scope = data.get('scope');
        command.installmentIds = data.getAll('installmentIds');
      }
      if (dialog.type === 'save_calendar') command.id = dialog.exceptionId;
      if (dialog.type === 'save_settings')
        for (const key of [
          'advanceDays',
          'followupBusinessDays',
          'alternateBusinessDays',
          'externalReviewDays',
          'finePercent',
        ])
          command[key] = Number(data.get(key));
      if (dialog.task?.kind === 'fine') command.chargesCents = cents(data.get('charges'));
      await run(command);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const exception = dialog?.exceptionId
    ? operationsState.exceptions.find((e) => e.id === dialog.exceptionId)
    : undefined;
  const activeDialog = dialog;
  const selectedInstallment = activeDialog?.installment;
  const selectedNegotiation = activeDialog?.negotiation;
  return {
    today,
    operationsState,
    error,
    message,
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
    status,
    setStatus,
    queue,
    clientName,
    installmentName,
    openTask,
    setHistoryClient,
    run,
    setError,
    setDialog,
    selectClient,
    setSelectedClient,
    openClient,
    historyClient,
    month,
    setMonth,
    activeDialog,
    submit,
    operationId,
    selectedInstallment,
    selectedNegotiation,
    exception,
    collectionKinds,
    loading,
  };
}

export type OperationsController = ReturnType<typeof useOperations>;
