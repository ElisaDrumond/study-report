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
