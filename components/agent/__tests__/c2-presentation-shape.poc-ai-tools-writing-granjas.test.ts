/**
 * C2 presentation shape — Botón "Registrar con IA" inject pages 2 contextos
 * (lot-detail-client + farm-detail-client) shape verification existence-only regex Opt A.
 *
 * Paired sister precedent STRUCTURAL EXACT mirror:
 *   - c5-pages-cutover-shape.poc-paired-farms-lots.test.ts (REPO_ROOT pattern + ^import...m
 *     anchor + path.join cross-dir resolve components/agent/__tests__ → app/(dashboard)/...)
 *   - c0/c1-presentation-shape.poc-ai-tools-writing-granjas.test.ts (existence-only regex
 *     Opt A convention + describe/it block structure)
 *
 * UX SHAPE axis: botón trigger reusable single source of truth 2 contextos (Q1 lock Opt A
 * APROBADO reusable vs inline copy-paste anti-pattern). Posición UI header right (Q2 lock
 * Opt A APROBADO). ContextHints scope minimal per-context (Q3 lock Opt A APROBADO):
 *   - /lots/[lotId] → contextHints={{ lotId, lotName, farmId }} skip farmName (modal NO usa)
 *   - /farms/[farmId] → contextHints={{ farmId, farmName }} NO lotId
 *
 * Verifica shape EDIT C2 archivos pages cementados post-C5 hex farms+lots:
 *   - lot-detail-client.tsx imports RegistrarConIABoton + renders <RegistrarConIABoton
 *     contextHints={{ lotId, lotName, farmId }}>
 *   - farm-detail-client.tsx imports RegistrarConIABoton + renders <RegistrarConIABoton
 *     contextHints={{ farmId, farmName }}>
 *
 * RED-α C2: behavioral assertion mismatch combined mode — lot-detail-client.tsx +
 * farm-detail-client.tsx EXIST post-C5 cementado pero NO importan ni renderean
 * RegistrarConIABoton yet. Failure path REAL behavioral assertion mismatch (NOT ENOENT —
 * pages exist), regex import + JSX render line ausente pre-GREEN. Paired sister C5 pages
 * cutover shape precedent EXACT mirror (behavioral assertion mismatch sobre archivos
 * existing). evidence-supersedes-assumption-lock 42ma matures cumulative + feedback_red_
 * acceptance_failure_mode 12ma matures cumulative cross-POC recursive aplicación verified
 * textual filesystem pre-write MANDATORY heredado matures.
 */

import { readFileSync } from "node:fs";
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

const IMPORT_BOTON_RE =
  /^import\s+(?:\{[^}]*\bRegistrarConIABoton\b[^}]*\}|RegistrarConIABoton)\s*from\s*["']@\/components\/agent\/registrar-con-ia-boton["']/m;
const RENDER_BOTON_LOT_RE =
  /<RegistrarConIABoton\b[\s\S]*?contextHints\s*=\s*\{\{[\s\S]*?\blotId\b[\s\S]*?\blotName\b[\s\S]*?\bfarmId\b/;
// POST-C2h SPLIT: RENDER_BOTON_FARM_RE removed — farm-level scope superseded por per-lote
// scope única single source of truth (POC #1 C2h hotfix retroactivo Marco UX intuition catches
// button context ambiguity granjero mayor ≥2 lotes activos).

describe("C2 presentation shape — Botón Registrar con IA inject pages 2 contextos (existence-only regex)", () => {
  // α26
  it("lot-detail-client.tsx imports RegistrarConIABoton from @/components/agent/registrar-con-ia-boton", () => {
    const src = readFileSync(LOT_DETAIL_CLIENT, "utf-8");
    expect(src).toMatch(IMPORT_BOTON_RE);
  });

  // α27
  it("farm-detail-client.tsx imports RegistrarConIABoton from @/components/agent/registrar-con-ia-boton", () => {
    const src = readFileSync(FARM_DETAIL_CLIENT, "utf-8");
    expect(src).toMatch(IMPORT_BOTON_RE);
  });

  // α28
  it("lot-detail-client.tsx renders <RegistrarConIABoton> with contextHints {lotId, lotName, farmId}", () => {
    const src = readFileSync(LOT_DETAIL_CLIENT, "utf-8");
    expect(src).toMatch(RENDER_BOTON_LOT_RE);
  });

  // α29 DELETED — POST-C2h SPLIT: farm-level scope farm-detail-client superseded por per-lote
  // scope única (single source of truth). Per-lote assertion preserved via α28 sobre
  // lot-detail-client.tsx + α27 farm import preserved (component still used per-lote dentro
  // AccordionContent expanded). Marco UX intuition runtime smoke catches farm-level button
  // context ambiguity granjero mayor ≥2 lotes activos (POC #1 hotfix C2h retroactivo).
});
