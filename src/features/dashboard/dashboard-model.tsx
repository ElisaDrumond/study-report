'use client';

import type { Entry, Task } from '../../../lib/types';

export type Tab =
  'central' | 'clients' | 'calendar' | 'overview' | 'activities' | 'daily' | 'reports' | 'history';

export const today = () => {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
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

export const parseResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    throw Error(data.error || 'Ocorreu um erro');
  }

  return data;
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
