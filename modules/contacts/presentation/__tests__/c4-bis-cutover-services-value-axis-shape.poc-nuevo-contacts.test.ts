/**
 * POC nuevo contacts C4-bis RED — 4 archivos cross-feature consumers VALUE-axis
 * cutover legacy `ContactsService` class hex barrel re-export Opción A
 * (cementado C1 GREEN línea 13 modules/contacts/presentation/server.ts) →
 * factory `makeContactsService()` pattern hex same barrel path. Cementación
 * VALUE-axis honest 8α explicit pre-DROP línea 13 cumulative C4 GREEN single
 * batch (Marco lock Opción D — addendum RED separate + GREEN cumulative
 * preserves D-β-c4 mental model wholesale delete + cumulative cutover atomic).
 *
 * Recon gap surfaced honest pre-GREEN commit Step 0 9-axis classification
 * recon falló: grepé `features/contacts` paths pero NO grepé `ContactsService`
 * symbol PROJECT-scope → 4 archivos cross-feature VALUE consumers invisibles
 * cementados C1 GREEN cuando 20 callsites swap al hex barrel + Opción A
 * re-export sobrevivió load-bearing para estos 4. Lección NEW canonical home
 * D1 cementación target — `feedback/retirement-reinventory-gate-class-symbol-grep`
 * 10ma axis cumulative cross-POC: cuando wholesale delete + DROP re-export
 * bridge, MANDATORY grep class symbol PROJECT-scope (NO solo path grep).
 *
 * 4 archivos VALUE consumers FULL (NO type-only):
 *   - features/accounting/journal.service.ts (field type + ctor DI default + new ContactsService())
 *   - modules/ai-agent/application/tools/find-contact.ts (deps type + new ContactsService() fallback)
 *   - modules/ai-agent/application/tools/parse-operation.ts (deps type + new ContactsService() fallback)
 *   - features/dispatch/dispatch.service.ts (field type + ctor DI default + new ContactsService())
 *
 * 8α single test file homogeneous granularity per archivo bisect-friendly:
 *   - 4 POS hex factory `import { makeContactsService } from "@/modules/contacts/presentation/server"` per archivo
 *   - 4 NEG alternation legacy class drop `(?:import { ContactsService } from|new ContactsService(...)` per archivo (mirror C5 RED Test 4 alternation precedent EXACT)
 *
 * Test file location modules/contacts/presentation/__tests__/ — target hex
 * ownership mirror precedent c4 EXACT — self-contained future-proof.
 *
 * Expected failure mode pre-GREEN: 8/8 FAIL enumerated explicit per
 * feedback_red_acceptance_failure_mode (T1/T3/T5/T7 POS hex factory currently
 * absent + T2/T4/T6/T8 NEG legacy class import + instanciación currently
 * present).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("POC nuevo contacts C4-bis — 4 archivos cross-feature consumers VALUE-axis cutover factory pattern hex", () => {
  // journal.service.ts
  it("Test 1: journal.service.ts contains `import { makeContactsService } from \"@/modules/contacts/presentation/server\"` (POSITIVE hex factory swap target post-cutover)", () => {
    const src = read("features/accounting/journal.service.ts");
    expect(src).toMatch(
      /^import \{ makeContactsService \} from "@\/modules\/contacts\/presentation\/server";$/m,
    );
  });
  it("Test 2: journal.service.ts NO contains legacy `import { ContactsService } from` o `new ContactsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1 Opción A re-export DROP línea 13)", () => {
    const src = read("features/accounting/journal.service.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*ContactsService\s*\}\s*from|new\s+ContactsService\s*\()/,
    );
  });

  // find-contact.ts
  it("Test 3: find-contact.ts contains `import { makeContactsService } from \"@/modules/contacts/presentation/server\"` (POSITIVE hex factory swap target post-cutover; new modules/ uses import type — regex updated for type-import variant)", () => {
    const src = read("modules/ai-agent/application/tools/find-contact.ts");
    expect(src).toMatch(
      /^import\s+(?:type\s+)?\{[^}]*\bmakeContactsService\b[^}]*\}\s+from\s+["']@\/modules\/contacts\/presentation\/server["']/m,
    );
  });
  it("Test 4: find-contact.ts NO contains legacy `import { ContactsService } from` o `new ContactsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1 Opción A re-export DROP línea 13)", () => {
    const src = read("modules/ai-agent/application/tools/find-contact.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*ContactsService\s*\}\s*from|new\s+ContactsService\s*\()/,
    );
  });

  // parse-operation.ts
  it("Test 5: parse-operation.ts contains `import { makeContactsService } from \"@/modules/contacts/presentation/server\"` (POSITIVE hex factory swap target post-cutover; new modules/ uses import type — regex updated for type-import variant)", () => {
    const src = read("modules/ai-agent/application/tools/parse-operation.ts");
    expect(src).toMatch(
      /^import\s+(?:type\s+)?\{[^}]*\bmakeContactsService\b[^}]*\}\s+from\s+["']@\/modules\/contacts\/presentation\/server["']/m,
    );
  });
  it("Test 6: parse-operation.ts NO contains legacy `import { ContactsService } from` o `new ContactsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1 Opción A re-export DROP línea 13)", () => {
    const src = read("modules/ai-agent/application/tools/parse-operation.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*ContactsService\s*\}\s*from|new\s+ContactsService\s*\()/,
    );
  });

  // dispatch.service.ts
  it("Test 7: dispatch.service.ts contains `import { makeContactsService } from \"@/modules/contacts/presentation/server\"` (POSITIVE hex factory swap target post-cutover)", () => {
    const src = read("features/dispatch/dispatch.service.ts");
    expect(src).toMatch(
      /^import \{ makeContactsService \} from "@\/modules\/contacts\/presentation\/server";$/m,
    );
  });
  it("Test 8: dispatch.service.ts NO contains legacy `import { ContactsService } from` o `new ContactsService(` instanciación (NEGATIVE alternation legacy class drop post-cutover Marco lock C1 Opción A re-export DROP línea 13)", () => {
    const src = read("features/dispatch/dispatch.service.ts");
    expect(src).not.toMatch(
      /(?:import\s*\{\s*ContactsService\s*\}\s*from|new\s+ContactsService\s*\()/,
    );
  });
});
