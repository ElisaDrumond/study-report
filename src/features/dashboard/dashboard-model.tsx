'use client';
import type { Entry,Task } from '../../../lib/types';
export type Tab =
  'central' | 'clients' | 'calendar' | 'overview' | 'activities' | 'daily' | 'reports' | 'history';
export const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
};
export const freshEntry = (date: string): Entry => ({
  id: crypto.randomUUID(),
  name: '',
  category: 'current',
  action: 'both_sent',
  status: 'monitoring',
  date,
  days: null,
  lastContact: '',
  scheduled: '',
  notes: '',
});
export const freshTask = (date: string): Task => ({
  id: crypto.randomUUID(),
  title: '',
  status: 'Pendente',
  details: '',
  date,
});
export const parseResponse = async (r: Response) => {
  const json = await r.json();
  if (!r.ok) throw Error(json.error || 'Ocorreu um erro');
  return json;
};
export const route = async (path: string, method = 'GET', payload?: unknown) =>
  parseResponse(
    await fetch(`/api/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
    }),
  );