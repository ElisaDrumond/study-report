# Architecture and refactoring notes

The application is a local Next.js App Router project with SQLite persistence. This document
describes the existing boundaries; it is not a proposal to rewrite the app.

## Layers

| Location                                | Responsibility                                                 |
| --------------------------------------- | -------------------------------------------------------------- |
| `app/`                                  | Next.js pages, layouts, API routes, and route-specific styling |
| `src/features/dashboard/`               | Legacy activity/daily/report UI and its client-side controller |
| `src/features/operations/`              | Operational center, client and calendar UI, and its controller |
| `src/components/ui/`                    | Shared presentation-only building blocks                       |
| `lib/operations/commands/`              | Domain command handlers and their explicit validations         |
| `lib/operations/operations-service.ts`  | Command routing, transactions and idempotency                  |
| `lib/operations/process-operations.ts`  | Recalculation of operational tasks and client state            |
| `lib/database/operations-repository.ts` | SQLite repository and snapshot mapping                         |
| `lib/collection-rules.ts`               | Deterministic collection rules                                 |
| `lib/business-calendar.ts`              | Working-day calculations and calendar exceptions               |
| `lib/db.ts`                             | SQLite connection, migration and legacy record persistence     |

`lib/operations-store.ts` is a compatibility entry point. Retain it until all imports and
external consumers have been checked.

## Dependency direction

- Route handlers validate HTTP inputs and invoke domain services.
- Domain services coordinate commands and transactions.
- Domain rules should not depend on React or browser APIs.
- Repository functions own SQL. Do not put SQL in UI components.
- UI controllers own user-facing state, API calls and presentation concerns.
- Components should receive the smallest practical props interface.

Avoid adding a second state store or an abstraction layer solely to match a folder convention.

## Clients CSV import/export and activity links

The operational client registry is the source of truth for customer identity.
The CSV export includes stable client IDs, names, CRM references, status, current
installment counts, balance and notes. Import only accepts ID, name, CRM and notes;
financial status, installments, balances, payments and activity history cannot be
changed by importing a client CSV. Unknown IDs and ambiguous matches are rejected,
and the entire batch is transactional. Empty CRM/notes cells do not clear existing data. Imports are confirmed before
execution and reject mismatched identities instead of silently merging clients.

Financial entries have an optional, persisted `clientId` column added by an
idempotent SQLite migration. Linked activities resolve by ID even after a client rename.
Unlinked historical activities still use unique-name matching as a fallback.

## Contract terms for future collection scheduling

Clients can optionally store a free-form purchase description, contracted installment
count, frequency (monthly / every 15 days / weekly / one-time), recurring monthly
due-day (1–31), and first due date. These fields are editable in the client dialog,
visible in the client history and round-trip through CSV. CSV imports patch only
nonempty fields and validate constraints; existing payment data is untouched.

These terms are **not** recorded installments, and neither due-day nor count
automatically creates receivables, confirms payments, changes dates or applies
penalties. A future workflow should explicitly create and review installments and
handle short months, exceptions, manual payment confirmations and approved charges.

## Linking financial activities to installments

A financial entry can optionally reference a recorded installment belonging to the
selected client. The SQLite migration adds an optional installmentId column, and the
API validates the relationship. Selecting a parcel records the context of an action;
it does **not** mark a payment as received, change a balance, or apply penalties.
Receipts remain explicit operational confirmations.

## Currency and initial verification terminology

All customer balances, installment values and CSV amounts are in **USD** (US$).
Values in cents are preserved as-is: this does not perform exchange-rate
conversion or rewrite existing ledger amounts. "Conciliação" remains the
separate task performed in the Study system; initial local payment-status
verification is not counted as that Study task.

## Initial verification of imported receivables

New installments start with `verificationStatus: unverified`. Previously generated
installments with no payments are marked as unverified by an idempotent migration
when their generation audit record is available. No prior contact, unpaid status,
late-payment action or service block is inferred merely from importing a schedule.
A human can mark the installment as still unpaid, or separately confirm its
receipt (including partial payment). This verification is **not** the Study
system's separate reconciliation task. Upon verification, collection scheduling
starts at the verification date; older suggested task dates are not backfilled.
No customer communication is automatic.

## UI workflow

The reviewed installment schedule is confirmed inside the application's
standard modal rather than the browser's native confirmation prompt.
Operator defaults to Elisa Anjo. Task deferrals are recorded as operational
activities on the date of the human action, with audit metadata preserved.

## Currency

The entire operational financial workflow uses USD. Amounts are stored in integer
cents, displayed as US$ and exported as USD. This is a currency-label correction,
**not** an exchange-rate conversion. Reconciliation is solely a separately recorded
task in Study's official system and is never inferred from payment-status verification.

## Navigation, semantic actions and report continuity

Clients/Contracts → Confirmed installments → Central Operational actions → Activities → Report
is one guided workflow. Each page now links to the next and previous stage.
Entering Activities refreshes both the operational activity projection and
client/parcel lookups, preventing stale daily rows after a Central action.

Operational activity rows are read-only and preserve the source activity ID;
they display their actual operational action label rather than a generic
"Outra ação". Reports consume the operational activity ledger directly once,
not the merged UI listing, so no double counting occurs. Suggested tasks,
imports, contract creation and rule recalculations are not counted as worked
activities. Actual completed actions remain credited on the operation date.

Financial buttons use semantic colors and explicit verbs: amber for verification,
green for **recording** confirmed payment, blue for payment prediction, and
neutral gray for editing. Their text labels remain accessible without color.

## Importing already-paid installments at schedule creation

When a contract predates the current date, the generation modal allows an
operator to mark individual past-due installments as **historically paid** with
an effective receipt date, exact amount received in USD, and explicit charges.
Historical payment data is validated server-side against the schedule before
any writing; all installments are inserted in the existing single transaction.
The paid ones are verified, settled and annotated with `historicalPaid`; they
never create outstanding collection tasks. Remaining past-due installments are
classified as verified and open by the operator's confirmed selection; follow-up
starts at the present business date. A 60+ day old outstanding installment
triggers the option to evaluate external collection alongside continued follow-up
every two business days.

Amounts above the original installment require matching recorded charges.
Amounts below the due balance (partials / discounts) cannot silently be marked
as settled in this flow; those require a separate explicit correction/payment
workflow. Historical receipts are retained in installment audit trails only,
**not** as work done on the import date in operational activities/reports.
Payment dates cannot be in the future. Generation still refuses clients with
existing installments, to avoid duplicates.

## New contracts versus backfilled history

Newly generated installments whose due date has not passed are eligible for
normal pre-due reminders (D-15 and due-day) without an initial historical
payment verification. Past-due installments still require explicit review.
The first working day after verified overdue creates the existing block
recommendation (never a silent actual block). Alternate collections start
after the window, not on the same day as its follow-up.
Old backdated receipts are excluded from reporting and from creating
post-payment CRM/receipt tasks that would misrepresent past work.

## One collection task and scoped negotiations

The Central displays one actionable collection-follow-up card rather than
an extra external-review task. At the configurable 60-day threshold the
same follow-up card offers an optional, explicitly confirmed external
collection referral (revalidated server-side). A generic "completion" is
not used for collection contacts. Scheduling persists the task for a future
business day; simply scheduling is not an activity counted in reports.

With at least two overdue installments, the suggested contact displays
their consolidated outstanding **overdue** balance, excluding future debt.
Renegotiations explicitly select overdue installments, all remaining
unpaid contract installments (including future ones), or custom selection.
Scope and the balance snapshot are saved and validated server-side.
No change to installment amounts, due dates or payments is inferred from
opening a proposal.

## Existing contracts to protect

- Preserve the SQLite schema and the migration/backup behavior.
- Preserve the idempotency key for operation commands and completed task history.
- An appointment or scheduled payment is not a confirmed payment.
- Collecting debts, blocking service and external escalation require manual confirmation.
- Existing report history and local imports must remain readable.

## Quality checks

Run locally from the repository root:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

If the interrupted refactor still leaves formatting or lint errors, fix those before merging.
Do not mark checks as passing without actually executing them.

## Current refactor status

The checkpoint commit `12600bf` preserves the operational v2 implementation.
Commit `9eb10e3` contains the partially extracted UI and service modules.
The follow-up refactor branch makes their composition and dispatch code easier to read.

The WIP extraction covers a broad part of the project; only a subset of files has been
reviewed in this follow-up. Before merging, validate all new paths, run the local quality
checks, and inspect the resulting UI. This branch intentionally changes no collection policy.
