/**
 * RolesPermissionsMatrix — read-only view of the 6 roles × 12 resources × (read/write/post) matrix.
 *
 * Pure presentational: derives data from features/shared/permissions.ts at render time.
 * No props, no side effects — snapshot of the canonical authorization matrix.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { RolesPermissionsMatrix } from "@/components/settings/roles-permissions-matrix";

afterEach(cleanup);

describe("<RolesPermissionsMatrix />", () => {
  describe("role columns", () => {
    const roles = ["Owner", "Admin", "Contador", "Cobrador", "Auxiliar", "Miembro"];

    it.each(roles)("renders column header for '%s'", (label) => {
      render(<RolesPermissionsMatrix />);
      const headers = screen.getAllByRole("columnheader");
      expect(headers.some((h) => h.textContent?.includes(label))).toBe(true);
    });
  });

  describe("resource rows (all 12 resources)", () => {
    const resources = [
      "Miembros",
      "Configuración contable",
      "Ventas",
      "Compras",
      "Cobros y Pagos",
      "Libro Diario",
      "Despachos",
      "Informes",
      "Contactos",
      "Granjas",
      "Documentos",
      "Agente IA",
    ];

    it.each(resources)("renders row for '%s'", (label) => {
      render(<RolesPermissionsMatrix />);
      const matches = screen.getAllByText(label);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe("cell states — read matrix (REQ-P.1)", () => {
    it("owner + members/read → allowed", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-members-owner-read");
      expect(cell).toHaveAttribute("data-allowed", "true");
    });

    it("cobrador + journal/read → denied", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-journal-cobrador-read");
      expect(cell).toHaveAttribute("data-allowed", "false");
    });

    it("auxiliar + dispatches/read → allowed", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-dispatches-auxiliar-read");
      expect(cell).toHaveAttribute("data-allowed", "true");
    });
  });

  describe("cell states — write matrix (REQ-P.2)", () => {
    it("contador + sales/write → allowed", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-sales-contador-write");
      expect(cell).toHaveAttribute("data-allowed", "true");
    });

    it("auxiliar + sales/write → allowed (W-draft)", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-sales-auxiliar-write");
      expect(cell).toHaveAttribute("data-allowed", "true");
    });

    it("cobrador + purchases/write → denied", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-purchases-cobrador-write");
      expect(cell).toHaveAttribute("data-allowed", "false");
    });

    it("member + members/write → denied", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-members-member-write");
      expect(cell).toHaveAttribute("data-allowed", "false");
    });
  });

  describe("post column (REQ-P.3)", () => {
    it("renders a 'Contabilizar' section separate from read/write", () => {
      render(<RolesPermissionsMatrix />);
      expect(screen.getByText(/contabilizar/i)).toBeInTheDocument();
    });

    it("auxiliar + sales/post → denied (W-draft excludes post)", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-sales-auxiliar-post");
      expect(cell).toHaveAttribute("data-allowed", "false");
    });

    it("contador + sales/post → allowed", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-sales-contador-post");
      expect(cell).toHaveAttribute("data-allowed", "true");
    });
  });

  describe("table structure", () => {
    it("renders three tables: read, write, post", () => {
      render(<RolesPermissionsMatrix />);
      expect(screen.getAllByRole("table")).toHaveLength(3);
    });
  });
});
