'use client';

import { X } from 'lucide-react';

import Operations from '../../../app/operations';
import styles from '../../../app/page.module.css';
import ActivitiesPanel from './activities-panel';
import DailyDialog from './daily-dialog';
import DailyPanel from './daily-panel';
import DashboardHeading from './dashboard-heading';
import DashboardSidebar from './dashboard-sidebar';
import DashboardTopbar from './dashboard-topbar';
import EntryDialog from './entry-dialog';
import OverviewPanel from './overview-panel';
import ReportEditor from './report-editor';
import ReportHistory from './report-history';
import { useDashboard } from './use-dashboard';

export default function Dashboard() {
  const controller = useDashboard();
  const {
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
  } = controller;

  const isOperationsView = tab === 'central' || tab === 'clients' || tab === 'calendar';

  return (
    <div className={styles.shell}>
      <DashboardSidebar
        navOpen={navOpen}
        navigation={navigation}
        tab={tab}
        setTab={setTab}
        setNavOpen={setNavOpen}
      />

      <main className={styles.main}>
        <DashboardTopbar
          setNavOpen={setNavOpen}
          navOpen={navOpen}
          navigation={navigation}
          tab={tab}
        />
        <DashboardHeading
          navigation={navigation}
          tab={tab}
          refining={refining}
          date={date}
          setDate={setDate}
          setGenerated={setGenerated}
        />

        {loading ? (
          <div className={styles.card}>Carregando registros locais...</div>
        ) : (
          <>
            {isOperationsView && (
              <Operations
                key={tab}
                view={tab}
                onNavigate={(destination) => setTab(destination)}
              />
            )}

            {tab === 'overview' && (
              <OverviewPanel
                stats={stats}
                setTab={setTab}
                records={records}
                upcoming={upcoming}
                refining={refining}
                generate={generate}
                invalid={invalid}
              />
            )}

            {tab === 'activities' && (
              <ActivitiesPanel
                setEditing={setEditing}
                date={date}
                query={query}
                setQuery={setQuery}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                fromDate={fromDate}
                setFromDate={setFromDate}
                toDate={toDate}
                setToDate={setToDate}
                downloadBackup={downloadBackup}
                importBackup={importBackup}
                filtered={filtered}
                removeRecord={removeRecord}
              />
            )}

            {tab === 'daily' && (
              <DailyPanel
                setEditingTask={setEditingTask}
                date={date}
                tasks={tasks}
                removeTask={removeTask}
              />
            )}

            {tab === 'reports' && (
              <ReportEditor
                date={date}
                extra={extra}
                setExtra={setExtra}
                nextSteps={nextSteps}
                setNextSteps={setNextSteps}
                refining={refining}
                generate={generate}
                refinementStyle={refinementStyle}
                setRefinementStyle={setRefinementStyle}
                setRefinedBody={setRefinedBody}
                setChosen={setChosen}
                generated={generated}
                saving={saving}
                refine={refine}
                refinedBody={refinedBody}
                refineError={refineError}
                excluded={excluded}
                subject={subject}
                setSubject={setSubject}
                body={body}
                setBody={setBody}
                chosen={chosen}
                copy={copy}
                saveGenerated={saveGenerated}
              />
            )}

            {tab === 'history' && (
              <ReportHistory
                setTab={setTab}
                history={history}
                setSubject={setSubject}
                setBody={setBody}
                setOriginalBody={setOriginalBody}
                setRefinedBody={setRefinedBody}
                setRefinementStyle={setRefinementStyle}
                setRefinedAt={setRefinedAt}
                setGeneratedDate={setGeneratedDate}
                setChosen={setChosen}
                setRefineError={setRefineError}
                setDate={setDate}
                setGenerated={setGenerated}
              />
            )}
          </>
        )}

        <footer className={styles.footer}>
          Study & Work Reports · Ferramenta local de apoio · Não substitui os registros oficiais no
          CRM.
        </footer>
      </main>

      {toast && (
        <div role="status" className={styles.toast}>
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
      )}

      {editing && (
        <EntryDialog
          setEditing={setEditing}
          records={records}
          clients={clients}
          installments={installments}
          editing={editing}
          saving={saving}
          saveRecord={saveRecord}
        />
      )}

      {editingTask && (
        <DailyDialog
          setEditingTask={setEditingTask}
          editingTask={editingTask}
          saveDaily={saveDaily}
          saving={saving}
        />
      )}
    </div>
  );
}
