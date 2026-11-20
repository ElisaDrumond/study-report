import {
type Client
} from '../../collection-types';
import { audit,getLegacyNames,put } from '../../database/operations-repository';
import { text } from '../../validation/operation-values';
import type { OperationContext } from '../operation-context';
export function handleClientCommand(type:string,context:OperationContext){const {command,database,s,today,now,getClient,getInstallment,resolve,activity}=context;if(type === 'import_legacy_clients'){
      const rows = getLegacyNames(database);
      const names = new Set(s.clients.map((c) => c.name.trim().toLocaleLowerCase('pt-BR')));
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
    }
else if(type === 'save_client'){
      const old = s.clients.find((c) => c.id === command.id);
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
    }else return false;
return true;}