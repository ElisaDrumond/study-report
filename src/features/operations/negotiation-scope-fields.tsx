'use client';

import { useMemo, useState } from 'react';
import type { Negotiation, OperationSnapshot } from '../../../lib/collection-types';
import { outstandingCents } from '../../../lib/collection-status';
import { negotiationInstallments } from '../../../lib/overdue-debt';
import Field from '../../components/ui/form-field';
import styles from '../../../app/page.module.css';
import { money } from './operations-presenters';

type Scope = 'overdue' | 'remaining' | 'custom';

export default function NegotiationScopeFields({
  clientId, state, today, existing,
}: {
  clientId: string;
  state: OperationSnapshot;
  today: string;
  existing?: Negotiation;
}) {
  const overdue = useMemo(() => negotiationInstallments(state, clientId, 'overdue', today),
    [state, clientId, today]);
  const remaining = useMemo(() => negotiationInstallments(state, clientId, 'remaining', today),
    [state, clientId, today]);
  const [scope, setScope] = useState<Scope>(
    existing?.scope ?? (existing ? 'custom' : overdue.length ? 'overdue' : 'remaining'),
  );
  const [custom, setCustom] = useState<string[]>(existing?.installmentIds ?? []);
  const selected = scope === 'overdue' ? overdue
    : scope === 'remaining' ? remaining
      : remaining.filter((installment) => custom.includes(installment.id));
  const amount = selected.reduce((sum, installment) => sum + outstandingCents(installment), 0);
  return (
    <>
      <Field label="Abrangência da renegociação" wide>
        <select name="scope" value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
          <option value="overdue" disabled={!overdue.length}>Apenas parcelas vencidas</option>
          <option value="remaining">Todo o saldo restante do contrato</option>
          <option value="custom">Selecionar parcelas manualmente</option>
        </select>
      </Field>
      {scope === 'custom' && (
        <Field label="Parcelas incluídas na proposta" wide>
          <select name="installmentIds" multiple required
            size={Math.min(Math.max(remaining.length, 2), 6)}
            value={custom}
            onChange={(event) => setCustom(
              Array.from(event.target.selectedOptions, (option) => option.value),
            )}>
            {remaining.map((installment) => (
              <option key={installment.id} value={installment.id}>
                {installment.reference} · parcela {installment.number} · {money(outstandingCents(installment))}
              </option>
            ))}
          </select>
          <small>Use Ctrl para selecionar mais de uma parcela.</small>
        </Field>
      )}
      <div className={`${styles.note} ${styles.wide}`}>
        <strong>{selected.length} parcela(s) · Saldo considerado: {money(amount)}</strong>
        <p>{scope === 'overdue'
          ? 'Somente valores vencidos ainda não quitados.'
          : scope === 'remaining'
            ? 'Inclui parcelas vencidas e futuras ainda não quitadas.'
            : 'Somente as parcelas selecionadas.'}</p>
        <p>A proposta não altera automaticamente vencimentos nem valores; depende de aprovação e registros específicos.</p>
      </div>
    </>
  );
}
