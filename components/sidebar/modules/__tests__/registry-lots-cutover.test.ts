/**
 * T21 [RED → GREEN] — sidebar module registry post-collapse
 * (retire-farm-collapse-to-lot, REQ-200).
 *
 * After T21 the "granjas" module (id unchanged — module ID is the
 * sidebar grouping label, not a path):
 * - `homeRoute(orgSlug)` returns `/${orgSlug}/lots` (was `/farms`)
 * - The single navItem renders label "Mis Lotes" (was "Mis Granjas")
 *   and its `href(orgSlug)` returns `/${orgSlug}/lots`.
 *
 * Resource scope stays `["farms"]` because the permissions Resource
 * union is frozen (Marco I.2/I.3 lock, D-10 — "farms" stays as a
 * symbolic permission key, file comments document the history). The
 * SDD scope is UI route surface, not the permission identifier.
 *
 * Expected failure mode (RED): current registry returns
 * `/${orgSlug}/farms` from `homeRoute` and the navItem label is
 * "Mis Granjas". 4/4 fail. GREEN after the registry edit.
 */
import { describe, expect, it } from "vitest";
import { MODULES } from "../registry";

const granjas = MODULES.find((m) => m.id === "granjas");

describe("T21 — granjas module post-collapse home route + label", () => {
  it("module is still registered (only its surface changes, not its id)", () => {
    expect(granjas).toBeDefined();
  });

  it("homeRoute(orgSlug) returns /${orgSlug}/lots (was /farms)", () => {
    expect(granjas!.homeRoute("acme")).toBe("/acme/lots");
  });

  it("single navItem label is 'Mis Lotes' (was 'Mis Granjas')", () => {
    expect(granjas!.navItems).toHaveLength(1);
    expect(granjas!.navItems[0].label).toBe("Mis Lotes");
  });

  it("navItem href(orgSlug) returns /${orgSlug}/lots", () => {
    const navItem = granjas!.navItems[0];
    expect(navItem.href).toBeDefined();
    expect(navItem.href!("acme")).toBe("/acme/lots");
  });
});
