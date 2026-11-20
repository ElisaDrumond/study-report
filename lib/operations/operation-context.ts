import type Database from 'better-sqlite3';

import type { OperationActivity, OperationSnapshot, PendingTask } from '../collection-types';
import { audit, put } from '../database/operations-repository';
import { text } from '../validation/operation-values';

export function createOperationContext(
  command: Record<string, unknown>,
  database: Database.Database,
  state: OperationSnapshot,
  today: string,
  now: string,
) {
  const getClient = (id: unknown) => {
    const client = state.clients.find((item) => item.id === id);
    if (!client) throw Error('Cliente não encontrado');
    return client;
  };

  const getInstallment = (id: unknown) => {
    const installment = state.installments.find((item) => item.id === id);
    if (!installment) throw Error('Parcela não encontrada');
    return installment;
  };

  const resolve = (task: PendingTask, activity: OperationActivity) => {
    put(database, 'op_pending', {
      ...task,
      status: 'done',
      completedAt: now,
      resolvedActivityId: activity.id,
    });

    audit(
      database,
      'pending',
      task.id,
      task,
      { status: 'done', activityId: activity.id },
      'Conclusão confirmada manualmente',
    );
  };

  const activity = (data: Partial<OperationActivity> & { clientId: string; action: string }) => {
    getClient(data.clientId);

    const record: OperationActivity = {
      id: crypto.randomUUID(),
      installmentId: '',
      category: 'operational',
      status: 'recorded',
      occurredAt: now,
      date: today,
      channel: 'system',
      notes: text(command.notes ?? '', 'Observações'),
      result: text(command.result ?? 'Registrado manualmente', 'Resultado', true),
      responsible: text(command.responsible, 'Responsável', true),
      contact: false,
      taskId: '',
      amountCents: 0,
      ...data,
    };

    put(database, 'op_activities', record, true);
    return record;
  };

  return {
    command,
    database,
    state,
    today,
    now,
    getClient,
    getInstallment,
    resolve,
    activity,
  };
}

export type OperationContext = ReturnType<typeof createOperationContext>;
