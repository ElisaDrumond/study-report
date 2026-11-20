import { type Client } from '../../collection-types';
import type { ImportedClientRow } from '../../client-csv';
import { audit, getLegacyNames, put } from '../../database/operations-repository';
import { text } from '../../validation/operation-values';
import type { OperationContext } from '../operation-context';
export function handleClientCommand(type: string, context: OperationContext) {
  const { command, database, state, now } = context;
  if (type === 'import_clients') {
    if (!Array.isArray(command.rows) || command.rows.length > 5000) {
      throw Error('Lista de clientes inválida (máximo 5.000)');
    }

    const currentClients = [...state.clients];
    const importedIds = new Set<string>();
    const normalize = (value: string) => value.trim().toLocaleLowerCase('pt-BR');

    for (const [index, raw] of (command.rows as unknown[]).entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw Error(`Linha ${index + 2}: cliente inválido`);
      }

      const row = raw as Partial<ImportedClientRow>;
      const name = text(row.name, 'Nome', true);
      const id = text(row.id ?? '', 'ID');
      const crmRef = text(row.crmRef ?? '', 'Referência CRM');
      const notes = text(row.notes ?? '', 'Observações');
      const byId = id ? currentClients.filter((client) => client.id === id) : [];
      if (id && byId.length === 0) {
        throw Error(`Linha ${index + 2}: ID de cliente desconhecido; remova o ID para novo cadastro`);
      }
      const byCrm = crmRef
        ? currentClients.filter((client) => normalize(client.crmRef) === normalize(crmRef))
        : [];
      const byName = currentClients.filter((client) =>
        [client.name, ...(client.legacyNames || [])].some(
          (candidate) => normalize(candidate) === normalize(name),
        ),
      );

      if (byCrm.length && byName.length && byCrm[0].id !== byName[0].id) {
        throw Error(`Linha ${index + 2}: nome e CRM correspondem a cadastros diferentes`);
      }
      const candidates = byId.length ? byId : byCrm.length ? byCrm : byName;
      if (candidates.length > 1) {
        throw Error(`Linha ${index + 2}: cliente duplicado/ambíguo; informe o ID`);
      }
      const old = candidates[0];
      if (old && importedIds.has(old.id)) {
        throw Error(`Linha ${index + 2}: cliente repetido no arquivo`);
      }
      if (old && byId.length && byCrm.length && byCrm[0].id !== old.id) {
        throw Error(`Linha ${index + 2}: CRM pertence a outro cliente`);
      }
      const updated: Client = old
        ? {
            ...old,
            name,
            crmRef: crmRef || old.crmRef,
            notes: notes || old.notes,
            legacyNames: old.name === name
              ? old.legacyNames
              : [...new Set([old.name, ...(old.legacyNames || [])])],
          }
        : {
            id: crypto.randomUUID(),
            name,
            crmRef,
            notes,
            financialStatus: 'current',
            serviceStatus: 'active',
            createdAt: now,
          };
      importedIds.add(updated.id);
      if (JSON.stringify(old) !== JSON.stringify(updated)) {
        put(database, 'op_clients', updated);
        audit(database, 'client', updated.id, old ?? null, updated, 'Importação CSV confirmada');
      }
      if (!old) currentClients.push(updated);
    }
  } else if (type === 'import_legacy_clients') {
    const rows = getLegacyNames(database);
    const names = new Set(state.clients.map((c) => c.name.trim().toLocaleLowerCase('pt-BR')));
    for (const row of rows) {
      const name = row.name.trim(),
        key = name.toLocaleLowerCase('pt-BR');
      if (!name || names.has(key)) continue;
      names.add(key);
      const c: Client = {
        id: crypto.randomUUID(),
        name,
        crmRef: '',
        financialStatus: 'current',
        serviceStatus: 'active',
        notes: 'Nome importado do histórico. Cadastre parcelas para habilitar as regras.',
        createdAt: now,
      };
      put(database, 'op_clients', c);
      audit(
        database,
        'client',
        c.id,
        null,
        c,
        'Importação de nome do histórico; valores e contratos não inferidos',
      );
    }
  } else if (type === 'save_client') {
    const old = state.clients.find((c) => c.id === command.id);
    const c: Client = {
      id: old?.id || crypto.randomUUID(),
      name: text(command.name, 'Nome', true),
      crmRef: text(command.crmRef ?? '', 'Referência CRM'),
      notes: text(command.notes ?? '', 'Observações'),
      financialStatus: old?.financialStatus || 'current',
      serviceStatus: old?.serviceStatus || 'active',
      createdAt: old?.createdAt || now,
      legacyNames: old ? [...new Set([old.name, ...(old.legacyNames || [])])] : [],
      serviceOverride: old?.serviceOverride || false,
    };
    put(database, 'op_clients', c);
    audit(database, 'client', c.id, old ?? null, c, 'Cadastro/edição manual');
  } else return false;
  return true;
}
