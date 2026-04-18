/**
 * PR1.1 [RED] — Pure-function tests for dropOrphanSeparators
 *
 * REQ-RM.12: dropOrphanSeparators must be a shared util so both the real
 * sidebar (active-module-nav.tsx) and the sidebar preview (RoleSidebarPreview)
 * use the same algorithm without drift.
 *
 * Environment: node (.test.ts — pure function, no DOM deps)
 *
 * Four cases extracted from the existing active-module-nav.test.tsx separator
 * tests (PR4.5 block), now tested against the extracted module directly:
 *   (a) separator followed by visible children → separator kept
 *   (b) separator whose run has no surviving children → separator dropped
 *   (c) two adjacent separators (empty run between them) → both dropped
 *   (d) trailing separator with no child after it → dropped
 */

import { describe, it, expect } from "vitest";
import type { ModuleNavItem } from "@/components/sidebar/modules/registry";
import { dropOrphanSeparators } from "@/lib/sidebar/drop-orphan-separators";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function sep(label: string): ModuleNavItem {
  return { label, isSeparator: true };
}

function link(label: string): ModuleNavItem {
  return { label, href: (slug) => `/${slug}/${label.toLowerCase()}` };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("dropOrphanSeparators", () => {
  it("(a) keeps a separator when it has at least one non-separator child after it", () => {
    const items: ModuleNavItem[] = [sep("Section A"), link("Item 1"), link("Item 2")];
    const result = dropOrphanSeparators(items);
    expect(result).toHaveLength(3);
    expect(result[0].isSeparator).toBe(true);
    expect(result[0].label).toBe("Section A");
  });

  it("(b) drops a separator whose entire run has no surviving children", () => {
    // [sep-A, sep-B, item] — sep-A has no children before sep-B → dropped
    // sep-B does have 'item' → kept
    const items: ModuleNavItem[] = [sep("Empty Section"), sep("With Items"), link("Kept Item")];
    const result = dropOrphanSeparators(items);
    expect(result.some((i) => i.label === "Empty Section")).toBe(false);
    expect(result.some((i) => i.label === "With Items")).toBe(true);
    expect(result.some((i) => i.label === "Kept Item")).toBe(true);
  });

  it("(c) drops both separators when two adjacent separators have no items between them", () => {
    // [sep-A, sep-B] with nothing between them → sep-A dropped (no children before sep-B);
    // sep-B dropped (no children before end-of-list)
    const items: ModuleNavItem[] = [sep("First"), sep("Second")];
    const result = dropOrphanSeparators(items);
    expect(result).toHaveLength(0);
  });

  it("(d) drops a trailing separator with no child following it (end-of-list case)", () => {
    const items: ModuleNavItem[] = [link("Visible Item"), sep("TrailingSep")];
    const result = dropOrphanSeparators(items);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Visible Item");
    expect(result.some((i) => i.label === "TrailingSep")).toBe(false);
  });
});
