import type { Action, Category, Entry, Status, Task } from './types';
export const categories: Record<Category, string> = {
  current: 'Cobrança do mês vigente',
  email: 'E-mail respondido',
  payment: 'Pagamento confirmado / CRM atualizado',
  late: 'Acompanhamento — atraso até 30 dias',
  lateover: 'Acompanhamento — atraso superior a 30 dias',
  renegotiation: 'Renegociação',
  message: 'Mensagem respondida',
  conciliation: 'Conciliação',
  other: 'Outra atividade',
};
export const actions: Record<Action, string> = {
  none: 'Sem ação no dia',
  email_sent: 'E-mail enviado',
  whatsapp_sent: 'WhatsApp enviado',
  both_sent: 'E-mail e WhatsApp enviados',
  email_replied: 'E-mail respondido',
  message_replied: 'Mensagem respondida',
  payment_checked: 'Pagamento conferido / CRM atualizado',
  conciliation_done: 'Conciliação realizada',
  call: 'Ligação realizada',
  followup: 'Acompanhamento / conferência',
  other_action: 'Outra ação',
};
export const statuses: Record<Status, string> = {
  none: 'Não informado',
  monitoring: 'Em acompanhamento',
  awaiting_reply: 'Aguardando retorno',
  payment_scheduled: 'Pagamento agendado',
  payment_confirmed: 'Pagamento confirmado',
  closed: 'Concluído',
  proposal_received: 'Proposta recebida',
  awaiting_approval: 'Aguardando aprovação',
  approved: 'Aprovada',
  not_approved: 'Não aprovada',
  agreement_active: 'Acordo formalizado',
  external_collection: 'Encaminhado à cobrança externa',
};
export const allowed: Record<Category, { actions: Action[]; statuses: Status[] }> = {
  current: {
    actions: ['none', 'email_sent', 'whatsapp_sent', 'both_sent', 'call', 'followup'],
    statuses: [
      'none',
      'monitoring',
      'awaiting_reply',
      'payment_scheduled',
      'payment_confirmed',
      'closed',
    ],
  },
  email: {
    actions: ['email_replied'],
    statuses: ['none', 'awaiting_reply', 'closed', 'monitoring'],
  },
  payment: { actions: ['payment_checked'], statuses: ['payment_confirmed', 'closed'] },
  late: {
    actions: ['none', 'email_sent', 'whatsapp_sent', 'both_sent', 'call', 'followup'],
    statuses: [
      'monitoring',
      'awaiting_reply',
      'payment_scheduled',
      'payment_confirmed',
      'closed',
      'external_collection',
    ],
  },
  lateover: {
    actions: ['none', 'email_sent', 'whatsapp_sent', 'both_sent', 'call', 'followup'],
    statuses: [
      'monitoring',
      'awaiting_reply',
      'payment_scheduled',
      'payment_confirmed',
      'closed',
      'external_collection',
    ],
  },
  renegotiation: {
    actions: ['none', 'email_sent', 'whatsapp_sent', 'both_sent', 'call', 'followup'],
    statuses: [
      'proposal_received',
      'awaiting_approval',
      'approved',
      'not_approved',
      'agreement_active',
    ],
  },
  message: {
    actions: ['message_replied'],
    statuses: ['none', 'awaiting_reply', 'monitoring', 'closed'],
  },
  conciliation: {
    actions: ['none', 'conciliation_done', 'followup'],
    statuses: ['none', 'monitoring', 'awaiting_reply', 'payment_confirmed', 'closed'],
  },
  other: {
    actions: [
      'none',
      'email_sent',
      'whatsapp_sent',
      'both_sent',
      'email_replied',
      'message_replied',
      'payment_checked',
      'conciliation_done',
      'call',
      'followup',
      'other_action',
    ],
    statuses: [
      'none',
      'monitoring',
      'awaiting_reply',
      'payment_scheduled',
      'payment_confirmed',
      'closed',
      'external_collection',
    ],
  },
};
export const defaultAction: Record<Category, Action> = {
  current: 'both_sent',
  email: 'email_replied',
  payment: 'payment_checked',
  late: 'none',
  lateover: 'none',
  renegotiation: 'followup',
  message: 'message_replied',
  conciliation: 'conciliation_done',
  other: 'other_action',
};
export const defaultStatus: Record<Category, Status> = {
  current: 'monitoring',
  email: 'closed',
  payment: 'payment_confirmed',
  late: 'monitoring',
  lateover: 'monitoring',
  renegotiation: 'proposal_received',
  message: 'closed',
  conciliation: 'closed',
  other: 'none',
};
export const follow = (cat: Category) => cat === 'late' || cat === 'lateover';
export const isDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
  const [y, m, d] = v.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d));
  return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
};
export const fmt = (v: string) => (v && isDate(v) ? v.split('-').reverse().join('/') : v);
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export function cleanEntry(raw: Partial<Entry>): Entry {
  const category = (
    raw.category && raw.category in categories ? raw.category : 'other'
  ) as Category;
  const days =
    raw.days === null || raw.days === undefined || String(raw.days) === ''
      ? null
      : Number(raw.days);
  const effectiveCategory =
    follow(category) && days !== null && Number.isFinite(days)
      ? days > 30
        ? 'lateover'
        : 'late'
      : category;
  const action = allowed[effectiveCategory].actions.includes(raw.action as Action)
    ? (raw.action as Action)
    : defaultAction[effectiveCategory];
  const status = allowed[effectiveCategory].statuses.includes(raw.status as Status)
    ? (raw.status as Status)
    : defaultStatus[effectiveCategory];
  return {
    id: String(raw.id || crypto.randomUUID()),
    clientId: typeof raw.clientId === 'string' ? raw.clientId.trim() : '',
    installmentId: typeof raw.installmentId === 'string' ? raw.installmentId.trim() : '',
    name: String(raw.name || '').trim(),
    category: effectiveCategory,
    action,
    status,
    date: String(raw.date || ''),
    days: days === null ? null : days,
    lastContact: String(raw.lastContact || ''),
    scheduled: String(raw.scheduled || ''),
    notes: String(raw.notes || ''),
  };
}
export function validateEntry(r: Entry): string[] {
  const errors: string[] = [];
  if (!r.name.trim()) errors.push('Nome obrigatório');
  if (!allowed[r.category]?.actions.includes(r.action)) errors.push('Ação incompatível');
  if (!allowed[r.category]?.statuses.includes(r.status)) errors.push('Status incompatível');
  if (r.action !== 'none' && !isDate(r.date)) errors.push('Data da ação obrigatória');
  if (r.date && !isDate(r.date)) errors.push('Data da ação inválida');
  if (r.lastContact && !isDate(r.lastContact)) errors.push('Último contato inválido');
  if (r.scheduled && !isDate(r.scheduled)) errors.push('Pagamento previsto inválido');
  if (follow(r.category) && (r.days === null || !Number.isInteger(r.days) || r.days < 0))
    errors.push('Informe os dias em atraso');
  if (follow(r.category) && r.days !== null && r.days > 30 !== (r.category === 'lateover'))
    errors.push('Categoria de atraso inconsistente');
  if (r.status === 'payment_scheduled' && !r.scheduled)
    errors.push('Data do pagamento agendado obrigatória');
  return errors;
}
const unique = (rows: Entry[]) =>
  new Set(rows.map((r) => r.clientId || 'name:' + r.name.trim().toLocaleLowerCase('pt-BR'))).size;
const bullet = (items: string[]) => items.map((s) => `- ${s}`).join('\n');
export function buildReport(
  date: string,
  entries: Entry[],
  tasks: Task[],
  extra = '',
  nextSteps = '',
) {
  const valid = entries.filter((r) => validateEntry(r).length === 0),
    excluded = entries.length - valid.length;
  const daily = valid.filter((r) => r.date === date && r.action !== 'none');
  // A carteira monitora o último estado de cada cliente, sem confundir histórico com ações do dia.
  const latestByClient = new Map<string, Entry>();
  for (const r of valid.filter((r) => follow(r.category))) {
    const key = r.name.toLocaleLowerCase('pt-BR');
    const prev = latestByClient.get(key);
    if (
      !prev ||
      (r.updatedAt || r.createdAt || r.date || '') >
        (prev.updatedAt || prev.createdAt || prev.date || '')
    )
      latestByClient.set(key, r);
  }
  const followUps = [...latestByClient.values()];
  const reneg = [
    ...new Map(
      valid
        .filter((r) => r.category === 'renegotiation')
        .map((r) => [r.name.toLocaleLowerCase('pt-BR'), r]),
    ).values(),
  ];
  const sections: string[] = [];
  let i = 0;
  const add = (header: string, txt: string) => {
    if (txt.trim()) sections.push(`${++i}. ${header}\n\n${txt}`);
  };
  const formatEntry = (r: Entry) =>
    `${r.name}${r.notes ? ` — ${r.notes.trim()}` : ''}${r.status !== 'none' ? ` (Situação: ${statuses[r.status]})` : ''}`;
  const inCat = (cat: Category) => daily.filter((r) => r.category === cat);
  const taskToday = tasks.filter((t) => t.date === date && t.title.trim());
  if (taskToday.length)
    add(
      'Demandas e alinhamentos operacionais',
      bullet(taskToday.map((t) => `${t.title} — ${t.status}${t.details ? `. ${t.details}` : ''}`)),
    );
  const emails = inCat('email');
  if (emails.length)
    add(
      'E-mails respondidos',
      `${bullet(emails.map(formatEntry))}\n\n${plural(emails.length, 'e-mail respondido', 'e-mails respondidos')}.`,
    );
  const msgs = inCat('message');
  if (msgs.length)
    add(
      'Mensagens respondidas',
      `${bullet(msgs.map(formatEntry))}\n\n${plural(msgs.length, 'mensagem respondida', 'mensagens respondidas')}.`,
    );
  const pays = inCat('payment');
  if (pays.length)
    add(
      'Pagamentos confirmados e atualização do CRM',
      `${bullet(pays.map(formatEntry))}\n\n${plural(pays.length, 'registro atualizado', 'registros atualizados')}.`,
    );
  const current = inCat('current');
  if (current.length)
    add(
      'Cobranças do mês vigente',
      `${bullet(current.map((r) => `${r.name} — ${actions[r.action]}${r.notes ? `. ${r.notes}` : ''}`))}\n\n${plural(unique(current), 'cliente contatado', 'clientes contatados')}.`,
    );
  const conc = inCat('conciliation');
  if (conc.length)
    add(
      'Conciliações financeiras',
      `${bullet(conc.map((r) => `${r.name}${r.notes ? ` — ${r.notes}` : ''}`))}\n\n${plural(conc.length, 'conciliação concluída/registrada', 'conciliações concluídas/registradas')}.`,
    );
  if (reneg.length)
    add(
      'Renegociações',
      bullet(reneg.map((r) => `${r.name} — ${statuses[r.status]}${r.notes ? `. ${r.notes}` : ''}`)),
    );
  for (const [cat, heading] of [
    ['late', 'Acompanhamento de inadimplência — Até 30 dias'],
    ['lateover', 'Acompanhamento de inadimplência — Superior a 30 dias'],
  ] as [Category, string][]) {
    const rows = followUps.filter((r) => r.category === cat);
    if (rows.length)
      add(
        heading,
        `${bullet(rows.map((r) => `${r.name} — ${plural(r.days || 0, 'dia', 'dias')} em atraso. ${statuses[r.status]}${r.date === date && r.action !== 'none' ? `; ${actions[r.action]} em ${fmt(r.date)}` : ''}${r.lastContact ? `; último contato: ${fmt(r.lastContact)}` : ''}${r.scheduled ? `; pagamento previsto: ${fmt(r.scheduled)}` : ''}${r.notes ? `. ${r.notes}` : ''}`))}\n\n${plural(rows.length, 'cliente em acompanhamento', 'clientes em acompanhamento')}.`,
      );
  }
  const other = inCat('other');
  if (other.length) add('Outras atividades', bullet(other.map(formatEntry)));
  if (extra.trim()) add('Observações gerais', extra.trim());
  const lines = [];
  if (daily.length)
    lines.push(
      `${plural(daily.length, 'ação realizada', 'ações realizadas')} em ${plural(unique(daily), 'cliente único', 'clientes únicos')} na data.`,
    );
  if (followUps.length)
    lines.push(
      `${plural(followUps.length, 'cliente', 'clientes')} em acompanhamento por inadimplência.`,
    );
  const scheduled = unique(valid.filter((r) => r.status === 'payment_scheduled' && r.scheduled));
  if (scheduled)
    lines.push(
      `${plural(scheduled, 'cliente com pagamento agendado', 'clientes com pagamento agendado')}.`,
    );
  if (reneg.length)
    lines.push(
      `${plural(reneg.length, 'renegociação registrada', 'renegociações registradas')}, ${reneg.filter((r) => r.status === 'awaiting_approval').length} aguardando aprovação.`,
    );
  if (taskToday.length)
    lines.push(
      `Demandas: ${taskToday.filter((t) => t.status === 'Concluída').length} concluídas de ${taskToday.length} registradas.`,
    );
  if (lines.length) add('Consolidado das atividades e acompanhamentos', bullet(lines));
  if (nextSteps.trim())
    add(
      'Pendências e próximos encaminhamentos',
      bullet(
        nextSteps
          .split('\n')
          .map((s) => s.replace(/^[\s•-]+/, '').trim())
          .filter(Boolean),
      ),
    );
  else if (followUps.length)
    add(
      'Pendências e próximos encaminhamentos',
      'Os clientes com pendências financeiras permanecem em monitoramento, considerando os últimos contatos, os pagamentos previstos e as atividades programadas no CRM.',
    );
  return {
    subject: `Relatório de Atividades | Financeiro – ${fmt(date)}`,
    body: [
      'Prezadas, boa tarde!',
      '',
      'Encaminho o relatório das atividades realizadas em ' +
        fmt(date) +
        ', incluindo as entregas concluídas, as atualizações financeiras e os acompanhamentos em andamento.',
      '',
      ...sections.map((x) => x + '\n'),
      'Permaneço à disposição para eventuais orientações.',
      '',
      'Atenciosamente,',
      'Elisa Anjo',
    ]
      .join('\n')
      .replace(/\n{4,}/g, '\n\n\n'),
    excluded,
    dailyActions: daily.length,
    uniqueClients: unique(daily),
    followUps: followUps.length,
  };
}
