import "server-only";
import { PrismaReceivablesRepository } from "@/modules/receivables/presentation/server";

/**
 * Backward-compat alias. Tx-aware consumers (dispatch.service, sale.service)
 * and tests still import `ReceivablesRepository` from this path.
 * Implementation lives in `modules/receivables/`.
 */
export class ReceivablesRepository extends PrismaReceivablesRepository {}
