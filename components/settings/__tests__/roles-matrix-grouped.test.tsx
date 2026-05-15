/**
 * PR2.7 [RED→GREEN] — Tests for RolesMatrixGrouped
 * REQ-RM.1, REQ-RM.2, REQ-RM.4, REQ-RM.7, REQ-RM.21, REQ-RM.22
 */
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Resource, PostableResource } from "@/features/permissions";
import { RolesMatrixGrouped } from "@/components/settings/roles-matrix-grouped";

afterEach(cleanup);

describe("<RolesMatrixGrouped />", () => {
  const noopToggle = vi.fn();

  afterEach(() => noopToggle.mockClear());

  const emptyRead = new Set<Resource>();
  const emptyWrite = new Set<Resource>();
  const emptyPost = new Set<PostableResource>();

  // (a0) period + audit rows render — they live in Organización section since
  // they aren't claimed by any module. Pre-existing bug: RESOURCE_ORDER omitted
  // them, so admin couldn't grant period/audit to custom roles via the UI.
  it("(a0) renders period + audit rows", () => {
    render(
      <RolesMatrixGrouped
        readSet={emptyRead}
        writeSet={emptyWrite}
        postSet={emptyPost}
        disabled={false}
        onToggle={noopToggle}
      />,
    );
    expect(screen.getByTestId("toggle-read-period")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-write-period")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-read-audit")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-write-audit")).toBeInTheDocument();
  });

  // (a) renders one section heading per MODULES[] entry + "Organización"
  it("(a) renders one section heading per MODULES[] entry + 'Organización'", () => {
    render(
      <RolesMatrixGrouped
        readSet={emptyRead}
        writeSet={emptyWrite}
        postSet={emptyPost}
        disabled={false}
        onToggle={noopToggle}
      />,
    );
    // MODULES[] currently has contabilidad + granjas
    // Section headings are in <td> with uppercase class — at least one match each
    expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Granjas").length).toBeGreaterThan(0);
    expect(screen.getByText("Organización")).toBeInTheDocument();
  });

  // (b) sections in MODULES[] order, Organización last
  it("(b) sections in MODULES[] order, Organización last", () => {
    render(
      <RolesMatrixGrouped
        readSet={emptyRead}
        writeSet={emptyWrite}
        postSet={emptyPost}
        disabled={false}
        onToggle={noopToggle}
      />,
    );
    const headings = screen.getAllByText(/Contabilidad|Granjas|Organización/);
    const labels = headings.map((h) => h.textContent?.trim());
    const contabilidadIdx = labels.indexOf("Contabilidad");
    const granjasIdx = labels.indexOf("Granjas");
    const orgIdx = labels.indexOf("Organización");
    expect(contabilidadIdx).toBeLessThan(granjasIdx);
    expect(granjasIdx).toBeLessThan(orgIdx);
  });

  // (c) old "Contabilizar" heading absent from DOM
  it("(c) old 'Contabilizar' heading absent from DOM", () => {
    render(
      <RolesMatrixGrouped
        readSet={emptyRead}
        writeSet={emptyWrite}
        postSet={emptyPost}
        disabled={false}
        onToggle={noopToggle}
      />,
    );
    expect(screen.queryByText(/contabilizar/i)).not.toBeInTheDocument();
  });

  // (d) disabled=true disables all inputs
  it("(d) disabled=true disables all inputs", () => {
    const allResources = new Set<Resource>([
      "sales", "journal", "purchases", "payments", "dispatches",
      "reports", "contacts", "accounting-config", "farms",
      "members", "documents", "agent",
    ]);
    render(
      <RolesMatrixGrouped
        readSet={allResources}
        writeSet={allResources}
        postSet={new Set<PostableResource>(["sales", "journal", "purchases"])}
        disabled={true}
        onToggle={noopToggle}
      />,
    );
    // Check a sampling of inputs — all must be disabled
    const inputs = document.querySelectorAll("input[type='checkbox']");
    expect(inputs.length).toBeGreaterThan(0);
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  // (e) onToggle fires with correct (resource, column, next) tuple
  it("(e) onToggle fires with correct (resource, column, next) tuple", () => {
    render(
      <RolesMatrixGrouped
        readSet={emptyRead}
        writeSet={emptyWrite}
        postSet={emptyPost}
        disabled={false}
        onToggle={noopToggle}
      />,
    );
    fireEvent.click(screen.getByTestId("toggle-read-sales"));
    expect(noopToggle).toHaveBeenCalledWith("sales", "read", true);
  });

  // (f) postSet state correctly reflected in Registrar checkboxes
  it("(f) postSet state correctly reflected in Registrar checkboxes", () => {
    render(
      <RolesMatrixGrouped
        readSet={emptyRead}
        writeSet={emptyWrite}
        postSet={new Set<PostableResource>(["sales"])}
        disabled={false}
        onToggle={noopToggle}
      />,
    );
    expect(screen.getByTestId("toggle-canpost-sales")).toBeChecked();
    expect(screen.getByTestId("toggle-canpost-journal")).not.toBeChecked();
  });
});
