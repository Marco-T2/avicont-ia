/**
 * PR7.1 RED — <RolesMatrixProvider> client-side dynamic matrix (REQ-U.1mod / REQ-U.2mod / D.3 / D.8)
 *
 * Scope: provider accepts a serializable matrix snapshot and exposes a
 * ClientMatrix (role + canAccess/canPost functions) via React context.
 *
 * The snapshot is fetched server-side in the dashboard layout (Option B —
 * no loading flash) and passed as a prop. The provider is the single source
 * of truth for gating on the client: <Gated> and useCanAccess read from it.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import {
  RolesMatrixProvider,
  useRolesMatrix,
  type ClientMatrixSnapshot,
} from "@/components/common/roles-matrix-provider";

afterEach(cleanup);

function mkSnapshot(
  overrides: Partial<ClientMatrixSnapshot> = {},
): ClientMatrixSnapshot {
  return {
    orgId: "org-1",
    role: "admin",
    permissionsRead: ["members", "sales", "journal"],
    permissionsWrite: ["members", "sales", "journal"],
    canPost: ["sales", "journal"],
    ...overrides,
  };
}

function Probe({ resource, action }: { resource: string; action: "read" | "write" }) {
  const matrix = useRolesMatrix();
  if (!matrix) return <span data-testid="no-matrix">no-matrix</span>;
  const allowed = matrix.canAccess(
    resource as never,
    action,
  );
  return (
    <span data-testid="probe">
      {allowed ? "allowed" : "denied"}:{matrix.role}
    </span>
  );
}

describe("RolesMatrixProvider", () => {
  describe("accepts a snapshot prop and exposes it via context", () => {
    it("exposes role + canAccess returning true for granted (resource, action)", () => {
      const snapshot = mkSnapshot({
        role: "admin",
        permissionsWrite: ["members"],
      });

      render(
        <RolesMatrixProvider snapshot={snapshot}>
          <Probe resource="members" action="write" />
        </RolesMatrixProvider>,
      );

      expect(screen.getByTestId("probe")).toHaveTextContent("allowed:admin");
    });

    it("canAccess returns false for not-granted (resource, action)", () => {
      const snapshot = mkSnapshot({
        role: "cobrador",
        permissionsWrite: [],
      });

      render(
        <RolesMatrixProvider snapshot={snapshot}>
          <Probe resource="members" action="write" />
        </RolesMatrixProvider>,
      );

      expect(screen.getByTestId("probe")).toHaveTextContent("denied:cobrador");
    });
  });

  describe("re-renders with new snapshot when prop changes", () => {
    it("flips from allowed to denied when the snapshot prop mutates", () => {
      const granted = mkSnapshot({ role: "admin", permissionsWrite: ["members"] });
      const denied = mkSnapshot({ role: "admin", permissionsWrite: [] });

      const { rerender } = render(
        <RolesMatrixProvider snapshot={granted}>
          <Probe resource="members" action="write" />
        </RolesMatrixProvider>,
      );

      expect(screen.getByTestId("probe")).toHaveTextContent("allowed:admin");

      rerender(
        <RolesMatrixProvider snapshot={denied}>
          <Probe resource="members" action="write" />
        </RolesMatrixProvider>,
      );

      expect(screen.getByTestId("probe")).toHaveTextContent("denied:admin");
    });
  });

  describe("without provider", () => {
    it("useRolesMatrix returns null (safe default — callers treat as loading/deny)", () => {
      render(<Probe resource="members" action="write" />);
      expect(screen.getByTestId("no-matrix")).toBeInTheDocument();
    });
  });

  describe("null snapshot (caller explicitly opts into loading state)", () => {
    it("exposes null matrix so consumers deny by default", () => {
      render(
        <RolesMatrixProvider snapshot={null}>
          <Probe resource="members" action="write" />
        </RolesMatrixProvider>,
      );
      expect(screen.getByTestId("no-matrix")).toBeInTheDocument();
    });
  });

  describe("canPost helper", () => {
    it("returns true when resource is in canPost set", () => {
      const snapshot = mkSnapshot({ role: "contador", canPost: ["journal"] });

      function CanPostProbe() {
        const m = useRolesMatrix();
        if (!m) return <span>no</span>;
        return <span data-testid="post">{m.canPost("journal") ? "y" : "n"}</span>;
      }

      render(
        <RolesMatrixProvider snapshot={snapshot}>
          <CanPostProbe />
        </RolesMatrixProvider>,
      );

      expect(screen.getByTestId("post")).toHaveTextContent("y");
    });

    it("returns false when resource is NOT in canPost set", () => {
      const snapshot = mkSnapshot({ role: "auxiliar", canPost: [] });

      function CanPostProbe() {
        const m = useRolesMatrix();
        if (!m) return <span>no</span>;
        return <span data-testid="post">{m.canPost("journal") ? "y" : "n"}</span>;
      }

      render(
        <RolesMatrixProvider snapshot={snapshot}>
          <CanPostProbe />
        </RolesMatrixProvider>,
      );

      expect(screen.getByTestId("post")).toHaveTextContent("n");
    });
  });
});
