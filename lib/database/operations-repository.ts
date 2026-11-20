import type Database from 'better-sqlite3';
import {
defaultSettings,
type Client,
type CollectionSettings,
type OperationActivity,
type OperationSnapshot
} from '../collection-types';
import { db as defaultDb } from '../db';
import { actions,validateEntry } from '../rules';
import type { Entry } from '../types';
export type Row = { id: string; data: string };
export const tables = [
  'op_clients',
  'op_installments',
  'op_activities',
  'op_pending',
  'op_negotiations',
  'op_calendar',
  'op_audit',
  'op_settings',
  'op_commands',
] as const;
export function read<T>(db: Database.Database, table: (typeof tables)[number]): T[] {
  return (db.prepare(`SELECT data FROM ${table} ORDER BY rowid`).all() as Row[]).map((r) =>
    JSON.parse(r.data),
  );
}
export function put<T extends { id: string }>(
  db: Database.Database,
  table: (typeof tables)[number],
  value: T,
  insert = false,
) {
  db.prepare(
    `INSERT INTO ${table}(id,data) VALUES(?,?) ${insert ? '' : 'ON CONFLICT(id) DO UPDATE SET data=excluded.data'}`,
  ).run(value.id, JSON.stringify(value));
}
export function snapshot(database = defaultDb()): OperationSnapshot {
  const settings =
    read<CollectionSettings & { id: string }>(database, 'op_settings')[0] ?? defaultSettings;
  const clients = read<Client>(database, 'op_clients'),
    activities = read<OperationActivity>(database, 'op_activities');
  const columns = new Set(
    (database.prepare('PRAGMA table_info(entries)').all() as { name: string }[]).map((c) => c.name),
  );
  if (columns.has('action'))
    for (const r of database.prepare('SELECT * FROM entries').all() as Entry[]) {
      if (validateEntry(r).length || r.action === 'none') continue;
      const matches = clients.filter((c) =>
        [c.name, ...(c.legacyNames || [])].some(
          (name) =>
            name.trim().toLocaleLowerCase('pt-BR') === r.name.trim().toLocaleLowerCase('pt-BR'),
        ),
      );
      if (matches.length !== 1) continue;
      const channel = (
        {
          email_sent: 'email',
          email_replied: 'email',
          whatsapp_sent: 'whatsapp',
          message_replied: 'whatsapp',
          both_sent: 'both',
          call: 'phone',
        } as Partial<Record<Entry['action'], OperationActivity['channel']>>
      )[r.action];
      activities.push({
        id: 'legacy:' + r.id,
        source: 'legacy',
        clientId: matches[0].id,
        installmentId: '',
        category: r.category,
        action: r.action,
        status: r.status,
        occurredAt: r.date + 'T00:00:00',
        date: r.date,
        channel: channel || 'system',
        notes: r.notes,
        result: actions[r.action],
        responsible: 'Registro legado',
        contact: !!channel,
        taskId: '',
        amountCents: 0,
      });
    }
  activities.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return {
    clients,
    installments: read(database, 'op_installments'),
    activities,
    pending: read(database, 'op_pending'),
    negotiations: read(database, 'op_negotiations'),
    exceptions: read(database, 'op_calendar'),
    audit: read(database, 'op_audit'),
    settings,
  };
}
export function audit(
  database: Database.Database,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
  reason: string,
) {
  put(
    database,
    'op_audit',
    {
      id: crypto.randomUUID(),
      entity,
      entityId,
      before,
      after,
      reason,
      at: new Date().toISOString(),
    } as { id: string },
    true,
  );
}
export function getCommandRecord(database:Database.Database,id:string){return database.prepare('SELECT data FROM op_commands WHERE id=?').get(id) as Row|undefined;}
export function getLegacyNames(database:Database.Database){return database.prepare('SELECT name FROM entries ORDER BY rowid').all() as {name:string}[];}
export function deleteCalendarException(database:Database.Database,id:string){database.prepare('DELETE FROM op_calendar WHERE id=?').run(id);}
