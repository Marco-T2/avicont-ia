import "server-only";
import { PrismaPayablesRepository } from "@/modules/payables/presentation/server";

/**
 * Backward-compat alias. Tx-aware consumers (purchase.service)
 * and tests still import `PayablesRepository` from this path.
 * Implementation lives in `modules/payables/`.
 */
export class PayablesRepository extends PrismaPayablesRepository {}
