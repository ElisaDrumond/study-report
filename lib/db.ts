import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type {Entry,SavedReport,Task} from './types';
let instance:Database.Database|undefined;
export function db(){if(!instance){const folder=path.join(process.cwd(),'data');fs.mkdirSync(folder,{recursive:true});instance=new Database(path.join(folder,'report.db'));instance.pragma('journal_mode = WAL');instance.exec(`
CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL,date TEXT NOT NULL,days INTEGER,lastContact TEXT NOT NULL,scheduled TEXT NOT NULL,notes TEXT NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY,title TEXT NOT NULL,status TEXT NOT NULL,details TEXT NOT NULL,date TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY,date TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,createdAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
`)}return instance}
export const getEntries=()=>db().prepare('SELECT * FROM entries ORDER BY date DESC, updatedAt DESC').all() as Entry[];
export const getTasks=()=>db().prepare('SELECT * FROM tasks ORDER BY date DESC, rowid DESC').all() as Task[];
export const getReports=()=>db().prepare('SELECT * FROM reports ORDER BY createdAt DESC').all() as SavedReport[];
export function saveEntry(r:Entry){const now=new Date().toISOString();db().prepare(`INSERT INTO entries(id,name,category,action,status,date,days,lastContact,scheduled,notes,createdAt,updatedAt) VALUES(@id,@name,@category,@action,@status,@date,@days,@lastContact,@scheduled,@notes,@now,@now) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,action=excluded.action,status=excluded.status,date=excluded.date,days=excluded.days,lastContact=excluded.lastContact,scheduled=excluded.scheduled,notes=excluded.notes,updatedAt=excluded.updatedAt`).run({...r,now});}
export function saveTask(t:Task){db().prepare('INSERT INTO tasks(id,title,status,details,date) VALUES(@id,@title,@status,@details,@date) ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,details=excluded.details,date=excluded.date').run(t)}
export function saveReport(r:SavedReport){db().prepare('INSERT INTO reports(id,date,subject,body,createdAt) VALUES(@id,@date,@subject,@body,@createdAt)').run(r)}
