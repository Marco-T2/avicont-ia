/**
 * PR5 5.1 RED — <Gated> component + useCanAccess hook (REQ-U.1 / REQ-U.2)
 *
 * Gating UI es defensivo — mejora UX ocultando botones no permitidos.
 * La autorización real vive server-side (requirePermission, PR4).
 *
 * Loading states render nada (no flash): hasta que useOrgRole resuelva el rol,
 * <Gated> devuelve null y useCanAccess devuelve false.
 */
import { render, screen, cleanup, renderHook } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock useOrgRole so tests control role + isLoading
vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: vi.fn(),
}));

import { useOrgRole } from "@/components/common/use-org-role";
import { Gated, useCanAccess } from "@/components/common/gated";

const mockedUseOrgRole = vi.mocked(useOrgRole);

afterEach(() => {
  cleanup();
  mockedUseOrgRole.mockReset();
});

function mockRole(role: string | null, isLoading = false) {
  mockedUseOrgRole.mockReturnValue({
    role: role as never,
    isLoading,
    orgSlug: "acme",
  });
}

describe("<Gated> (REQ-U.1)", () => {
  describe("U.1-S1 — contador ve botón 'Contabilizar' en JE detail", () => {
    it("renders children when canAccess(contador, journal, write) is true", () => {
      mockRole("contador");

      render(
        <Gated resource="journal" action="write">
          <button>Contabilizar</button>
        </Gated>,
      );

      expect(
        screen.getByRole("button", { name: /contabilizar/i }),
      ).toBeInTheDocument();
    });
  });

  describe("U.1-S2 — cobrador no ve 'Editar' en sale detail", () => {
    it("does NOT render children when canAccess(cobrador, sales, write) is false", () => {
      mockRole("cobrador");

      render(
        <Gated resource="sales" action="write">
          <button>Editar</button>
        </Gated>,
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("cobrador CAN read sales → renders children for sales/read", () => {
      mockRole("cobrador");

      render(
        <Gated resource="sales" action="read">
          <span>sales list</span>
        </Gated>,
      );

      expect(screen.getByText("sales list")).toBeInTheDocument();
    });
  });

  describe("U.1-S3 — loading state", () => {
    it("renders nothing while isLoading=true, even if role would allow", () => {
      mockRole("owner", true);

      render(
        <Gated resource="journal" action="write">
          <button>Contabilizar</button>
        </Gated>,
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders nothing when role is null (not a member / logged out)", () => {
      mockRole(null, false);

      render(
        <Gated resource="journal" action="write">
          <button>Contabilizar</button>
        </Gated>,
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("auxiliar W-draft — sales.write allowed at UI level", () => {
    it("renders children for auxiliar + sales/write (service-layer canPost blocks POST, not UI)", () => {
      mockRole("auxiliar");

      render(
        <Gated resource="sales" action="write">
          <button>Crear borrador</button>
        </Gated>,
      );

      expect(
        screen.getByRole("button", { name: /crear borrador/i }),
      ).toBeInTheDocument();
    });
  });
});

describe("useCanAccess (REQ-U.2)", () => {
  describe("U.2-S1 — hook retorna bool segun matriz", () => {
    it("returns true for auxiliar + sales/write (W-draft)", () => {
      mockRole("auxiliar");

      const { result } = renderHook(() => useCanAccess("sales", "write"));

      expect(result.current).toBe(true);
    });

    it("returns false for cobrador + journal/write", () => {
      mockRole("cobrador");

      const { result } = renderHook(() => useCanAccess("journal", "write"));

      expect(result.current).toBe(false);
    });

    it("returns true for contador + reports/read", () => {
      mockRole("contador");

      const { result } = renderHook(() => useCanAccess("reports", "read"));

      expect(result.current).toBe(true);
    });

    it("returns false for contador + reports/write (reports.write = owner|admin only)", () => {
      mockRole("contador");

      const { result } = renderHook(() => useCanAccess("reports", "write"));

      expect(result.current).toBe(false);
    });
  });

  describe("U.2-S2 — hook durante loading", () => {
    it("returns false while isLoading=true", () => {
      mockRole("owner", true);

      const { result } = renderHook(() => useCanAccess("journal", "write"));

      expect(result.current).toBe(false);
    });

    it("returns false when role is null", () => {
      mockRole(null, false);

      const { result } = renderHook(() => useCanAccess("sales", "read"));

      expect(result.current).toBe(false);
    });
  });
});
