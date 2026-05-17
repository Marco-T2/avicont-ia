/**
 * SCN-5.2 — registrar-con-ia/index.tsx must call useAgentQuery.query with
 * surface: "modal-registrar" in BOTH handleSend (L73) and handleRetry (L135).
 *
 * AXIS DEVIATION (honest surface): the modal is a deeply composed Radix
 * Dialog whose end-to-end mount requires fixtures dwarfing the assertion
 * (status/state machine, message-list rendering, Dialog portal lifecycle).
 * Mirrors SCN-5.3 (journal-entry-ai-modal) — text-level assertion on
 * source file at both call sites, paired with the c0-domain-shape
 * readFileSync precedent already established in modules/ai-agent/__tests__/.
 *
 * Note: this is in a .tsx file to live under the `components` vitest
 * project. No JSX rendered — just readFileSync text checks.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "..", "index.tsx"),
  "utf-8",
);

describe("SCN-5.2: registrar-con-ia source contains surface literal at both call sites", () => {
  it("handleSend query call includes surface: 'modal-registrar'", () => {
    const handleSendBlock = src.slice(
      src.indexOf("handleSend"),
      src.indexOf("handleConfirm"),
    );
    expect(handleSendBlock).toMatch(
      /surface:\s*['"]modal-registrar['"]/,
    );
  });

  it("handleRetry query call includes surface: 'modal-registrar'", () => {
    const handleRetryBlock = src.slice(src.indexOf("handleRetry"));
    expect(handleRetryBlock).toMatch(
      /surface:\s*['"]modal-registrar['"]/,
    );
  });

  it("the total surface literal count for modal-registrar is exactly 2", () => {
    const matches = src.match(/surface:\s*['"]modal-registrar['"]/g) ?? [];
    expect(matches).toHaveLength(2);
  });
});
