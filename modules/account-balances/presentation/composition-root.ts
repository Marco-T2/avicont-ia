import "server-only";
import { AccountBalancesRepository } from "@/modules/account-balances/infrastructure/account-balances.repository";
import { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";

/**
 * Composition root for the account-balances module (R2 paydown — mirrors
 * the `VoucherPdfExporterPort` precedent: domain port + thin infra adapter,
 * wired here). Single point of wiring the concrete `AccountBalancesRepository`
 * to `AccountBalancesService`. The only file under `presentation/` allowed
 * to import from `infrastructure/` (architecture.md R4 carve-out).
 */
export function makeAccountBalancesService(): AccountBalancesService {
  return new AccountBalancesService(new AccountBalancesRepository());
}
