import type Database from 'better-sqlite3';
export function migrateOperations(db:Database.Database){db.transaction(()=>{
 for(const table of ['op_clients','op_installments','op_activities','op_pending','op_negotiations','op_calendar','op_audit','op_settings','op_commands'])db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)))`);
 db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS op_calendar_date ON op_calendar(json_extract(data,'$.date'));
 CREATE INDEX IF NOT EXISTS op_installment_client ON op_installments(json_extract(data,'$.clientId'));
 CREATE INDEX IF NOT EXISTS op_pending_due ON op_pending(json_extract(data,'$.dueDate'));
 CREATE TRIGGER IF NOT EXISTS op_activity_immutable_update BEFORE UPDATE ON op_activities BEGIN SELECT RAISE(ABORT,'Atividade imutável'); END;
 CREATE TRIGGER IF NOT EXISTS op_activity_immutable_delete BEFORE DELETE ON op_activities BEGIN SELECT RAISE(ABORT,'Atividade imutável'); END;
 CREATE TRIGGER IF NOT EXISTS op_audit_immutable_update BEFORE UPDATE ON op_audit BEGIN SELECT RAISE(ABORT,'Histórico imutável'); END;
 CREATE TRIGGER IF NOT EXISTS op_audit_immutable_delete BEFORE DELETE ON op_audit BEGIN SELECT RAISE(ABORT,'Histórico imutável'); END;`);
 })()}
