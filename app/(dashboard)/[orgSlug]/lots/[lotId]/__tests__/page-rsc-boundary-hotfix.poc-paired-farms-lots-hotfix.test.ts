/**
 * POC paired farms+lots hotfix retroactivo pre-D1 — RED textual + behavioral
 * gate runtime path coverage RSC boundary serialization bug detected in-the-
 * wild Marco-side smoke test `/lots/[lotId]` page render post-C7-closure
 * pre-D1 cumulative push (master +16 unpushed).
 *
 * Bug runtime confirmado Marco-side 2 errors RSC boundary:
 *   1. "Only plain objects can be passed to Client Components from Server
 *      Components. Decimal objects are not supported."
 *      Path: expenses[].amount Prisma.Decimal instance directo a Client.
 *   2. "Classes or null prototypes are not supported."
 *      Path: summary LotSummary class instance directo a Client — refactor
 *      C5 public readonly fields INSUFICIENTE runtime React class identity
 *      detection vía `Object.getPrototypeOf(obj) !== Object.prototype`
 *      PRE-serialization (NO post-JSON parse como hipótesis C5 absorbida).
 *
 * Marco locks Q1-Q5 hotfix scope aprobados:
 *   Q1=B  LotSummary.toJSON() method paired sister mortality+lot convention EXACT
 *   Q2=α  page-level expenses.map Decimal→Number paired sister contacts EXACT
 *   Q3=1  RED+GREEN+doc+smoke paired sister hotfix-correctivo-contacts EXACT
 *   Q4    3 engrams NEW canonical homes saved pre-RED ✓:
 *         - feedback/lot-summary-class-instance-rsc-boundary-rejection-vs-c5-refactor-insufficient
 *         - feedback/decimal-prisma-rsc-boundary-conversion-cleanup-pending
 *         - arch/§13/vo-public-readonly-fields-rsc-coherence-REVISED-class-identity-detected-pre-serialization
 *   Q5    Addendum §19.16.X paired sister c0-hotfix-allocations-payment §19.16.1 EXACT
 *
 * Marco locks Q-A a Q-E RED scope aprobados:
 *   Q-A   Path app/(dashboard)/[orgSlug]/lots/[lotId]/__tests__/ junto al archivo
 *   Q-B   3α suficiente NO E2E Playwright (textual + behavioral 2 axes)
 *   Q-C   *hotfix*.test.tsx filename convention paired sister contacts EXACT
 *   Q-D   3α minimal scope acotado 3 archivos (lot-summary.ts + page.tsx + page.tsx)
 *   Q-E   Behavioral triples LotSummary.toJSON existence + shape EXACT + plain object
 *         (CRITICAL — verifica class identity drop axis-distinct C5 refactor falla)
 *         Factory-only invariant preservation IMPLÍCITA via static compute() call
 *
 * 3α distribution enumerated explicit per feedback_red_acceptance_failure_mode:
 *   α1 — Behavioral: LotSummary.toJSON() existence (typeof === "function") +
 *        shape contract EXACT { totalExpenses, totalMortality, aliveCount,
 *        costPerChicken } + plain object prototype (Object.getPrototypeOf
 *        === Object.prototype) — class identity drop at boundary axis-distinct
 *   α2 — Textual page.tsx: `summary={summary.toJSON()}` JSX prop call site present
 *   α3 — Textual page.tsx: expenses Decimal→Number map `amount: Number(...)`
 *        conversion present pre-pass to Client (paired sister contacts EXACT)
 *
 * Expected failure mode pre-GREEN: 3/3 FAIL enumerated explicit per
 * feedback_red_acceptance_failure_mode:
 *   α1 FAIL: typeof LotSummary.compute(...).toJSON !== "function" (method NO existe)
 *   α2 FAIL: page.tsx pasa `summary={summary}` raw class instance (no .toJSON())
 *   α3 FAIL: page.tsx pasa `expenses={expenses}` raw Decimal (no Number map)
 *
 * Diagnostic-stash-gate 11ma matures cumulative cross-POC verified pre-RED:
 * vitest re-run deterministic 5629 total / 5603 pass / 7 fail / 19 skip envelope
 * §13.A3-D4-α 21ma matures {6,9} ∋ 7 ✓ ZERO cascade-NEW C7 wholesale delete —
 * primer run env-flake worker timeout iva-book-sale-modal.test.tsx superseded.
 *
 * Cross-cycle-red-test-cementación-gate verify CLEAN pre-RED este turno:
 * scope hotfix retroactivo runtime path coverage NO overlap C0-C7 cumulative
 * test files (cementación shape/cross-feature/wholesale-delete axes vs
 * runtime RSC boundary serialization axis NEW retroactivo). Filename suffix
 * `.poc-paired-farms-lots-hotfix.test.tsx` distinct vs `.poc-paired-farms-lots.test.ts`
 * (hotfix retroactivo vs forward POC cycles).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LotSummary } from "@/modules/lot/domain/value-objects/lot-summary";

const ROOT = resolve(__dirname, "../../../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const PAGE_PATH = "app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx";

// α2 — POS textual JSX prop: `summary={summary.toJSON()}` post-hotfix call site
const SUMMARY_TO_JSON_JSX_REGEX = /summary=\{summary\.toJSON\(\)\}/m;

// α3 — POS textual: expenses Decimal→number canonical bridge via `.toSnapshot()` in page.tsx
// Post POC expense hex C4 cutover (1fc4ba0 + 87789a5 + 7495f0e cumulative) — hex
// Expense.toSnapshot() returns amount as number (D1 Opt B lossy boundary domain
// Decimal→number via mapper Number() coercion C2 cementado). SUPERSEDES legacy
// page-level `amount: Number(...)` workaround per evidence-supersedes-assumption-lock
// 59ma matures cumulative cross-POC — hex .toSnapshot() canonical bridge single
// source of truth paired sister cementado heredado matures forward absoluto.
const TO_SNAPSHOT_BRIDGE_REGEX = /\.toSnapshot\(\)/m;

describe("POC paired farms+lots hotfix retroactivo pre-D1 — RED textual + behavioral gate /lots/[lotId] RSC boundary serialization (LotSummary class identity + Decimal Prisma)", () => {
  // ── α1 Behavioral LotSummary.toJSON() existence + shape + plain object ──
  it("Test α1: LotSummary.toJSON() existence (typeof function) + shape EXACT { totalExpenses, totalMortality, aliveCount, costPerChicken } + plain object prototype (Object.getPrototypeOf === Object.prototype — class identity drop axis-distinct C5 refactor revisada)", () => {
    const summary = LotSummary.compute({
      initialCount: 100,
      expenses: [{ amount: 50 }],
      mortalityLogs: [{ count: 10 }],
    });
    const maybeToJSON = (summary as unknown as { toJSON?: () => unknown }).toJSON;
    expect(typeof maybeToJSON).toBe("function");
    const json = (summary as unknown as { toJSON: () => unknown }).toJSON();
    expect(json).toEqual({
      totalExpenses: 50,
      totalMortality: 10,
      aliveCount: 90,
      costPerChicken: 50 / 90,
    });
    expect(Object.getPrototypeOf(json)).toBe(Object.prototype);
  });

  // ── α2 Textual page.tsx summary.toJSON() JSX call site ──
  it("Test α2: page.tsx contains JSX prop `summary={summary.toJSON()}` (POS — class identity drop AT consumer boundary paired sister mortality.toJSON()+lot.toSnapshot() convention EXACT mirror)", () => {
    expect(read(PAGE_PATH)).toMatch(SUMMARY_TO_JSON_JSX_REGEX);
  });

  // ── α3 Textual page.tsx expenses hex .toSnapshot() canonical bridge (post-C4 cutover) ──
  it("Test α3: page.tsx contains `.toSnapshot()` bridge pre-pass expenses to Client (POS — hex canonical Decimal→number boundary D1 Opt B paired sister cementado heredado matures SUPERSEDES legacy `amount: Number(...)` workaround per evidence-supersedes-assumption-lock 59ma matures cumulative cross-POC)", () => {
    expect(read(PAGE_PATH)).toMatch(TO_SNAPSHOT_BRIDGE_REGEX);
  });
});
