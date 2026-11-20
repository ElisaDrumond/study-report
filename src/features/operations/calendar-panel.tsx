'use client';
import { Plus } from 'lucide-react';
import op from '../../../app/operations.module.css';
import styles from '../../../app/page.module.css';
import { isBusinessDay } from '../../../lib/business-calendar';
import { fmt } from '../../../lib/rules';
import Field from '../../components/ui/form-field';
import type { OperationsController } from './use-operations';
type Props = Pick<
  OperationsController,
  'setDialog' | 'month' | 'setMonth' | 'operationsState' | 'busy' | 'run'
>;
export default function CalendarPanel({
  setDialog,
  month,
  setMonth,
  operationsState,
  busy,
  run,
}: Props) {
  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardhead}>
          <div>
            <p className={styles.eyebrow}>CALENDÁRIO OPERACIONAL</p>
            <h2>Dias úteis e recessos</h2>
          </div>
          <div className={op.actions}>
            <button
              className={styles.secondary}
              onClick={() =>
                setDialog({ type: 'save_settings', title: 'Configurar regras e fuso horário' })
              }
            >
              Configurar regras
            </button>
            <button
              className={styles.primary}
              onClick={() => setDialog({ type: 'save_calendar', title: 'Nova exceção / recesso' })}
            >
              <Plus size={16} /> Exceção ou recesso
            </button>
          </div>
        </div>
        <p className={styles.note}>
          Segunda a sexta são úteis por padrão. Feriados não são presumidos. Exceções têm
          prioridade, inclusive sábados e domingos úteis. Alterações recalculam pendências abertas e
          preservam conclusões e histórico.
        </p>
        <Field label="Mês">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <div className={op.calendar}>
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
            <b key={day}>{day}</b>
          ))}
          {month &&
            Array.from(
              { length: (new Date(month + '-01T12:00:00Z').getUTCDay() + 6) % 7 },
              (_, i) => <div key={'blank' + i} />,
            )}
          {month &&
            Array.from(
              {
                length: new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate(),
              },
              (_, i) => {
                const day = month + '-' + String(i + 1).padStart(2, '0'),
                  exception = operationsState.exceptions.find((e) => e.date === day);
                return (
                  <button
                    key={day}
                    title={exception?.description || 'Calendário padrão'}
                    className={`${op.day} ${isBusinessDay(day, operationsState.exceptions) ? op.business : op.nonBusiness} ${exception ? op.exception : ''}`}
                    onClick={() => {
                      if (exception)
                        setDialog({
                          type: 'save_calendar',
                          title: 'Editar exceção',
                          exceptionId: exception.id,
                        });
                      else
                        setDialog({
                          type: 'save_calendar',
                          title: 'Nova exceção',
                          exceptionId: undefined,
                          calendarDate: day,
                        });
                    }}
                  >
                    <b>{i + 1}</b>
                    <small>
                      {exception?.description ||
                        (isBusinessDay(day, operationsState.exceptions) ? 'Útil' : 'Não útil')}
                    </small>
                  </button>
                );
              },
            )}
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {operationsState.exceptions
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((e) => (
                  <tr key={e.id}>
                    <td>{fmt(e.date)}</td>
                    <td>{e.type === 'business' ? 'Dia útil excepcional' : 'Dia não útil'}</td>
                    <td>{e.description}</td>
                    <td>
                      <button
                        className={styles.iconbtn}
                        onClick={() =>
                          setDialog({
                            type: 'save_calendar',
                            title: 'Editar exceção',
                            exceptionId: e.id,
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        className={styles.iconbtn}
                        disabled={busy}
                        onClick={() => {
                          if (confirm('Excluir esta exceção e recalcular pendências abertas?'))
                            run({ type: 'delete_calendar', id: e.id });
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
