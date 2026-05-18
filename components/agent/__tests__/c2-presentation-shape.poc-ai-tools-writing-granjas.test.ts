/**
 * C2 presentation shape — Botón "Registrar con IA" inject pages 1 contexto
 * (lot-detail-client only post retire-farm-collapse-to-lot T22) shape
 * verification existence-only regex Opt A.
 *
 * Paired sister precedent STRUCTURAL EXACT mirror:
 *   - c5-pages-cutover-shape.poc-paired-farms-lots.test.ts (REPO_ROOT pattern + ^import...m
 *     anchor + path.join cross-dir resolve components/agent/__tests__ → app/(dashboard)/...)
 *   - c0/c1-presentation-shape.poc-ai-tools-writing-granjas.test.ts (existence-only regex
 *     Opt A convention + describe/it block structure)
 *
 * UX SHAPE axis: botón trigger reusable single source of truth (Q1 lock Opt A APROBADO
 * reusable vs inline copy-paste anti-pattern). Posición UI header right (Q2 lock Opt A
 * APROBADO). ContextHints scope minimal per-context (Q3 lock Opt A APROBADO):
 *   - /lots/[lotId] → contextHints={{ lotId, lotName, farmName }} (post REQ-200 collapse)
 *
 * Verifica shape EDIT C2 archivo page cementado post-C5 hex + post retire-farm-collapse:
 *   - lot-detail-client.tsx imports RegistrarConIABoton + renders <RegistrarConIABoton
 *     contextHints={{ lotId, lotName, farmName }}>
 *
 * RED-α C2: behavioral assertion mismatch combined mode — lot-detail-client.tsx EXISTS
 * post-C5 cementado pero NO importa ni renderea RegistrarConIABoton yet. Failure path REAL
 * behavioral assertion mismatch (NOT ENOENT — page exists), regex import + JSX render line
 * ausente pre-GREEN. Paired sister C5 pages cutover shape precedent EXACT mirror.
 *
 * SHAPE-UPDATED (today): α28 assertion body migrated from single brittle multi-line regex
 * (silently green via comment-matching on retired `farmId` doc-comments) to extract-block
 * pattern + per-key assertions + NEGATIVE gate against farmId re-introduction. Rule scope
 * preserved (named_rule_immutability), assertion shape inverted on the dropped field
 * mirroring α27 INVERTED pattern from retire-farm-collapse-to-lot T22.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

const LOT_DETAIL_CLIENT = resolve(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/lots/[lotId]/lot-detail-client.tsx",
);
const FARM_DETAIL_CLIENT = resolve(
  REPO_ROOT,
  "app/(dashboard)/[orgSlug]/farms/[farmId]/farm-detail-client.tsx",
);
// α27 INVERTED at SDD retire-farm-collapse-to-lot T22: FARM_DETAIL_CLIENT
// is wholesale-deleted (REQ-200 absorbs `Farm` into `Lot.farmName`).
// The "imports RegistrarConIABoton" invariant is vacuously satisfied
// — there is no file to assert against. The remaining live assertions
// (α26 + α28) cover the lot-detail path, which is the only surviving
// host for the Botón post-collapse.

const IMPORT_BOTON_RE =
  /^import\s+(?:\{[^}]*\bRegistrarConIABoton\b[^}]*\}|RegistrarConIABoton)\s*from\s*["']@\/components\/agent\/registrar-con-ia-boton["']/m;

// JSX block extractor: matches the <RegistrarConIABoton ... /> element body only.
// Bound to JSX delimiters so per-key assertions cannot bleed into surrounding
// comments or JSX siblings. Covers both self-closing (`/>`) and explicit close
// (`</RegistrarConIABoton>`) — current usage is self-closing but the test must
// not depend on that incidentally.
const BOTON_JSX_RE = /<RegistrarConIABoton\b[\s\S]*?(?:\/>|<\/RegistrarConIABoton>)/;

// Per-key assertions: match property assignments (key followed by `:`), NOT
// bare mentions in comments. Each key is line-bound — `\b<key>\s*:` will match
// `lotId:` or `lotId : ` but never `// farmId dropped (REQ-200)`.
const KEY_LOT_ID_RE = /\blotId\s*:/;
const KEY_LOT_NAME_RE = /\blotName\s*:/;
const KEY_FARM_NAME_RE = /\bfarmName\s*:/;

// NEGATIVE gate (regression guard): farmId must NOT reappear as a property key
// post retire-farm-collapse-to-lot T27 (ContextHints dropped farmId, REQ-200).
// Applied to the extracted JSX block only — doc-comments mentioning the
// retirement are legitimate elsewhere in the file and must not poison this guard.
const KEY_FARM_ID_RE = /\bfarmId\s*:/;

describe("C2 presentation shape — Botón Registrar con IA inject lot-detail-client (existence-only regex)", () => {
  // α26
  it("lot-detail-client.tsx imports RegistrarConIABoton from @/components/agent/registrar-con-ia-boton", () => {
    const src = readFileSync(LOT_DETAIL_CLIENT, "utf-8");
    expect(src).toMatch(IMPORT_BOTON_RE);
  });

  // α27 INVERTED — farm-detail-client.tsx DELETED at retire-farm-collapse-to-lot T22.
  it("α27: farm-detail-client.tsx DELETED (retire-farm-collapse-to-lot T22 — Botón import vacuously absent; α26 + α28 lot-detail remain the live host)", () => {
    expect(existsSync(FARM_DETAIL_CLIENT)).toBe(false);
  });

  // α28 SHAPE-UPDATED — body migrated to extract-block + per-key + negative gate.
  it("α28: lot-detail-client.tsx renders <RegistrarConIABoton> with contextHints {lotId, lotName, farmName} and NO farmId (REQ-200 collapse)", () => {
    const src = readFileSync(LOT_DETAIL_CLIENT, "utf-8");
    const jsxMatch = src.match(BOTON_JSX_RE);
    expect(jsxMatch, "<RegistrarConIABoton> element not found in lot-detail-client.tsx").not.toBeNull();
    const block = jsxMatch![0];
    expect(block, "lotId key missing in contextHints").toMatch(KEY_LOT_ID_RE);
    expect(block, "lotName key missing in contextHints").toMatch(KEY_LOT_NAME_RE);
    expect(block, "farmName key missing in contextHints (REQ-205 grouping signal)").toMatch(KEY_FARM_NAME_RE);
    expect(block, "farmId key MUST be absent (dropped REQ-200, retire-farm-collapse-to-lot T27)").not.toMatch(KEY_FARM_ID_RE);
  });

  // α29 DELETED — POST-C2h SPLIT: farm-level scope farm-detail-client superseded por per-lote
  // scope única (single source of truth). Per-lote assertion preserved via α28 sobre
  // lot-detail-client.tsx + α27 farm import preserved (component still used per-lote dentro
  // AccordionContent expanded). Marco UX intuition runtime smoke catches farm-level button
  // context ambiguity granjero mayor ≥2 lotes activos (POC #1 hotfix C2h retroactivo).
});
