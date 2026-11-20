'use client';
import {
Save,
X
} from 'lucide-react';
import styles from '../../../app/page.module.css';
import type { Task } from '../../../lib/types';
import type { DashboardController } from './use-dashboard';
type Props=Pick<DashboardController,"setEditingTask"|"editingTask"|"saveDaily"|"saving">;
export default function DailyDialog({setEditingTask,editingTask,saveDaily,saving}:Props){if(!editingTask)return null;return ((
        <div
          className={styles.modalBackdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingTask(null);
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h2>Demanda da daily</h2>
              <button className={styles.iconbtn} onClick={() => setEditingTask(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.formGrid}>
              <label className={`${styles.field} ${styles.wide}`}>
                Descrição da demanda
                <input
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                Status
                <select
                  value={editingTask.status}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, status: e.target.value as Task['status'] })
                  }
                >
                  {['Pendente', 'Em andamento', 'Concluída', 'Aguardando alinhamento'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Data
                <input
                  type="date"
                  value={editingTask.date}
                  onChange={(e) => setEditingTask({ ...editingTask, date: e.target.value })}
                />
              </label>
              <label className={`${styles.field} ${styles.wide}`}>
                Detalhes / entregas
                <textarea
                  value={editingTask.details}
                  rows={4}
                  onChange={(e) => setEditingTask({ ...editingTask, details: e.target.value })}
                />
              </label>
            </div>
            <div className={styles.modalFoot}>
              <button className={styles.secondary} onClick={() => setEditingTask(null)}>
                Cancelar
              </button>
              <button className={styles.primary} onClick={saveDaily} disabled={saving}>
                <Save size={16} /> Salvar demanda
              </button>
            </div>
          </div>
        </div>
      ));}
