import type { CreditAllocationSource } from "@/modules/payment/presentation/server";

/**
 * pago-credit-system Phase 6 — pure credit-source / cash-allocation builders
 * extracted from payment-form.tsx (Extract-Before-Mock; sibling precedent
 * payment-form.glosa-helpers.ts). Generalized from receivable-only to the
 * AllocationTarget XOR: COBRO targets receivables (receivableId), PAGO targets
 * payables (payableId). DEC-1 §3 — no float-cents math added; these mirror the
 * pre-existing payment-form arithmetic (parseFloat over input strings, the same
 * convention used across the form) and emit `amount: number` to the API, which
 * already accepts it.
 */

type FormDirection = "COBRO" | "PAGO";

/** Subset of payment-form `CreditLine` consumed by buildCreditSources. */
export interface CreditLineForSources {
  sourcePaymentId: string;
  assignedAmount: string;
  checked: boolean;
}

/** Subset of payment-form `AllocationLine` consumed by the credit builders. */
export interface AllocationForSources {
  id: string;
  type: "receivable" | "payable";
  assignedAmount: string;
  dueDate: string | Date;
  checked: boolean;
}

/**
 * The allocation kind a given direction pays via credit:
 * COBRO → receivable lines, PAGO → payable lines. This is the credit gate that
 * Phase 6 lifts — previously hardcoded to "receivable" (COBRO only).
 */
function creditTargetKind(direction: FormDirection): "receivable" | "payable" {
  return direction === "COBRO" ? "receivable" : "payable";
}

/** Stamps the present-id key on a source/allocation per the active direction. */
function targetIdField(direction: FormDirection): "receivableId" | "payableId" {
  return direction === "COBRO" ? "receivableId" : "payableId";
}

/**
 * Builds CreditAllocationSource[] by distributing each checked credit line's
 * assignedAmount across the active direction's checked allocations in FIFO order
 * (dueDate ascending, tie-break by id). One entry per (sourcePayment, target).
 * The target id is `receivableId` (COBRO) or `payableId` (PAGO) — XOR.
 */
export function buildCreditSources(
  creditLines: CreditLineForSources[],
  allocations: AllocationForSources[],
  direction: FormDirection,
): CreditAllocationSource[] {
  const checkedCredits = creditLines.filter(
    (c) => c.checked && parseFloat(c.assignedAmount) > 0,
  );
  if (checkedCredits.length === 0) return [];

  const kind = creditTargetKind(direction);
  const idField = targetIdField(direction);

  const checkedTargets = allocations
    .filter((a) => a.checked && a.type === kind && parseFloat(a.assignedAmount) > 0)
    .sort((a, b) => {
      const dateDiff =
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return dateDiff !== 0 ? dateDiff : a.id < b.id ? -1 : 1;
    });

  if (checkedTargets.length === 0) return [];

  const sources: CreditAllocationSource[] = [];
  const targetRemaining = new Map<string, number>(
    checkedTargets.map((a) => [a.id, parseFloat(a.assignedAmount) || 0]),
  );

  for (const credit of checkedCredits) {
    let creditRemaining = parseFloat(credit.assignedAmount) || 0;
    for (const alloc of checkedTargets) {
      if (creditRemaining <= 0) break;
      const allocRemaining = targetRemaining.get(alloc.id) ?? 0;
      if (allocRemaining <= 0) continue;
      const apply = Math.min(creditRemaining, allocRemaining);
      sources.push({
        sourcePaymentId: credit.sourcePaymentId,
        [idField]: alloc.id,
        amount: apply,
      });
      targetRemaining.set(alloc.id, allocRemaining - apply);
      creditRemaining -= apply;
    }
  }

  return sources;
}

/**
 * Builds cash-only allocations: each active allocation's assigned amount minus
 * the credit covering it. Credit is subtracted per target by whichever id is
 * present on the source (receivableId OR payableId) — generalizes the Batch-2
 * `if (!cs.receivableId) continue;` guard to also handle payable credit.
 */
export function buildCashAllocations(
  creditSources: CreditAllocationSource[],
  activeAllocations: AllocationForSources[],
): Array<{ receivableId?: string; payableId?: string; amount: number }> {
  const creditByTarget = new Map<string, number>();
  for (const cs of creditSources) {
    const targetId = cs.receivableId ?? cs.payableId;
    if (!targetId) continue;
    creditByTarget.set(targetId, (creditByTarget.get(targetId) ?? 0) + cs.amount);
  }

  return activeAllocations
    .map((a) => {
      const totalAssigned = parseFloat(a.assignedAmount) || 0;
      const creditCovering = creditByTarget.get(a.id) ?? 0;
      const cashPortion = Math.max(0, totalAssigned - creditCovering);
      return {
        ...(a.type === "receivable" ? { receivableId: a.id } : { payableId: a.id }),
        amount: cashPortion,
      };
    })
    .filter((a) => a.amount > 0);
}
