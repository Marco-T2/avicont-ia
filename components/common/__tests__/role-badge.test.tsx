/**
 * RoleBadge — shows the current user's role in the active organization.
 *
 * Read-only UX affordance (no permission enforcement). Hidden while loading
 * and when role is null (not a member).
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: vi.fn(),
}));

import { useOrgRole } from "@/components/common/use-org-role";
import { RoleBadge } from "@/components/common/role-badge";

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

describe("<RoleBadge />", () => {
  describe("rendering per role", () => {
    const cases: Array<{ role: string; label: string }> = [
      { role: "owner", label: "Owner" },
      { role: "admin", label: "Admin" },
      { role: "contador", label: "Contador" },
      { role: "cobrador", label: "Cobrador" },
      { role: "auxiliar", label: "Auxiliar" },
      { role: "member", label: "Miembro" },
    ];

    it.each(cases)("renders '$label' for role '$role'", ({ role, label }) => {
      mockRole(role);
      render(<RoleBadge />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("renders nothing while isLoading=true", () => {
      mockRole("owner", true);
      const { container } = render(<RoleBadge />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("no role", () => {
    it("renders nothing when role is null", () => {
      mockRole(null);
      const { container } = render(<RoleBadge />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("accessibility", () => {
    it("exposes role label with data-testid='role-badge' for stable queries", () => {
      mockRole("contador");
      render(<RoleBadge />);
      expect(screen.getByTestId("role-badge")).toHaveTextContent("Contador");
    });
  });
});
