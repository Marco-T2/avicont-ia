/**
 * <Gated> component tests — PR5 original + PR7.1 refactor.
 *
 * PR7.1 refactor (D.8, U.1mod, U.2mod): <Gated> and useCanAccess now read
 * from a dynamic matrix provider (<RolesMatrixProvider>) instead of calling
 * sync static canAccess. Tests migrated to render the provider with an
 * explicit snapshot.
 *
 * Loading state: a null snapshot (fetch in flight) renders nothing (no flash).
 */
import { render, screen, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { Gated } from "@/components/common/gated";
import { useCanAccess } from "@/components/common/use-can-access";
import {
  RolesMatrixProvider,
  type ClientMatrixSnapshot,
} from "@/components/common/roles-matrix-provider";

afterEach(cleanup);

function withSnapshot(snapshot: ClientMatrixSnapshot | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RolesMatrixProvider snapshot={snapshot}>{children}</RolesMatrixProvider>
    );
  };
}

function snap(
  role: string,
  read: string[],
  write: string[],
  canPost: string[] = [],
): ClientMatrixSnapshot {
  return {
    orgId: "org-1",
    role,
    permissionsRead: read,
    permissionsWrite: write,
    canPost,
  };
}

describe("<Gated> (REQ-U.1mod)", () => {
  describe("U.1-S1 — contador ve botón 'Contabilizar' en JE detail", () => {
    it("renders children when matrix grants journal.write for caller", () => {
      render(
        <RolesMatrixProvider snapshot={snap("contador", ["journal"], ["journal"])}>
          <Gated resource="journal" action="write">
            <button>Contabilizar</button>
          </Gated>
        </RolesMatrixProvider>,
      );

      expect(
        screen.getByRole("button", { name: /contabilizar/i }),
      ).toBeInTheDocument();
    });
  });

  describe("U.1-S2 — cobrador no ve 'Editar' en sale detail", () => {
    it("does NOT render children when matrix denies sales.write", () => {
      render(
        <RolesMatrixProvider snapshot={snap("cobrador", ["sales"], [])}>
          <Gated resource="sales" action="write">
            <button>Editar</button>
          </Gated>
        </RolesMatrixProvider>,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("cobrador CAN read sales → renders children for sales/read", () => {
      render(
        <RolesMatrixProvider snapshot={snap("cobrador", ["sales"], [])}>
          <Gated resource="sales" action="read">
            <span>sales list</span>
          </Gated>
        </RolesMatrixProvider>,
      );
      expect(screen.getByText("sales list")).toBeInTheDocument();
    });
  });

  describe("U.1-S3 — loading state (no flash)", () => {
    it("renders nothing when snapshot is null (matrix loading)", () => {
      render(
        <RolesMatrixProvider snapshot={null}>
          <Gated resource="journal" action="write">
            <button>Contabilizar</button>
          </Gated>
        </RolesMatrixProvider>,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders nothing when no provider is present (safe default)", () => {
      render(
        <Gated resource="journal" action="write">
          <button>Contabilizar</button>
        </Gated>,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("U.1-S4 — custom role respected by Gated", () => {
    it("facturador with journal.write=true in matrix → button visible", () => {
      render(
        <RolesMatrixProvider
          snapshot={snap("facturador", ["journal"], ["journal"], ["journal"])}
        >
          <Gated resource="journal" action="write">
            <button>Contabilizar</button>
          </Gated>
        </RolesMatrixProvider>,
      );
      expect(
        screen.getByRole("button", { name: /contabilizar/i }),
      ).toBeInTheDocument();
    });

    it("facturador with journal.write stripped → button hidden (matrix edit reflected)", () => {
      render(
        <RolesMatrixProvider snapshot={snap("facturador", [], [])}>
          <Gated resource="journal" action="write">
            <button>Contabilizar</button>
          </Gated>
        </RolesMatrixProvider>,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

});

describe("useCanAccess (REQ-U.2mod) — shim re-exported from gated", () => {
  describe("U.2-S1 — hook retorna bool segun matriz", () => {
    it("returns false for cobrador + journal/write", () => {
      const { result } = renderHook(() => useCanAccess("journal", "write"), {
        wrapper: withSnapshot(snap("cobrador", [], [])),
      });
      expect(result.current).toBe(false);
    });

    it("returns true for contador + reports/read", () => {
      const { result } = renderHook(() => useCanAccess("reports", "read"), {
        wrapper: withSnapshot(snap("contador", ["reports"], [])),
      });
      expect(result.current).toBe(true);
    });

    it("returns false for contador + reports/write", () => {
      const { result } = renderHook(() => useCanAccess("reports", "write"), {
        wrapper: withSnapshot(snap("contador", ["reports"], [])),
      });
      expect(result.current).toBe(false);
    });
  });

  describe("U.2-S2 — hook durante loading", () => {
    it("returns false when snapshot is null (loading)", () => {
      const { result } = renderHook(() => useCanAccess("journal", "write"), {
        wrapper: withSnapshot(null),
      });
      expect(result.current).toBe(false);
    });

    it("returns false when no provider (caller outside tree)", () => {
      const { result } = renderHook(() => useCanAccess("sales", "read"));
      expect(result.current).toBe(false);
    });
  });
});
