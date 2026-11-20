'use client';
import { Save, ShieldCheck, X } from 'lucide-react';
import styles from '../../../app/page.module.css';
import {
  actions,
  allowed,
  categories,
  defaultAction,
  defaultStatus,
  follow,
  statuses,
} from '../../../lib/rules';
import type { Action, Category, Status } from '../../../lib/types';
import type { DashboardController } from './use-dashboard';
type Props = Pick<
  DashboardController,
  'setEditing' | 'records' | 'editing' | 'saving' | 'saveRecord'
>;
export default function EntryDialog({ setEditing, records, editing, saving, saveRecord }: Props) {
  if (!editing) return null;
  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setEditing(null);
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <div>
            <p className={styles.eyebrow}>ATIVIDADE FINANCEIRA</p>
            <h2>
              {records.some((r) => r.id === editing.id) ? 'Editar registro' : 'Novo registro'}
            </h2>
          </div>
          <button className={styles.iconbtn} onClick={() => setEditing(null)} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.wide}`}>
            Nome do cliente *
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Nome completo"
            />
          </label>
          <label className={styles.field}>
            Categoria
            <select
              value={editing.category}
              onChange={(e) => {
                const cat = e.target.value as Category;
                const action = allowed[cat].actions.includes(editing.action)
                  ? editing.action
                  : defaultAction[cat];
                const status = allowed[cat].statuses.includes(editing.status)
                  ? editing.status
                  : defaultStatus[cat];
                setEditing({ ...editing, category: cat, action, status });
              }}
            >
              {(Object.keys(categories) as Category[]).map((k) => (
                <option key={k} value={k}>
                  {categories[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Ação realizada
            <select
              value={editing.action}
              onChange={(e) => setEditing({ ...editing, action: e.target.value as Action })}
            >
              {allowed[editing.category].actions.map((k) => (
                <option key={k} value={k}>
                  {actions[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Status
            <select
              value={editing.status}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as Status })}
            >
              {allowed[editing.category].statuses.map((k) => (
                <option key={k} value={k}>
                  {statuses[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Data da ação
            <input
              type="date"
              value={editing.date}
              onChange={(e) => setEditing({ ...editing, date: e.target.value })}
            />
          </label>
          {(follow(editing.category) || editing.category === 'renegotiation') && (
            <label className={styles.field}>
              Dias em atraso
              <input
                type="number"
                min="0"
                value={editing.days ?? ''}
                onChange={(e) => {
                  const days = e.target.value === '' ? null : Number(e.target.value);
                  setEditing({
                    ...editing,
                    days,
                    category:
                      follow(editing.category) && days !== null
                        ? days > 30
                          ? 'lateover'
                          : 'late'
                        : editing.category,
                  });
                }}
              />
            </label>
          )}
          <label className={styles.field}>
            Último contato
            <input
              type="date"
              value={editing.lastContact}
              onChange={(e) => setEditing({ ...editing, lastContact: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Pagamento previsto
            <input
              type="date"
              value={editing.scheduled}
              onChange={(e) => setEditing({ ...editing, scheduled: e.target.value })}
            />
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            Observações
            <textarea
              rows={3}
              value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              placeholder="O que aconteceu? Próximo passo?"
            />
          </label>
        </div>
        <div className={styles.modalFoot}>
          <span>
            <ShieldCheck size={14} /> Validação de ação e status ativa
          </span>
          <button className={styles.secondary} onClick={() => setEditing(null)}>
            Cancelar
          </button>
          <button className={styles.primary} disabled={saving} onClick={saveRecord}>
            <Save size={16} /> Salvar registro
          </button>
        </div>
      </div>
    </div>
  );
}
