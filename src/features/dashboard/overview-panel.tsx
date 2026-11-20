'use client';
import { AlertCircle, ArrowRight, CalendarDays, Sparkles } from 'lucide-react';
import styles from '../../../app/page.module.css';
import { categories, fmt } from '../../../lib/rules';
import type { DashboardController } from './use-dashboard';
type Props = Pick<
  DashboardController,
  'stats' | 'setTab' | 'records' | 'upcoming' | 'refining' | 'generate' | 'invalid'
>;
export default function OverviewPanel({
  stats,
  setTab,
  records,
  upcoming,
  refining,
  generate,
  invalid,
}: Props) {
  return (
    <>
      <div className={styles.stats}>
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div className={styles.stat} key={s.label}>
              <div className={styles.stathead}>
                <span>{s.label}</span>
                <div className={`${styles.statIcon} ${styles[s.tone]}`}>
                  <Icon size={18} />
                </div>
              </div>
              <strong>{s.value}</strong>
              <small>{s.sub}</small>
            </div>
          );
        })}
      </div>
      <div className={styles.twoCols}>
        <section className={styles.card}>
          <div className={styles.cardhead}>
            <div>
              <p className={styles.eyebrow}>ATIVIDADES</p>
              <h2>Registros recentes</h2>
            </div>
            <button className={styles.textbtn} onClick={() => setTab('activities')}>
              Ver todos <ArrowRight size={15} />
            </button>
          </div>
          <div className={styles.miniList}>
            {records.slice(0, 6).map((r) => (
              <div className={styles.miniItem} key={r.id}>
                <div className={styles.avatar}>{r.name[0]?.toUpperCase() || '?'}</div>
                <div>
                  <b>{r.name}</b>
                  <small>{categories[r.category]}</small>
                </div>
                <span className={styles.rightDate}>{fmt(r.date)}</span>
              </div>
            ))}
            {records.length === 0 && (
              <div className={styles.empty}>
                Nenhum registro ainda. Adicione sua primeira atividade.
              </div>
            )}
          </div>
        </section>
        <section className={styles.card}>
          <div className={styles.cardhead}>
            <div>
              <p className={styles.eyebrow}>ACOMPANHAMENTO</p>
              <h2>Próximos pagamentos</h2>
            </div>
            <CalendarDays size={20} color="#6d7196" />
          </div>
          {upcoming
            .sort((a, b) => a.scheduled.localeCompare(b.scheduled))
            .slice(0, 6)
            .map((r) => (
              <div className={styles.paymentItem} key={r.id}>
                <div>
                  <b>{r.name}</b>
                  <small>Pagamento previsto</small>
                </div>
                <span className={styles.pill}>{fmt(r.scheduled)}</span>
              </div>
            ))}
          {upcoming.length === 0 && (
            <div className={styles.empty}>Nenhum pagamento agendado registrado.</div>
          )}
        </section>
      </div>
      <div className={styles.bottomActions}>
        <div>
          <Sparkles size={23} />
          <div>
            <b>Seu relatório está a um clique.</b>
            <span>Gere um e-mail organizado a partir dos registros da data selecionada.</span>
          </div>
        </div>
        <button className={styles.primary} disabled={refining} onClick={generate}>
          Gerar relatório <ArrowRight size={17} />
        </button>
      </div>
      {invalid > 0 && (
        <div className={styles.alert}>
          <AlertCircle size={18} />
          {invalid} {invalid === 1 ? 'registro precisa' : 'registros precisam'} de revisão e{' '}
          {invalid === 1 ? 'será ignorado' : 'serão ignorados'} no report.
        </div>
      )}
    </>
  );
}
