'use client';
import type {
Client,
Installment,
Negotiation,
PendingTask
} from '../../../lib/collection-types';
export type Dialog = {
  type: string;
  title: string;
  client?: Client;
  installment?: Installment;
  task?: PendingTask;
  negotiation?: Negotiation;
  exceptionId?: string;
  calendarDate?: string;
};