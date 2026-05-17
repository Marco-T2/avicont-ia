import { describe, expect, it } from "vitest";
import { deriveModuleHint } from "../derive-module-hint";

// REQ-2 (design D2) — deriveModuleHint(pathname) is a pure helper that maps
// the dashboard pathname segment to a ModuleHintValue. Pathname convention:
// /<orgSlug>/<moduleSegment>/...
//
// Mapping (D2.1):
//   - /<orgSlug>/accounting/...   -> "accounting"
//   - /<orgSlug>/farms/...        -> "farm"
//   - /<orgSlug>/lots/...         -> "farm"
//   - anything else               -> null

describe("deriveModuleHint — accounting", () => {
  it.each([
    ["/acme/accounting", "accounting"],
    ["/acme/accounting/journals", "accounting"],
    ["/acme/accounting/cxc/contact-123", "accounting"],
  ] as const)("maps %s to %s", (pathname, expected) => {
    expect(deriveModuleHint(pathname)).toBe(expected);
  });
});

describe("deriveModuleHint — farm (farms or lots)", () => {
  it.each([
    ["/acme/farms", "farm"],
    ["/acme/farms/farm-123", "farm"],
    ["/acme/lots", "farm"],
    ["/acme/lots/lot-456", "farm"],
  ] as const)("maps %s to %s", (pathname, expected) => {
    expect(deriveModuleHint(pathname)).toBe(expected);
  });
});

describe("deriveModuleHint — null (unmapped modules, root, empty)", () => {
  it.each([
    ["/acme/documents"],
    ["/acme/members"],
    ["/acme/settings"],
    ["/acme"],
    ["/"],
    [""],
  ] as const)("maps %s to null", (pathname) => {
    expect(deriveModuleHint(pathname)).toBeNull();
  });
});
