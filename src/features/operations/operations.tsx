'use client';
import { ShieldCheck } from 'lucide-react';
import styles from '../../../app/page.module.css';
import { fmt } from '../../../lib/rules';
import CalendarPanel from './calendar-panel';
import CentralPanel from './central-panel';
import ClientHistory from './client-history';
import ClientsPanel from './clients-panel';
import OperationDialog from './operation-dialog';
import { useOperations } from './use-operations';
export default function Operations({ view }: { view: 'central' | 'clients' | 'calendar' }){const {today,s,error,message,stats,reload,busy,range,setRange,priority,setPriority,category,setCategory,clientFilter,setClientFilter,status,setStatus,queue,clientName,installmentName,openTask,setHistoryClient,run,setError,setDialog,selectClient,setSelectedClient,openClient,historyClient,month,setMonth,d,submit,operationId,p,n,exception,collectionKinds,loading}=useOperations(view);
if (loading) return <div className={styles.card}>Carregando central operacional...</div>;
return ((
    <>
      <div className={styles.note}>
        <ShieldCheck size={18} />
        <span>
          Data operacional: {fmt(today)} · {s.settings.timezone}. As regras sugerem tarefas;
          cobranças, bloqueios e encaminhamentos dependem de registro humano.
        </span>
      </div>
      {error && (
        <div role="alert" className={styles.alert}>
          {error}
        </div>
      )}
      {message && (
        <p role="status" className={styles.ok}>
          {message}
        </p>
      )}
      {view === 'central' && <CentralPanel stats={stats} reload={reload} busy={busy} range={range} setRange={setRange} priority={priority} setPriority={setPriority} category={category} setCategory={setCategory} clientFilter={clientFilter} setClientFilter={setClientFilter} s={s} status={status} setStatus={setStatus} queue={queue} clientName={clientName} installmentName={installmentName} today={today} openTask={openTask} setHistoryClient={setHistoryClient}/>}
      {view === 'clients' && <ClientsPanel busy={busy} run={run} setError={setError} setDialog={setDialog} selectClient={selectClient} setSelectedClient={setSelectedClient} s={s} openClient={openClient} setHistoryClient={setHistoryClient} today={today} historyClient={historyClient}/>}
      {view === 'calendar' && <CalendarPanel setDialog={setDialog} month={month} setMonth={setMonth} s={s} busy={busy} run={run}/>}
      {historyClient && <ClientHistory clientId={historyClient} s={s} setHistoryClient={setHistoryClient} openClient={openClient} today={today} setSelectedClient={setSelectedClient} setDialog={setDialog}/>}
      {d && <OperationDialog d={d} busy={busy} setDialog={setDialog} setError={setError} submit={submit} operationId={operationId} p={p} today={today} n={n} s={s} exception={exception} collectionKinds={collectionKinds} error={error}/>}
    </>
  ));}