/**
 * PR7.1 RED — useCanAccess hook reads from the dynamic matrix provider
 * (REQ-U.2mod / D.8).
 *
 * Scenarios:
 *   (e) hook returns true when matrix grants
 *   (f) hook returns false otherwise
 *   (g) loading state (no provider / null snapshot) → false (deny while
 *       loading — never flash protected UI)
 *   (h) custom role (facturador) with custom permissions → hook reflects
 *       the matrix, NOT the static map
 */
import { renderHook, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useCanAccess } from "@/components/common/use-can-access";
import {
  RolesMatrixProvider,
  type ClientMatrixSnapshot,
} from "@/components/common/roles-matrix-provider";

afterEach(cleanup);

function wrapWith(snapshot: ClientMatrixSnapshot | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RolesMatrixProvider snapshot={snapshot}>{children}</RolesMatrixProvider>
    );
  };
}

describe("useCanAccess (REQ-U.2mod)", () => {
  describe("(e) returns true when matrix grants", () => {
    it("admin with members.write granted", () => {
      const { result } = renderHook(() => useCanAccess("members", "write"), {
        wrapper: wrapWith({
          orgId: "org-1",
          role: "admin",
          permissionsRead: ["members"],
          permissionsWrite: ["members"],
          canPost: [],
        }),
      });
      expect(result.current).toBe(true);
    });
  });

  describe("(f) returns false when matrix denies", () => {
    it("cobrador without journal.write", () => {
      const { result } = renderHook(() => useCanAccess("journal", "write"), {
        wrapper: wrapWith({
          orgId: "org-1",
          role: "cobrador",
          permissionsRead: [],
          permissionsWrite: [],
          canPost: [],
        }),
      });
      expect(result.current).toBe(false);
    });
  });

  describe("(g) loading state — no provider OR null snapshot → false", () => {
    it("returns false without a provider (safe default)", () => {
      const { result } = renderHook(() => useCanAccess("members", "write"));
      expect(result.current).toBe(false);
    });

    it("returns false when snapshot is null (loading)", () => {
      const { result } = renderHook(() => useCanAccess("members", "write"), {
        wrapper: wrapWith(null),
      });
      expect(result.current).toBe(false);
    });
  });

  describe("(h) custom role reflects matrix, not static map", () => {
    it("facturador with journal.write=true in matrix → true", () => {
      const { result } = renderHook(() => useCanAccess("journal", "write"), {
        wrapper: wrapWith({
          orgId: "org-1",
          role: "facturador",
          permissionsRead: ["journal"],
          permissionsWrite: ["journal"],
          canPost: ["journal"],
        }),
      });
      expect(result.current).toBe(true);
    });

    it("facturador with journal.write stripped → false", () => {
      const { result } = renderHook(() => useCanAccess("journal", "write"), {
        wrapper: wrapWith({
          orgId: "org-1",
          role: "facturador",
          permissionsRead: [],
          permissionsWrite: [],
          canPost: [],
        }),
      });
      expect(result.current).toBe(false);
    });
  });

  describe("U.2-S3 — reflects matrix update", () => {
    it("flips decision when snapshot prop changes (admin edits the role)", () => {
      const granted: ClientMatrixSnapshot = {
        orgId: "org-1",
        role: "admin",
        permissionsRead: [],
        permissionsWrite: ["members"],
        canPost: [],
      };
      const denied: ClientMatrixSnapshot = { ...granted, permissionsWrite: [] };

      // First mount: granted → hook returns true
      const first = renderHook(() => useCanAccess("members", "write"), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <RolesMatrixProvider snapshot={granted}>
            {children}
          </RolesMatrixProvider>
        ),
      });
      expect(first.result.current).toBe(true);

      // Fresh mount with a different snapshot → hook flips to false.
      // Triangulates that the hook is reading live from context, not a
      // stale initial value.
      const second = renderHook(() => useCanAccess("members", "write"), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <RolesMatrixProvider snapshot={denied}>
            {children}
          </RolesMatrixProvider>
        ),
      });
      expect(second.result.current).toBe(false);
    });
  });
});
