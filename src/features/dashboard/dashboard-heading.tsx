'use client';
import {
CalendarDays
} from 'lucide-react';
import styles from '../../../app/page.module.css';
import type { DashboardController } from './use-dashboard';
type Props=Pick<DashboardController,"navigation"|"tab"|"refining"|"date"|"setDate"|"setGenerated">;
export default function DashboardHeading({navigation,tab,refining,date,setDate,setGenerated}:Props){return (<header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>OPERACIONAL & FINANCEIRO</p>
            <h1>{navigation.find((x) => x[0] === tab)?.[1]}</h1>
            <p className={styles.subtitle}>
              Organize as atividades e transforme os registros em relatórios profissionais.
            </p>
          </div>
          {!['central', 'clients', 'calendar'].includes(tab) && (
            <div className={styles.datebox}>
              <CalendarDays size={17} />
              <input
                aria-label="Data de referência"
                type="date"
                disabled={refining}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setGenerated(false);
                }}
              />
            </div>
          )}
        </header>);}
