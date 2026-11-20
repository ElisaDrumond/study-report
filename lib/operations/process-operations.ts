import { getNextCollectionDate, operationToday } from '../business-calendar';
import { generateCollectionTasks } from '../collection-rules';
import { isOverdue, isUnpaid } from '../collection-status';
import { type Client } from '../collection-types';
import { audit, put, snapshot } from '../database/operations-repository';
import { db as defaultDb } from '../db';
import { reconcileTasks } from '../task-generator';
export function processOperations(database = defaultDb(), referenceDate?: string) {
  return database.transaction(() => {
    let state = snapshot(database);
    const today = referenceDate ?? operationToday(state.settings.timezone);
    const next = reconcileTasks(state.pending, generateCollectionTasks(state, today)).map((t) =>
      t.status === 'deferred'
        ? {
            ...t,
            dueDate: getNextCollectionDate(t.deferRequestedDate || t.dueDate, state.exceptions),
          }
        : t,
    );
    for (const task of next) {
      const old = state.pending.find((p) => p.id === task.id);
      if (JSON.stringify(old) !== JSON.stringify(task)) {
        put(database, 'op_pending', task);
        if (old)
          audit(
            database,
            'pending',
            task.id,
            old,
            task,
            'Reprocessamento das regras ou calendário',
          );
      }
    }
    for (const client of state.clients) {
      if (
        client.financialStatus === 'external' &&
        state.installments.some((p) => p.clientId === client.id && isUnpaid(p))
      )
        continue;
      const overdue = state.installments.some(
        (p) => p.clientId === client.id && isOverdue(p, today),
      );
      const blocked = next.some(
        (p) =>
          p.clientId === client.id && p.kind === 'block' && ['open', 'deferred'].includes(p.status),
      );
      const unblock = next.some(
        (p) =>
          p.clientId === client.id &&
          p.kind === 'unblock' &&
          ['open', 'deferred'].includes(p.status),
      );
      const serviceStatus =
        client.serviceStatus === 'active' && blocked
          ? 'block_pending'
          : client.serviceStatus === 'block_pending' && !blocked
            ? 'active'
            : client.serviceStatus === 'blocked' && unblock
              ? 'unblock_pending'
              : client.serviceStatus === 'unblock_pending' && !unblock
                ? 'blocked'
                : client.serviceStatus;
      const updated: Client = {
        ...client,
        financialStatus: overdue ? 'overdue' : 'current',
        serviceStatus,
        serviceOverride: overdue ? client.serviceOverride : false,
      };
      if (JSON.stringify(updated) !== JSON.stringify(client)) {
        put(database, 'op_clients', updated);
        audit(
          database,
          'client',
          client.id,
          client,
          updated,
          'Situação calculada; nenhuma ação de bloqueio executada',
        );
      }
    }
    state = snapshot(database);
    return { ...state, today };
  })();
}
