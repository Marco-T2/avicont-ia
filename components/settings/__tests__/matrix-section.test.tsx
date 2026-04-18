/**
 * PR2.5 [RED] — Tests for MatrixSection
 * REQ-RM.1, REQ-RM.3, REQ-RM.5
 */
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Resource, PostableResource } from "@/features/shared/permissions";
import { MatrixSection } from "@/components/settings/matrix-section";

afterEach(cleanup);

describe("<MatrixSection />", () => {
  const noopToggle = vi.fn();

  afterEach(() => noopToggle.mockClear());

  const readSet = new Set<Resource>(["sales", "journal"]);
  const writeSet = new Set<Resource>(["sales"]);
  const postSet = new Set<PostableResource>(["sales"]);

  // (a) renders heading matching label
  it("(a) renders heading matching label", () => {
    render(
      <table>
        <tbody>
          <MatrixSection
            label="Contabilidad"
            resources={["sales", "journal"]}
            readSet={readSet}
            writeSet={writeSet}
            postSet={postSet}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Contabilidad")).toBeInTheDocument();
  });

  // (b) renders exactly resources.length rows
  it("(b) renders exactly resources.length rows", () => {
    const resources = ["sales", "journal", "purchases"] as const;
    render(
      <table>
        <tbody>
          <MatrixSection
            label="Contabilidad"
            resources={[...resources]}
            readSet={readSet}
            writeSet={writeSet}
            postSet={postSet}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    // Each row has a toggle-read-{resource} checkbox
    expect(screen.getByTestId("toggle-read-sales")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-read-journal")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-read-purchases")).toBeInTheDocument();
  });

  // (c) forwards disabled to all MatrixRow children
  it("(c) forwards disabled to all MatrixRow children", () => {
    render(
      <table>
        <tbody>
          <MatrixSection
            label="Granjas"
            resources={["farms"]}
            readSet={new Set<Resource>()}
            writeSet={new Set<Resource>()}
            postSet={new Set<PostableResource>()}
            disabled={true}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("toggle-read-farms")).toBeDisabled();
    expect(screen.getByTestId("toggle-write-farms")).toBeDisabled();
  });

  // (d) forwards onToggle to all rows
  it("(d) forwards onToggle to all rows", () => {
    render(
      <table>
        <tbody>
          <MatrixSection
            label="Contabilidad"
            resources={["sales"]}
            readSet={new Set<Resource>()}
            writeSet={new Set<Resource>()}
            postSet={new Set<PostableResource>()}
            disabled={false}
            onToggle={noopToggle}
          />
        </tbody>
      </table>,
    );
    fireEvent.click(screen.getByTestId("toggle-read-sales"));
    expect(noopToggle).toHaveBeenCalledWith("sales", "read", true);
  });
});
