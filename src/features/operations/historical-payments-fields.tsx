'use client';

import { useState } from 'react';
import op from '../../../app/operations.module.css';
import { fmt } from '../../../lib/rules';
import type { InstallmentPreview } from '../../../lib/installment-plan';
import { amountInput, money } from './operations-presenters';

type Props = { plan: InstallmentPreview[]; today: string };

export default function HistoricalPaymentsFields({ plan, today }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const past = plan.filter((item) => item.dueDate < today);
  if (!past.length) return null;

  return (
    <section className={op.historicalPayments}>
      <h3>Pagamentos de meses anteriores</h3>
      <p>
        Se este contrato já estava em andamento, marque apenas as parcelas que você confirmou como
        quitadas no sistema da Study. Cada uma aceita data, valor efetivamente recebido e
        multa/encargos específicos em USD.
      </p>
      <p>
        Parcelas não marcadas permanecerão com a situação a verificar, sem cobrança automática.
        Cadastrar histórico antigo não será contado como atividade realizada hoje.
      </p>
      {past.map((item) => {
        const checked = selected.includes(item.number);
        return (
          <div className={op.historicalRow} key={item.number}>
            <label className={op.historicalCheck}>
              <input
                type="checkbox"
                name={`historicalPaid_${item.number}`}
                checked={checked}
                onChange={(event) =>
                  setSelected((previous) =>
                    event.target.checked
                      ? [...previous, item.number]
                      : previous.filter((number) => number !== item.number),
                  )
                }
              />
              <span>
                <strong>Parcela {item.number}</strong>
                <small>
                  Vencimento {fmt(item.dueDate)} · Original {money(item.amountCents)}
                </small>
              </span>
              <span className={op.historicalState}>{checked ? 'Já foi paga' : 'A verificar'}</span>
            </label>
            {checked && (
              <div className={op.historicalFields}>
                <label>
                  Data do recebimento
                  <input
                    type="date"
                    name={`historicalDate_${item.number}`}
                    defaultValue={item.dueDate}
                    max={today}
                    required
                  />
                </label>
                <label>
                  Valor efetivamente recebido (US$)
                  <input
                    name={`historicalAmount_${item.number}`}
                    inputMode="decimal"
                    defaultValue={amountInput(item.amountCents)}
                    required
                    aria-label={`Valor recebido na parcela ${item.number}`}
                  />
                </label>
                <label>
                  Multa / encargos incluídos (US$)
                  <input
                    name={`historicalCharges_${item.number}`}
                    inputMode="decimal"
                    defaultValue="0.00"
                    required
                    aria-label={`Encargos da parcela ${item.number}`}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
      <small>
        Valor recebido deve ser igual ao valor original mais os encargos informados. Pagamentos
        parciais e descontos serão registrados individualmente em outro fluxo.
      </small>
    </section>
  );
}
