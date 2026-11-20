'use client';
import {
  Activity,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefinementStyle } from '../../../lib/refinement';
import type { Client, Installment } from '../../../lib/collection-types';
import { categories, cleanEntry, fmt, follow, validateEntry } from '../../../lib/rules';
import type { Entry, SavedReport, Task } from '../../../lib/types';
import type { Tab } from './dashboard-model';
import { route, today } from './dashboard-model';
export function useDashboard() {
  const [tab, setTab] = useState<Tab>('central');
  const [clients, setClients] = useState<Client[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [date, setDate] = useState(today());
  const [records, setRecords] = useState<Entry[]>([]),
    [tasks, setTasks] = useState<Task[]>([]),
    [history, setHistory] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'selected' | 'range'>('selected');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [editing, setEditing] = useState<Entry | null>(null),
    [editingTask, setEditingTask] = useState<Task | null>(null);
  const [subject, setSubject] = useState(''),
    [body, setBody] = useState(''),
    [nextSteps, setNextSteps] = useState(''),
    [extra, setExtra] = useState('');
  const [generated, setGenerated] = useState(false),
    [excluded, setExcluded] = useState(0),
    [navOpen, setNavOpen] = useState(false);
  const [refinementStyle, setRefinementStyle] = useState<RefinementStyle>('formal');
  const [refinedBody, setRefinedBody] = useState(''),
    [originalBody, setOriginalBody] = useState(''),
    [refinedAt, setRefinedAt] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState('');
  const [chosen, setChosen] = useState<'original' | 'refined'>('original');
  const [generatedDate, setGeneratedDate] = useState('');
  async function refine() {
    setRefining(true);
    setRefineError('');
    try {
      const result = await route('reports/refine', 'POST', {
        date: generatedDate,
        extra,
        nextSteps,
        originalBody,
        style: refinementStyle,
      });
      setOriginalBody(result.original.body);
      setRefinedBody(result.refined.body);
      setRefinedAt(result.generatedAt);
      setChosen('refined');
      notice('Refinamento concluído. Revise as duas versões antes de salvar.');
    } catch (e) {
      setRefineError((e as Error).message);
    } finally {
      setRefining(false);
    }
  }
  const notice = (msg: string) => setToast(msg);
  const refresh = useCallback(async () => {
    try {
      const [r, t, h, operations] = await Promise.all([
        route('records'),
        route('tasks'),
        route('reports'),
        route('operations'),
      ]);
      setRecords(r);
      setTasks(t);
      setHistory(h);
      setClients(operations.clients);
      setInstallments(operations.installments);
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Clients added in the operational view must be available when returning to activities.
  useEffect(() => {
    if (tab !== 'activities') return;
    let active = true;
    Promise.all([route('operations'), route('records')])
      .then(([operations, latestRecords]) => {
        if (active) {
          setClients(operations.clients);
          setInstallments(operations.installments);
          setRecords(latestRecords);
        }
      })
      .catch((error) => {
        if (active) setToast((error as Error).message);
      });
    return () => {
      active = false;
    };
  }, [tab]);
  const filtered = useMemo(
    () =>
      records
        .filter(
          (r) =>
            (categoryFilter === 'all' || r.category === categoryFilter) &&
            (dateFilter === 'all' ||
              (dateFilter === 'selected' && r.date === date) ||
              (dateFilter === 'range' &&
                (!fromDate || r.date >= fromDate) &&
                (!toDate || r.date <= toDate))) &&
            (!query ||
              [r.name, r.notes, categories[r.category]]
                .join(' ')
                .toLocaleLowerCase('pt-BR')
                .includes(query.toLocaleLowerCase('pt-BR'))),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [records, categoryFilter, query, dateFilter, date, fromDate, toDate],
  );
  const selected = records.filter((r) => r.date === date && r.action !== 'none');
  const unique = new Set(selected.map((r) => r.name.trim().toLocaleLowerCase('pt-BR'))).size;
  const followRecords = records.filter((r) => follow(r.category));
  const followUnique = new Set(followRecords.map((r) => r.name.toLocaleLowerCase('pt-BR'))).size;
  const upcoming = records.filter((r) => r.scheduled && r.status === 'payment_scheduled');
  const invalid = records.filter((r) => validateEntry(r).length > 0).length;
  const stats = [
    {
      label: 'Ações no dia',
      value: selected.length,
      sub: 'Registros de ' + fmt(date),
      icon: Activity,
      tone: 'purple',
    },
    {
      label: 'Clientes únicos',
      value: unique,
      sub: 'Atendidos nesta data',
      icon: Users,
      tone: 'blue',
    },
    {
      label: 'Em acompanhamento',
      value: followUnique,
      sub: 'Clientes com atraso',
      icon: ClipboardList,
      tone: 'pink',
    },
    {
      label: 'Pagamentos agendados',
      value: new Set(upcoming.map((r) => r.name.toLowerCase())).size,
      sub: 'Na carteira registrada',
      icon: CalendarDays,
      tone: 'green',
    },
  ];
  async function saveRecord() {
    if (!editing) return;
    const selectedClient = clients.find((client) => client.id === editing.clientId);
    const r = cleanEntry({ ...editing, name: selectedClient?.name || editing.name });
    const errors = validateEntry(r);
    if (errors.length) {
      notice('Corrija o registro: ' + errors.join('; '));
      return;
    }
    setSaving(true);
    try {
      await route('records', 'POST', r);
      setEditing(null);
      await refresh();
      notice('Registro salvo no banco de dados local.');
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function removeRecord(id: string) {
    if (!confirm('Excluir permanentemente este registro?')) return;
    try {
      await route('records', 'DELETE', { id });
      await refresh();
      notice('Registro excluído.');
    } catch (e) {
      notice((e as Error).message);
    }
  }
  async function saveDaily() {
    if (!editingTask) return;
    setSaving(true);
    try {
      await route('tasks', 'POST', editingTask);
      setEditingTask(null);
      await refresh();
      notice('Demanda salva.');
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function removeTask(id: string) {
    if (!confirm('Excluir esta demanda?')) return;
    try {
      await route('tasks', 'DELETE', { id });
      await refresh();
    } catch (e) {
      notice((e as Error).message);
    }
  }
  async function generate() {
    try {
      const result = await route('reports', 'POST', { date, nextSteps, extra });
      setSubject(result.subject);
      setBody(result.body);
      setOriginalBody(result.body);
      setRefinedBody('');
      setRefinedAt('');
      setRefineError('');
      setChosen('original');
      setGeneratedDate(date);
      setExcluded(result.excluded);
      setGenerated(true);
      setTab('reports');
      notice('Relatório gerado! Revise antes de copiar ou salvar.');
    } catch (e) {
      notice((e as Error).message);
    }
  }
  async function saveGenerated() {
    if (!generated || !body.trim()) return;
    setSaving(true);
    try {
      await route('reports', 'POST', {
        date: generatedDate || date,
        subject,
        body: chosen === 'refined' ? refinedBody : body,
        originalBody: originalBody || body,
        refinedBody: refinedBody || null,
        refinementStyle: refinedBody ? refinementStyle : null,
        refinedAt: refinedAt || null,
        persist: true,
      });
      await refresh();
      notice('Versão do relatório salva no histórico.');
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function copy() {
    if (!body) {
      notice('Gere um relatório primeiro.');
      return;
    }
    try {
      await navigator.clipboard.writeText(chosen === 'refined' ? refinedBody : body);
      notice('Texto copiado para a área de transferência.');
    } catch {
      notice('Não foi possível copiar automaticamente. Selecione o texto manualmente.');
    }
  }
  async function downloadBackup() {
    try {
      const operations = await route('operations');
      const blob = new Blob(
        [
          JSON.stringify(
            {
              version: 5,
              exportedAt: new Date().toISOString(),
              records,
              tasks,
              history,
              operations,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `backup-report-financeiro-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notice((e as Error).message);
    }
  }
  async function importBackup(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.records)) throw Error('Formato de backup inválido');
      if (
        !confirm(
          `Importar os registros válidos do backup (${data.records.length} linhas)? Registros existentes não serão apagados.`,
        )
      )
        return;
      const result = await route('import', 'POST', data);
      await refresh();
      notice(
        `${result.imported} registros importados; ${result.skipped} ignorados por estarem incompletos.`,
      );
    } catch (e) {
      notice((e as Error).message);
    }
  }
  const navigation: [Tab, string, typeof LayoutDashboard][] = [
    ['central', 'Central Operacional', LayoutDashboard],
    ['clients', 'Clientes e parcelas', Users],
    ['calendar', 'Calendário Operacional', CalendarDays],
    ['overview', 'Visão geral', Activity],
    ['activities', 'Atividades', ClipboardList],
    ['daily', 'Demandas da daily', CheckCircle2],
    ['reports', 'Gerar report', FileText],
    ['history', 'Histórico', BookOpen],
  ];
  return {
    clients,
    installments,
    navOpen,
    navigation,
    tab,
    setTab,
    setNavOpen,
    refining,
    date,
    setDate,
    setGenerated,
    loading,
    stats,
    records,
    upcoming,
    generate,
    invalid,
    setEditing,
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
    setEditingTask,
    tasks,
    removeTask,
    extra,
    setExtra,
    nextSteps,
    setNextSteps,
    refinementStyle,
    setRefinementStyle,
    setRefinedBody,
    setChosen,
    generated,
    saving,
    refine,
    refinedBody,
    refineError,
    excluded,
    subject,
    setSubject,
    body,
    setBody,
    chosen,
    copy,
    saveGenerated,
    history,
    setOriginalBody,
    setRefinedAt,
    setGeneratedDate,
    setRefineError,
    toast,
    setToast,
    editing,
    saveRecord,
    editingTask,
    saveDaily,
  };
}

export type DashboardController = ReturnType<typeof useDashboard>;
