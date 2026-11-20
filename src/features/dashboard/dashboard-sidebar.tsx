'use client';
import {
CloudOff,
ShieldCheck,
Sparkles
} from 'lucide-react';
import styles from '../../../app/page.module.css';
import type { DashboardController } from './use-dashboard';
type Props=Pick<DashboardController,"navOpen"|"navigation"|"tab"|"setTab"|"setNavOpen">;
export default function DashboardSidebar({navOpen,navigation,tab,setTab,setNavOpen}:Props){return (<aside className={`${styles.sidebar} ${navOpen ? styles.navOpen : ''}`}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <Sparkles size={21} />
          </div>
          <div>
            <strong>Study & Work</strong>
            <small>REPORTS FINANCEIROS</small>
          </div>
        </div>
        <p className={styles.navlabel}>WORKSPACE</p>
        <nav className={styles.nav}>
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`${styles.navitem} ${tab === id ? styles.active : ''}`}
              onClick={() => {
                setTab(id);
                setNavOpen(false);
              }}
            >
              <Icon size={18} />
              {label}
              {tab === id && <span className={styles.navdot} />}
            </button>
          ))}
        </nav>
        <div className={styles.sidebottom}>
          <div className={styles.secure}>
            <ShieldCheck size={18} /> <b>Ambiente local</b>
          </div>
          <p>Seus registros ficam salvos em SQLite no computador. Sem sincronização externa.</p>
          <div className={styles.vtag}>
            <CloudOff size={14} /> IA opcional · v2.0
          </div>
        </div>
      </aside>);}
