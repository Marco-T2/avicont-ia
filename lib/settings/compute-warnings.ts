/**
 * PR3.2 [GREEN] — computeWarnings() pure util
 * REQ-RM.16, REQ-RM.17, REQ-RM.18, REQ-RM.19
 *
 * Derives soft inline warnings from the three permission Sets + MODULES[].
 * Pure function — no side effects, never throws, never blocks save.
 * Messages in Rioplatense voseo warm tone.
 */
import type { Resource, PostableResource } from "@/features/permissions";
import type { Module } from "@/components/sidebar/modules/registry";
import { RESOURCE_LABELS } from "@/lib/settings/resource-labels";

// ─── Warning types ───────────────────────────────────────────────────────────

export type Warning =
  | { severity: "soft"; kind: "empty-sidebar"; message: string }
  | {
      severity: "soft";
      kind: "write-without-read";
      resource: Resource;
      message: string;
    }
  | {
      severity: "soft";
      kind: "post-without-write";
      resource: PostableResource;
      message: string;
    };

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Computes soft warnings for the current toggle state.
 *
 * Three warning cases:
 *   1. Empty sidebar — no module has any readable resource (REQ-RM.16)
 *   2. Write without read — can edit but not see a resource (REQ-RM.17)
 *   3. Post without write — can post but not edit a resource (REQ-RM.18)
 *
 * @param readSet  - Resources currently in the Ver (read) set
 * @param writeSet - Resources currently in the Editar (write) set
 * @param postSet  - Resources currently in the Registrar (post) set
 * @param modules  - MODULES registry — used to determine sidebar visibility
 * @returns        - Array of soft warnings; empty means no issues
 */
export function computeWarnings(
  readSet: Set<Resource>,
  writeSet: Set<Resource>,
  postSet: Set<PostableResource>,
  modules: readonly Module[],
): Warning[] {
  const warnings: Warning[] = [];

  // ── 1. Empty sidebar (REQ-RM.16) ──────────────────────────────────────────
  // A module is visible if at least one of its resources is in readSet.
  // Cross-module resources (members, documents, agent) are NOT enough to make
  // any module visible — they appear in the Organización strip, not in the
  // module switcher. The spec tests: MODULES.every(m => m.resources.every(r => !readSet.has(r)))
  const noModuleVisible = modules.every((m) =>
    m.resources.every((r) => !readSet.has(r)),
  );

  if (noModuleVisible) {
    warnings.push({
      severity: "soft",
      kind: "empty-sidebar",
      message:
        "Este rol no va a ver ningún módulo. ¿Seguro querés guardarlo así?",
    });
  }

  // ── 2. Write without read — per resource (REQ-RM.17) ──────────────────────
  // For each r in writeSet where readSet does NOT have r
  for (const r of writeSet) {
    if (!readSet.has(r)) {
      warnings.push({
        severity: "soft",
        kind: "write-without-read",
        resource: r,
        message: `Activaste Editar en "${RESOURCE_LABELS[r]}" sin Ver. El rol no va a poder llegar a la pantalla.`,
      });
    }
  }

  // ── 3. Post without write — per postable resource (REQ-RM.18) ─────────────
  // For each r in postSet where writeSet does NOT have r
  for (const r of postSet) {
    if (!writeSet.has(r as Resource)) {
      warnings.push({
        severity: "soft",
        kind: "post-without-write",
        resource: r,
        message: `Activaste Registrar en "${RESOURCE_LABELS[r]}" sin Editar. Sin Editar no vas a poder cargar el comprobante.`,
      });
    }
  }

  return warnings;
}
