/**
 * PR1.2 [GREEN] — Shared util extracted from active-module-nav.tsx (PR1 Foundation).
 *
 * REQ-RM.12: dropOrphanSeparators must live in a shared location so both the
 * real sidebar (active-module-nav.tsx) and the sidebar preview
 * (RoleSidebarPreview) use the same algorithm without drift.
 *
 * IMPORTANT: This function is BYTE-IDENTICAL to the local definition that was
 * previously inlined in components/sidebar/active-module-nav.tsx (PR4.6).
 * Do NOT modify the algorithm — it is locked by the active-module-nav.test.tsx
 * regression gate (PR1.3).
 */

import type { ModuleNavItem } from "@/components/sidebar/modules/registry";

/**
 * Drop separators that have no surviving child between them and the next
 * separator (or the end of the list). Operates on an already-filtered list so
 * "surviving" means "child that passed canAccess / whatever filter the caller
 * applied upstream".
 */
export function dropOrphanSeparators(items: ModuleNavItem[]): ModuleNavItem[] {
  const result: ModuleNavItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.isSeparator) {
      result.push(item);
      continue;
    }
    // Look ahead: find the next separator (or end of list). If any non-
    // separator item exists in that window, keep this separator; else drop.
    let hasChild = false;
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].isSeparator) break;
      hasChild = true;
      break;
    }
    if (hasChild) result.push(item);
  }
  return result;
}
