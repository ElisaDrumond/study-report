'use client';
import { ArrowRight, FileText, Plus } from 'lucide-react';
import styles from '../../../app/page.module.css';
import type { DashboardController } from './use-dashboard';
type Props = Pick<
  DashboardController,
  | 'setTab'
  | 'history'
  | 'setSubject'
  | 'setBody'
  | 'setOriginalBody'
  | 'setRefinedBody'
  | 'setRefinementStyle'
  | 'setRefinedAt'
  | 'setGeneratedDate'
  | 'setChosen'
  | 'setRefineError'
  | 'setDate'
  | 'setGenerated'
>;
export default function ReportHistory({
  setTab,
  history,
  setSubject,
  setBody,
  setOriginalBody,
  setRefinedBody,
  setRefinementStyle,
  setRefinedAt,
  setGeneratedDate,
  setChosen,
  setRefineError,
  setDate,
  setGenerated,
}: Props) {
  return (
    <section className={styles.card}>
      <div className={styles.cardhead}>
        <div>
          <p className={styles.eyebrow}>VERSÕES SALVAS</p>
          <h2>Histórico de relatórios</h2>
          <p className={styles.subhead}>
            Cada salvamento cria uma nova versão, preservando as anteriores.
          </p>
        </div>
        <button className={styles.secondary} onClick={() => setTab('reports')}>
          <Plus size={16} /> Novo report
        </button>
      </div>
      {history.map((h) => (
        <div className={styles.historyItem} key={h.id}>
          <div className={styles.historyIcon}>
            <FileText size={20} />
          </div>
          <div>
            <b>{h.subject}</b>
            <p>Salvo em {new Date(h.createdAt).toLocaleString('pt-BR')}</p>
          </div>
          <button
            className={styles.secondary}
            onClick={() => {
              setSubject(h.subject);
              setBody(
                h.refinedBody && h.body === h.refinedBody ? h.originalBody || h.body : h.body,
              );
              setOriginalBody(h.originalBody || h.body);
              setRefinedBody(h.refinedBody || '');
              setRefinementStyle(h.refinementStyle || 'formal');
              setRefinedAt(h.refinedAt || '');
              setGeneratedDate(h.date);
              setChosen(h.refinedBody && h.body === h.refinedBody ? 'refined' : 'original');
              setRefineError('');
              setDate(h.date);
              setGenerated(true);
              setTab('reports');
            }}
          >
            Abrir versão <ArrowRight size={16} />
          </button>
        </div>
      ))}
      {!history.length && <div className={styles.empty}>Os relatórios salvos aparecerão aqui.</div>}
    </section>
  );
}
