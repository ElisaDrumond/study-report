'use client';
import { Database, Download, Filter, Plus, Search, Trash2 } from 'lucide-react';
import styles from '../../../app/page.module.css';
import { actions, categories, fmt, statuses, validateEntry } from '../../../lib/rules';
import type { Category } from '../../../lib/types';
import { freshEntry } from './dashboard-model';
import type { DashboardController } from './use-dashboard';
type Props = Pick<
  DashboardController,
  | 'setEditing'
  | 'date'
  | 'query'
  | 'setQuery'
  | 'categoryFilter'
  | 'setCategoryFilter'
  | 'dateFilter'
  | 'setDateFilter'
  | 'fromDate'
  | 'setFromDate'
  | 'toDate'
  | 'setToDate'
  | 'downloadBackup'
  | 'importBackup'
  | 'filtered'
  | 'removeRecord'
>;
export default function ActivitiesPanel({
  setEditing,
  date,
  query,
  setQuery,
  categoryFilter,
  setCategoryFilter,
  dateFilter,
  setDateFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  downloadBackup,
  importBackup,
  filtered,
  removeRecord,
}: Props) {
  return (
    <section className={styles.card}>
      <div className={styles.cardhead}>
        <div>
          <p className={styles.eyebrow}>CADASTRO</p>
          <h2>Histórico de atividades</h2>
          <p className={styles.subhead}>Cada linha representa uma ação ou um acompanhamento.</p>
        </div>
        <button className={styles.primary} onClick={() => setEditing(freshEntry(date))}>
          <Plus size={17} /> Novo registro
        </button>
      </div>
      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={17} />
          <input
            placeholder="Buscar cliente ou observação"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className={styles.filter}>
          <Filter size={17} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {(Object.keys(categories) as Category[]).map((k) => (
              <option key={k} value={k}>
                {categories[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filter}>
          Período
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as 'all' | 'selected' | 'range')}>
            <option value="all">Todas as datas</option>
            <option value="selected">Data selecionada</option>
            <option value="range">Intervalo</option>
          </select>
        </label>
        {dateFilter === 'range' && (
          <>
            <label className={styles.filter}>De
              <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className={styles.filter}>Até
              <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </>
        )}
        <button className={styles.secondary} onClick={downloadBackup}>
          <Download size={16} /> Backup JSON
        </button>
        <label className={styles.secondary}>
          <Database size={16} /> Importar JSON{' '}
          <input
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) importBackup(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Categoria</th>
              <th>Ação</th>
              <th>Status</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  {validateEntry(r).length > 0 && <span className={styles.invalid}>Revisar</span>}
                </td>
                <td>{categories[r.category]}{r.source === 'operational' && <small> · Central Operacional</small>}</td>
                <td>{actions[r.action]}</td>
                <td>
                  <span className={styles.statusPill}>{statuses[r.status]}</span>
                </td>
                <td>{fmt(r.date)}</td>
                <td className={styles.tableactions}>
                  {r.source !== 'operational' ? (
                    <>
                      <button onClick={() => setEditing({ ...r })} aria-label={`Editar ${r.name}`}>Editar</button>
                      <button onClick={() => removeRecord(r.id)} aria-label={`Excluir ${r.name}`}><Trash2 size={16} /></button>
                    </>
                  ) : (
                    <span title="Atividade registrada na Central Operacional. Consulte o histórico do cliente.">Histórico operacional</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className={styles.empty}>Nenhuma atividade encontrada.</div>}
      </div>
      <div className={styles.tablefooter}>
        Exibindo {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'} · alterações
        salvas diretamente no SQLite.
      </div>
    </section>
  );
}
