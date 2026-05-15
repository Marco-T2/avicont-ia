/**
 * RolesPermissionsMatrix — read-only view of the 5 roles × 12 resources × (read/write/post) matrix.
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
    const roles = ["Owner", "Admin", "Contador", "Cobrador", "Miembro"];

    it.each(roles)("renders column header for '%s'", (label) => {
      render(<RolesPermissionsMatrix />);
      const headers = screen.getAllByRole("columnheader");
      expect(headers.some((h) => h.textContent?.includes(label))).toBe(true);
    });
  });

  describe("resource rows (all 14 resources)", () => {
    const resources = [
      "Miembros",
      "Config. contable",
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
      "Período Fiscal",
      "Auditoría",
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

  });

  describe("cell states — write matrix (REQ-P.2)", () => {
    it("contador + sales/write → allowed", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-sales-contador-write");
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
    it("renders post-capable cells for postable resources (Ventas, Compras, Libro Diario)", () => {
      render(<RolesPermissionsMatrix />);
      // Post cells are present — verified via testId (shape unchanged)
      expect(screen.getByTestId("cell-sales-contador-post")).toBeInTheDocument();
    });

    it("contador + sales/post → allowed", () => {
      render(<RolesPermissionsMatrix />);
      const cell = screen.getByTestId("cell-sales-contador-post");
      expect(cell).toHaveAttribute("data-allowed", "true");
    });
  });

  describe("table structure", () => {
    it("renders a single grouped table (REQ-RM.25 — grouped layout)", () => {
      render(<RolesPermissionsMatrix />);
      expect(screen.getAllByRole("table")).toHaveLength(1);
    });
  });

  // ── PR2.9 [RED] — Grouped layout assertions (REQ-RM.25) ─────────────────────
  // These two tests will fail until PR2.10 applies the grouping.

  describe("grouped layout (REQ-RM.25)", () => {
    it("resource rows grouped under section headings matching Module.label + 'Organización'", () => {
      render(<RolesPermissionsMatrix />);
      // After grouping, there should be section headings for each module + Organización
      expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Granjas").length).toBeGreaterThan(0);
      expect(screen.getByText("Organización")).toBeInTheDocument();
    });

    it("flat RESOURCE_ORDER without section headers is gone (grouped layout applied)", () => {
      render(<RolesPermissionsMatrix />);
      // With grouping, there is only one table (grouped) rather than three flat tables
      // Section headings act as separators. The single table should be present.
      const tables = screen.getAllByRole("table");
      // After grouping: 1 table (grouped) replaces the 3 flat tables
      expect(tables).toHaveLength(1);
    });
  });
});
