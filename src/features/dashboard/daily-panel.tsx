'use client';
import {
Check,
Plus,
Trash2
} from 'lucide-react';
import styles from '../../../app/page.module.css';
import {
fmt
} from '../../../lib/rules';
import { freshTask } from './dashboard-model';
import type { DashboardController } from './use-dashboard';
type Props=Pick<DashboardController,"setEditingTask"|"date"|"tasks"|"removeTask">;
export default function DailyPanel({setEditingTask,date,tasks,removeTask}:Props){return ((
              <section className={styles.card}>
                <div className={styles.cardhead}>
                  <div>
                    <p className={styles.eyebrow}>DEMANDAS DA GESTÃO</p>
                    <h2>Alinhamentos da daily</h2>
                    <p className={styles.subhead}>
                      Registre as entregas, os status e os encaminhamentos.
                    </p>
                  </div>
                  <button
                    className={styles.primary}
                    onClick={() => setEditingTask(freshTask(date))}
                  >
                    <Plus size={17} /> Nova demanda
                  </button>
                </div>
                <div className={styles.taskList}>
                  {tasks
                    .filter((t) => t.date === date)
                    .map((t) => (
                      <div className={styles.task} key={t.id}>
                        <div className={styles.taskcheck}>
                          <Check size={18} />
                        </div>
                        <div>
                          <b>{t.title}</b>
                          <p>{t.details || 'Sem observações adicionais'}</p>
                        </div>
                        <span className={styles.statusPill}>{t.status}</span>
                        <button className={styles.iconbtn} onClick={() => setEditingTask({ ...t })}>
                          Editar
                        </button>
                        <button
                          className={styles.iconbtn}
                          onClick={() => removeTask(t.id)}
                          aria-label="Excluir demanda"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  {tasks.filter((t) => t.date === date).length === 0 && (
                    <div className={styles.empty}>
                      Não há demandas registradas para {fmt(date)}.
                    </div>
                  )}
                </div>
              </section>
            ));}
