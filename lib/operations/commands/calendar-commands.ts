import {
operationToday,
shiftDate,
type CalendarException
} from '../../business-calendar';
import { audit,deleteCalendarException,put } from '../../database/operations-repository';
import { date,money,pick,text } from '../../validation/operation-values';
import type { OperationContext } from '../operation-context';
export function handleCalendarCommand(type:string,context:OperationContext){const {command,database,s,today,now,getClient,getInstallment,resolve,activity}=context;if(type === 'save_calendar' || type === 'delete_calendar'){
      if (type === 'delete_calendar') {
        const old = s.exceptions.find((e) => e.id === command.id);
        if (!old) throw Error('Exceção não encontrada');
        deleteCalendarException(database,old.id);
        audit(database, 'calendar', old.id, old, null, 'Exclusão manual');
      } else {
        const start = date(command.date),
          end = command.endDate ? date(command.endDate) : start;
        if (end < start || end > shiftDate(start, 366))
          throw Error('Período inválido; máximo de 367 dias');
        const exceptionType = pick(
            command.exceptionType,
            ['non_business', 'business'] as const,
            'Exceção',
          ),
          description = text(command.description, 'Descrição', true);
        const editing = command.id ? s.exceptions.find((e) => e.id === command.id) : undefined;
        if (command.id && !editing) throw Error('Exceção não encontrada');
        if (editing && start !== end) throw Error('Edite apenas uma data por vez');
        if (editing && editing.date !== start) {
          database.prepare('DELETE FROM op_calendar WHERE id=?').run(editing.id);
          audit(database, 'calendar', editing.id, editing, null, 'Mudança da data da exceção');
        }
        for (let d = start; d <= end; d = shiftDate(d, 1)) {
          const old = s.exceptions.find((e) => e.date === d);
          const exception: CalendarException = {
            id: old?.id || editing?.id || crypto.randomUUID(),
            date: d,
            type: exceptionType,
            description,
            createdAt: old?.createdAt || editing?.createdAt || now,
          };
          put(database, 'op_calendar', exception);
          audit(database, 'calendar', exception.id, old ?? null, exception, 'Exceção manual');
        }
      }
    }
else if(type === 'save_settings'){
      const timezone = text(command.timezone, 'Fuso horário', true);
      try {
        operationToday(timezone);
      } catch {
        throw Error('Fuso horário inválido');
      }
      const settings = { ...s.settings, timezone };
      for (const key of [
        'advanceDays',
        'followupBusinessDays',
        'alternateBusinessDays',
        'externalReviewDays',
        'finePercent',
      ] as const) {
        const v = money(command[key], key);
        if (v < 1 || v > 365) throw Error('Parâmetros devem estar entre 1 e 365');
        settings[key] = v;
      }
      put(database, 'op_settings', { ...settings, id: 'default' });
      audit(database, 'settings', 'default', s.settings, settings, 'Configuração manual');
    }else return false;
return true;}