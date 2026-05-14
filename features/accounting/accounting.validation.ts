/**
 * Re-exports moved to hex presentation — canonical home
 * modules/accounting/presentation/validation.ts.
 *
 * OLEADA 6 sub-POC 7/8 poc-accounting-journal-ledger-core-hex C4: the 8
 * journal/ledger zod schemas were merged into the hex presentation/validation.ts
 * (alongside the account schemas). This file is now a thin re-export shim so the
 * `features/accounting/server.ts` barrel keeps working — same shim pattern C2
 * used for journal.types. Deleted in C5.
 */
export * from "@/modules/accounting/presentation/validation";
