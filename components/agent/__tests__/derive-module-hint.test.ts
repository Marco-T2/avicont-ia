import { describe, expect, it } from "vitest";
import { deriveModuleHint } from "../derive-module-hint";

// REQ-2 (design D2) — deriveModuleHint(pathname) is a pure helper that maps
// the dashboard pathname segment to a ModuleHintValue. Pathname convention:
// /<orgSlug>/<moduleSegment>/...
//
// Mapping post-collapse (T21 retire-farm-collapse-to-lot):
//   - /<orgSlug>/accounting/...   -> "accounting"
//   - /<orgSlug>/lots/...         -> "farm"
//   - anything else (incl. retired /farms/...) -> null

describe("deriveModuleHint — accounting", () => {
  it.each([
    ["/acme/accounting", "accounting"],
    ["/acme/accounting/journals", "accounting"],
    ["/acme/accounting/cxc/contact-123", "accounting"],
  ] as const)("maps %s to %s", (pathname, expected) => {
    expect(deriveModuleHint(pathname)).toBe(expected);
  });
});

describe("deriveModuleHint — farm (lots only post-collapse)", () => {
  it.each([
    ["/acme/lots", "farm"],
    ["/acme/lots/lot-456", "farm"],
  ] as const)("maps %s to %s", (pathname, expected) => {
    expect(deriveModuleHint(pathname)).toBe(expected);
  });
});

describe("deriveModuleHint — null (unmapped modules, root, empty, retired farms)", () => {
  it.each([
    ["/acme/documents"],
    ["/acme/members"],
    ["/acme/settings"],
    // Retired post-T21 — /farms hierarchy is deleted in T22.
    ["/acme/farms"],
    ["/acme/farms/farm-123"],
    ["/acme"],
    ["/"],
    [""],
  ] as const)("maps %s to null", (pathname) => {
    expect(deriveModuleHint(pathname)).toBeNull();
  });
});
