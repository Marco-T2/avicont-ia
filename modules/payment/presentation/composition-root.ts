import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";
import { PaymentsService } from "../application/payments.service";
import { PrismaPaymentsRepository } from "../infrastructure/prisma-payments.repository";
import {
  PrismaPaymentUnitOfWork,
  BoundPaymentUnitOfWork,
} from "../infrastructure/prisma-payment-unit-of-work";
import { LegacyReceivablesAdapter } from "../infrastructure/adapters/legacy-receivables.adapter";
import { LegacyPayablesAdapter } from "../infrastructure/adapters/legacy-payables.adapter";
import { LegacyContactReadAdapter } from "../infrastructure/adapters/legacy-contact-read.adapter";
import { LegacyOrgSettingsAdapter } from "../infrastructure/adapters/legacy-org-settings.adapter";
import { LegacyFiscalPeriodsAdapter } from "../infrastructure/adapters/legacy-fiscal-periods.adapter";
import { LegacyAccountingAdapter } from "../infrastructure/adapters/legacy-accounting.adapter";
import { PrismaAccountBalancesAdapter } from "../infrastructure/adapters/prisma-account-balances.adapter";
import { PrismaCreditConsumptionAdapter } from "../infrastructure/adapters/prisma-credit-consumption.adapter";
import { PrismaPaymentWithRelationsReaderAdapter } from "../infrastructure/adapters/payment-with-relations.reader.adapter";
import type { PaymentWithRelationsReaderPort } from "../domain/ports/payment-with-relations-reader.port";
import { PrismaShortcutSourceQueryAdapter } from "../infrastructure/adapters/prisma-shortcut-source-query.adapter";
import type { ShortcutSourceQueryPort } from "../domain/ports/shortcut-source-query.port";
import { PaymentService } from "./payment-service.adapter";

export { PrismaPaymentsRepository };
export { PaymentService } from "./payment-service.adapter";

// Mirrors accounting/presentation/composition-root.ts — the prisma client
// itself is the UnitOfWorkRepoLike for the module-level (non-bound) UoW.
const repoLike: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

export function makePaymentsService(): PaymentsService {
  return new PaymentsService({
    repo: new PrismaPaymentsRepository(),
    uow: new PrismaPaymentUnitOfWork(repoLike),
    receivables: new LegacyReceivablesAdapter(),
    payables: new LegacyPayablesAdapter(),
    contacts: new LegacyContactReadAdapter(),
    orgSettings: new LegacyOrgSettingsAdapter(),
    fiscalPeriods: new LegacyFiscalPeriodsAdapter(),
    accounting: new LegacyAccountingAdapter(),
    accountBalances: new PrismaAccountBalancesAdapter(),
    creditConsumption: new PrismaCreditConsumptionAdapter(),
  });
}

export function makePaymentsServiceForTx(
  tx: Prisma.TransactionClient,
): PaymentsService {
  return new PaymentsService({
    repo: new PrismaPaymentsRepository(tx),
    // Runs INSIDE the caller's tx: BoundPaymentUnitOfWork installs the audit
    // session vars on the PROVIDED tx and never opens a nested transaction.
    // (The previous withAuditTx path would have called tx.$transaction — a
    // runtime TypeError on Prisma.TransactionClient; latent, zero callers.)
    uow: new BoundPaymentUnitOfWork(tx),
    receivables: new LegacyReceivablesAdapter(),
    payables: new LegacyPayablesAdapter(),
    contacts: new LegacyContactReadAdapter(),
    orgSettings: new LegacyOrgSettingsAdapter(),
    fiscalPeriods: new LegacyFiscalPeriodsAdapter(),
    accounting: new LegacyAccountingAdapter(),
    accountBalances: new PrismaAccountBalancesAdapter(),
    creditConsumption: new PrismaCreditConsumptionAdapter(),
  });
}

// ── Adapter Layer wiring (canonical R4 exception path EXACT mirror α-A3.B
// paired C1b-α `89e6441` precedent) — composition-root.ts is the ONE
// legitimate exception to R4 (presentation/ MUST NOT import infrastructure/).
// Reader port + Adapter factory + class re-export form the canonical chain
// callsite → server.ts barrel → composition-root → payment-service.adapter.

export function makePaymentReader(): PaymentWithRelationsReaderPort {
  return new PrismaPaymentWithRelationsReaderAdapter();
}

export function makePaymentServiceAdapter(): PaymentService {
  return new PaymentService(makePaymentReader(), makePaymentsService());
}

// ── [PRISMA] cluster paydown (D4) — fetchShortcutSource DI ──
// `fetchShortcutSource` (application/helpers/) used to import `@/lib/prisma`
// directly (R5). It now takes an injected `ShortcutSourceQueryPort`; this
// factory is the ONE place that wires the Prisma-backed adapter, mirroring
// `makePaymentReader()` above.
export function makeShortcutSourceQueryPort(): ShortcutSourceQueryPort {
  return new PrismaShortcutSourceQueryAdapter();
}
