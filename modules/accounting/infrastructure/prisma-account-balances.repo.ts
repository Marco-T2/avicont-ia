import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { AccountBalancesRepository as LegacyAccountBalancesRepository } from "@/features/account-balances/account-balances.repository";
import type { Money } from "@/modules/shared/domain/value-objects/money";
import type { Journal } from "../domain/journal.entity";
import type { AccountBalancesRepository } from "../domain/ports/account-balances.repo";

/**
 * Prisma adapter for `AccountBalancesRepository`. Tx-bound — receives
 * `Prisma.TransactionClient` at construction time so the use case never sees
 * the tx token (architecture.md §4.3, mirrors `PrismaUnitOfWork` POC #9).
 *
 * Shim §5.5 transitorio (lockeado en POC #10 C3-A): el adapter delega a
 * `LegacyAccountBalancesRepository.upsert` — el único source of truth de la
 * lógica de delta-por-cuenta + sign rules + UPSERT semantics. La firma del
 * port `applyPost(entry: Journal)` se sostiene como wrap+hydrate: el adapter
 * carga `accounts` desde DB para resolver `nature` (info que el aggregate
 * NO trae por diseño), después delega al legacy. C5 borra el legacy y
 * decide si el cómputo de deltas sube al aggregate
 * (`Journal.computeBalanceDeltas()`) o se inlinea acá.
 */

const legacyRepo = new LegacyAccountBalancesRepository();

// `Money` is non-negative by construction (`money.ts:19-23, 43-48`); the
// `applyVoid` flow needs signed deltas, so we drop down to `Prisma.Decimal`
// inside infra. Localized here — domain stays insulated from negative VOs.
function positiveString(m: Money | null): string {
  return m?.toString() ?? "0";
}

function negatedString(m: Money | null): string {
  if (!m || m.isZero()) return "0";
  return new Prisma.Decimal(m.toString()).negated().toString();
}

export class PrismaAccountBalancesRepo implements AccountBalancesRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async applyPost(entry: Journal): Promise<void> {
    const accounts = await this.tx.account.findMany({
      where: { id: { in: entry.lines.map((l) => l.accountId) } },
      select: { id: true, nature: true },
    });
    const natureById = new Map(accounts.map((a) => [a.id, a.nature]));

    for (const line of entry.lines) {
      const nature = natureById.get(line.accountId);
      if (!nature) {
        throw new Error(
          `Account ${line.accountId} not found during applyPost`,
        );
      }
      await legacyRepo.upsert(
        this.tx,
        line.accountId,
        entry.periodId,
        entry.organizationId,
        positiveString(line.side.debit),
        positiveString(line.side.credit),
        nature,
      );
    }
  }

  async applyVoid(entry: Journal): Promise<void> {
    const accounts = await this.tx.account.findMany({
      where: { id: { in: entry.lines.map((l) => l.accountId) } },
      select: { id: true, nature: true },
    });
    const natureById = new Map(accounts.map((a) => [a.id, a.nature]));

    for (const line of entry.lines) {
      const nature = natureById.get(line.accountId);
      if (!nature) {
        throw new Error(
          `Account ${line.accountId} not found during applyVoid`,
        );
      }
      await legacyRepo.upsert(
        this.tx,
        line.accountId,
        entry.periodId,
        entry.organizationId,
        negatedString(line.side.debit),
        negatedString(line.side.credit),
        nature,
      );
    }
  }
}
