/**
 * Accounts UnitOfWork port — runs `fn` inside an atomic transaction boundary,
 * passing the opaque `tx` token through. Passthrough shape (Derived from: D3 —
 * the original lock kept prisma.$transaction inline; this port abstracts the
 * same atomic boundary without leaking Prisma into the application layer).
 * No AuditContext/correlationId (unlike payment's PaymentUnitOfWork) — the
 * accounts atomic path needs neither.
 */
export interface AccountsUnitOfWork {
  run<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}
