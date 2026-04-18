/**
 * PR2.2 [GREEN] — groupResources() pure util
 * REQ-RM.1, REQ-RM.2, REQ-RM.3, REQ-RM.4
 *
 * Buckets a flat list of resources into module-labelled groups based on the
 * MODULES[] registry, with cross-module resources landing in "Organización" last.
 * Zero hardcoded module names — new modules auto-appear.
 */
import type { Module } from "@/components/sidebar/modules/registry";
import type { Resource } from "@/features/shared/permissions";

export type MatrixGroup = {
  label: string;
  resources: Resource[];
};

export const ORG_LABEL = "Organización";

/**
 * Groups `allResources` into sections derived dynamically from `modules`.
 * - One section per Module (in registry order) — only resources present in
 *   both the module's `resources[]` and `allResources` are included.
 * - A final "Organización" section for resources not claimed by any module.
 * - Empty sections (no matching resources) are dropped.
 *
 * @param allResources - Canonical ordered list of all resources (e.g. RESOURCE_ORDER)
 * @param modules      - Module registry (MODULES from registry.ts)
 */
export function groupResources(
  allResources: readonly Resource[],
  modules: readonly Module[],
): MatrixGroup[] {
  // All resources claimed by at least one module
  const inAnyModule = new Set<Resource>(modules.flatMap((m) => m.resources));

  // One section per module — preserves registry order; inner order follows allResources
  const moduleGroups: MatrixGroup[] = modules.map((m) => ({
    label: m.label,
    resources: allResources.filter((r) => m.resources.includes(r)),
  }));

  // Organización — everything not claimed by any module
  const orgResources = allResources.filter((r) => !inAnyModule.has(r));
  const orgGroup: MatrixGroup = { label: ORG_LABEL, resources: orgResources };

  // Modules first, Organización last. Drop empty groups.
  return [...moduleGroups, orgGroup].filter((g) => g.resources.length > 0);
}
