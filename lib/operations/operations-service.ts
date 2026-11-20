import { createHash } from 'node:crypto';
import {
operationToday
} from '../business-calendar';
import { getCommandRecord,put,snapshot } from '../database/operations-repository';
import { db as defaultDb } from '../db';
import { text } from '../validation/operation-values';
import { handleCalendarCommand } from './commands/calendar-commands';
import { handleClientCommand } from './commands/client-commands';
import { handleInstallmentCommand } from './commands/installment-commands';
import { handleNegotiationCommand } from './commands/negotiation-commands';
import { handleTaskCommand } from './commands/task-commands';
import { createOperationContext } from './operation-context';
import { processOperations } from './process-operations';
export function mutateOperation(command:Record<string,unknown>,database=defaultDb(),referenceDate?:string){return database.transaction(()=>{const s = snapshot(database),
      today = referenceDate ?? operationToday(s.settings.timezone),
      now = new Date().toISOString();
const operationId = command.operationId
      ? text(command.operationId, 'Identificador da operação', true)
      : '';
const commandHash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
if (operationId) {
      const row = getCommandRecord(database,operationId);
      if (row) {
        if (JSON.parse(row.data).commandHash !== commandHash)
          throw Error('Identificador já utilizado para outra operação');
        return processOperations(database, today);
      }
    }
const type = text(command.type, 'Operação', true);
const context=createOperationContext(command,database,s,today,now);
if(!(handleClientCommand(type,context)||handleInstallmentCommand(type,context)||handleNegotiationCommand(type,context)||handleCalendarCommand(type,context)||handleTaskCommand(type,context)))throw Error('Operação desconhecida');
if (operationId)
      put(database, 'op_commands', { id: operationId, commandHash, completedAt: now }, true);
return processOperations(
      database,
      type === 'save_settings' && !referenceDate ? undefined : today,
    );})();}
