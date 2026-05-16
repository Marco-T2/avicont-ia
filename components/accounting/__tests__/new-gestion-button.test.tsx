/**
 * NewGestionButton — header CTA tests.
 *
 * Covers the behavior previously asserted inside annual-period-list-empty-
 * state.test.tsx for the always-visible "Nueva gestión" header button:
 *  - Renders the button.
 *  - Click opens PeriodCreateDialog (stubbed) with orgSlug propagated.
 *  - onCreated callback triggers router.refresh + closes dialog.
 */
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
}));

// Stub the dialog so we can assert open=true + orgSlug propagation + invoke
// onCreated externally to verify the refresh wire.
const { mockOnCreatedRef } = vi.hoisted(() => ({
  mockOnCreatedRef: { current: null as null | (() => void) },
}));

vi.mock("../period-create-dialog", () => ({
  default: ({
    open,
    orgSlug,
    onCreated,
  }: {
    open: boolean;
    orgSlug: string;
    onOpenChange: (o: boolean) => void;
    onCreated: () => void;
  }) => {
    mockOnCreatedRef.current = onCreated;
    return open ? (
      <div data-testid="period-create-dialog-stub" data-org-slug={orgSlug} />
    ) : null;
  },
}));

import NewGestionButton from "../new-gestion-button";

const ORG_SLUG = "acme";

describe("NewGestionButton", () => {
  it("renderiza el botón 'Nueva gestión' habilitado por default", () => {
    render(<NewGestionButton orgSlug={ORG_SLUG} />);

    const btn = screen.getByRole("button", { name: /nueva gestión/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("click en el botón abre PeriodCreateDialog con orgSlug propagado", () => {
    render(<NewGestionButton orgSlug={ORG_SLUG} />);

    expect(
      screen.queryByTestId("period-create-dialog-stub"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /nueva gestión/i }));

    const dialog = screen.getByTestId("period-create-dialog-stub");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-org-slug", ORG_SLUG);
  });

  it("onCreated cierra el dialog y dispara router.refresh", () => {
    render(<NewGestionButton orgSlug={ORG_SLUG} />);

    fireEvent.click(screen.getByRole("button", { name: /nueva gestión/i }));
    expect(screen.getByTestId("period-create-dialog-stub")).toBeInTheDocument();

    // Simulate the dialog firing onCreated (batch success or single create OK).
    // act() flushes the setOpen(false) state update synchronously so the
    // queryByTestId below sees the post-update DOM.
    act(() => {
      mockOnCreatedRef.current?.();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId("period-create-dialog-stub"),
    ).not.toBeInTheDocument();
  });
});
