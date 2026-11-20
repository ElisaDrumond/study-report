export type Category =
  | 'current'
  | 'email'
  | 'payment'
  | 'late'
  | 'lateover'
  | 'renegotiation'
  | 'message'
  | 'conciliation'
  | 'other';
export type Action =
  | 'none'
  | 'email_sent'
  | 'whatsapp_sent'
  | 'both_sent'
  | 'email_replied'
  | 'message_replied'
  | 'payment_checked'
  | 'conciliation_done'
  | 'call'
  | 'followup'
  | 'other_action';
export type Status =
  | 'none'
  | 'monitoring'
  | 'awaiting_reply'
  | 'payment_scheduled'
  | 'payment_confirmed'
  | 'closed'
  | 'proposal_received'
  | 'awaiting_approval'
  | 'approved'
  | 'not_approved'
  | 'agreement_active'
  | 'external_collection';
export type Entry = {
  id: string;
  clientId?: string;
  installmentId?: string;
  name: string;
  category: Category;
  action: Action;
  status: Status;
  date: string;
  days: number | null;
  lastContact: string;
  scheduled: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};
export type Task = {
  id: string;
  title: string;
  status: 'Concluída' | 'Em andamento' | 'Pendente' | 'Aguardando alinhamento';
  details: string;
  date: string;
};
export type SavedReport = {
  id: string;
  date: string;
  subject: string;
  body: string;
  createdAt: string;
  originalBody?: string | null;
  refinedBody?: string | null;
  refinementStyle?: 'formal' | 'executive' | 'detailed' | null;
  refinedAt?: string | null;
};
