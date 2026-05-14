/**
 * Re-export shim — canonical implementation lives in shared.
 *
 * EX-D3 consolidation (poc-accounting-exporters-cleanup, OLEADA 6 sub-POC 6/8):
 * the standalone sumDecimals + eq copies in TB/ES/WS/IB were consolidated into
 * `@/modules/accounting/shared/domain/money.utils`. This file is now a thin
 * re-export shim — zero call-site churn, identity preserved. Proposal #2357.
 */
export { sumDecimals, eq } from "@/modules/accounting/shared/domain/money.utils";
