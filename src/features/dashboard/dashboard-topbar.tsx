'use client';
import { Menu } from 'lucide-react';
import styles from '../../../app/page.module.css';
import type { DashboardController } from './use-dashboard';
type Props = Pick<DashboardController, 'setNavOpen' | 'navOpen' | 'navigation' | 'tab'>;
export default function DashboardTopbar({ setNavOpen, navOpen, navigation, tab }: Props) {
  return (
    <div className={styles.topbar}>
      <button
        className={styles.menubtn}
        onClick={() => setNavOpen(!navOpen)}
        aria-label="Abrir menu"
      >
        <Menu size={21} />
      </button>
      <div className={styles.breadcrumb}>
        Workspace <span>/</span> Financeiro <span>/</span>{' '}
        <b>{navigation.find((x) => x[0] === tab)?.[1]}</b>
      </div>
      <div className={styles.todayTag}>
        <span className={styles.online} /> Dados locais
      </div>
    </div>
  );
}
