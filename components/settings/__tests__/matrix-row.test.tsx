/**
 * PR2.3 [RED→GREEN] — Tests for MatrixRow
 * REQ-RM.5, REQ-RM.6, REQ-RM.7, REQ-RM.8
 */
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatrixRow } from "@/components/settings/matrix-row";

afterEach(cleanup);

describe("<MatrixRow />", () => {
  const noopToggle = vi.fn();

  afterEach(() => noopToggle.mockClear());

  // (a) postable resource renders 3 interactive inputs
  it("(a) sales row renders 3 interactive inputs (Ver/Editar/Registrar)", () => {
    render(
      <table>
        <tbody>
          <MatrixRow
            resource="sales"
            label="Ventas"
            canRead={false}
            canWrite={false}
            canPost={false}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("toggle-read-sales")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-write-sales")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-canpost-sales")).toBeInTheDocument();
  });

  // (b) non-postable resource renders 2 interactive inputs + no canpost testid
  it("(b) farms row renders 2 interactive inputs + empty 3rd cell, no toggle-canpost-farms", () => {
    render(
      <table>
        <tbody>
          <MatrixRow
            resource="farms"
            label="Granjas"
            canRead={false}
            canWrite={false}
            canPost={false}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("toggle-read-farms")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-write-farms")).toBeInTheDocument();
    expect(screen.queryByTestId("toggle-canpost-farms")).not.toBeInTheDocument();
  });

  // (c) clicking Ver calls onToggle(resource, "read", next)
  it("(c) clicking Ver calls onToggle(resource, 'read', next)", () => {
    render(
      <table>
        <tbody>
          <MatrixRow
            resource="sales"
            label="Ventas"
            canRead={false}
            canWrite={false}
            canPost={false}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    fireEvent.click(screen.getByTestId("toggle-read-sales"));
    expect(noopToggle).toHaveBeenCalledWith("sales", "read", true);
  });

  // (d) clicking Editar calls onToggle(resource, "write", next)
  it("(d) clicking Editar calls onToggle(resource, 'write', next)", () => {
    render(
      <table>
        <tbody>
          <MatrixRow
            resource="sales"
            label="Ventas"
            canRead={false}
            canWrite={true}
            canPost={false}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    fireEvent.click(screen.getByTestId("toggle-write-sales"));
    expect(noopToggle).toHaveBeenCalledWith("sales", "write", false);
  });

  // (e) clicking Registrar on postable calls onToggle(resource, "post", next)
  it("(e) clicking Registrar (postable) calls onToggle(resource, 'post', next)", () => {
    render(
      <table>
        <tbody>
          <MatrixRow
            resource="journal"
            label="Libro Diario"
            canRead={false}
            canWrite={false}
            canPost={false}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    fireEvent.click(screen.getByTestId("toggle-canpost-journal"));
    expect(noopToggle).toHaveBeenCalledWith("journal", "post", true);
  });

  // (f) disabled=true disables all inputs
  it("(f) disabled=true disables all inputs", () => {
    render(
      <table>
        <tbody>
          <MatrixRow
            resource="sales"
            label="Ventas"
            canRead={true}
            canWrite={true}
            canPost={true}
            disabled={true}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("toggle-read-sales")).toBeDisabled();
    expect(screen.getByTestId("toggle-write-sales")).toBeDisabled();
    expect(screen.getByTestId("toggle-canpost-sales")).toBeDisabled();
  });

  // (g) data-testid attributes match expected pattern
  it("(g) data-testid attributes match toggle-read-{r}, toggle-write-{r}, toggle-canpost-{r} for postables", () => {
    render(
      <table>
        <tbody>
          <MatrixRow
            resource="purchases"
            label="Compras"
            canRead={true}
            canWrite={false}
            canPost={false}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("toggle-read-purchases")).toBeChecked();
    expect(screen.getByTestId("toggle-write-purchases")).not.toBeChecked();
    expect(screen.getByTestId("toggle-canpost-purchases")).toBeInTheDocument();
  });
});
