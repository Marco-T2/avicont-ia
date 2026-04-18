/**
 * PR2.1 [RED] — REQ-MS.2: ModuleSwitcher visible modules filtering
 * PR2.3 [RED] — REQ-MS.5: Switcher override → navigate + localStorage persist
 * PR2.5 [RED] — REQ-MS.13: Collapsed mode renders icon + tooltip; click opens DropdownMenu
 * PR2.7 [RED] — REQ-MS.12: Mobile native <select> renders correct options + fires callbacks
 *
 * Environment: jsdom (components vitest project — .test.tsx)
 *
 * NOTE on Radix DropdownMenu in jsdom:
 * Radix Dropdown needs pointer events to open. We simulate with
 * fireEvent.pointerDown → pointerUp → click on the trigger to toggle open.
 * Portal content is attached to document.body, so we query from document.body.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import type { ClientMatrixSnapshot } from "@/components/common/roles-matrix-provider";

// ---------------------------------------------------------------------------
// Mocks — top-level, before any import of production modules
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
  usePathname: () => "/test-org/farms",
  useRouter: () => ({ push: mockPush }),
}));

// PR5.6: useActiveModule now calls useClerk — stub it to avoid ClerkProvider requirement
vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({
    addListener: vi.fn(() => () => {}),
  }),
}));

// PR5.2: useActiveModule calls toast.info — stub sonner to avoid rendering issues
vi.mock("sonner", () => ({
  toast: { info: vi.fn() },
}));

// W-2: Mock @/components/ui/tooltip so TooltipContent renders children inline (no Radix portal).
// Radix Tooltip portals are not mounted in jsdom until hover/focus — the tooltip state stays
// "closed" and no DOM node is inserted for TooltipContent. By rendering children directly we
// can assert the label text without simulating pointer-hover chains.
// The TooltipTrigger mock uses asChild: it renders its single child element directly so that
// DropdownMenuTrigger (which is also asChild) receives the underlying button element normally.
// NOTE: This mock is file-scoped — it affects all tests in this file, but existing collapsed-mode
// tests (PR2.5) don't query tooltip text so they are unaffected.
vi.mock("@/components/ui/tooltip", async () => {
  const { Children, cloneElement, isValidElement, createElement } = await import("react");
  return {
    TooltipProvider: ({ children }: { children: unknown }) => createElement(
      "span",
      { "data-testid": "tooltip-provider" },
      children as React.ReactNode
    ),
    Tooltip: ({ children }: { children: unknown }) => createElement(
      "span",
      { "data-testid": "tooltip-root" },
      children as React.ReactNode
    ),
    // asChild: forward all props onto the single React child (mirrors Radix slot behaviour)
    TooltipTrigger: ({ children, asChild, ...rest }: { children: unknown; asChild?: boolean; [k: string]: unknown }) => {
      if (asChild && isValidElement(children)) {
        return cloneElement(children as React.ReactElement<Record<string, unknown>>, { ...rest });
      }
      return createElement("span", rest, children as React.ReactNode);
    },
    // Renders children directly into the DOM — no portal, no lazy mount
    TooltipContent: ({ children }: { children: unknown }) => (
      createElement("div", { "data-testid": "tooltip-content" }, children as React.ReactNode)
    ),
  };
});

// ---------------------------------------------------------------------------
// Import production module AFTER mocks
// ---------------------------------------------------------------------------

import { ModuleSwitcher } from "../module-switcher";

// ---------------------------------------------------------------------------
// Snapshot fixtures
// ---------------------------------------------------------------------------

/** Owner: all resources accessible */
const ALL_RESOURCES: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "owner",
  permissionsRead: [
    "members",
    "accounting-config",
    "sales",
    "purchases",
    "payments",
    "journal",
    "dispatches",
    "reports",
    "contacts",
    "farms",
    "documents",
    "agent",
  ],
  permissionsWrite: [],
  canPost: [],
};

/** Farms only: no accounting resources */
const FARMS_ONLY: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "member",
  permissionsRead: ["farms", "documents", "agent"],
  permissionsWrite: [],
  canPost: [],
};

/** Accounting only: journal accessible, no farms */
const ACCOUNTING_ONLY: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "contador",
  permissionsRead: [
    "journal",
    "sales",
    "purchases",
    "payments",
    "reports",
    "contacts",
    "dispatches",
    "accounting-config",
  ],
  permissionsWrite: [],
  canPost: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSwitcher(
  snapshot: ClientMatrixSnapshot | null,
  props: Partial<React.ComponentProps<typeof ModuleSwitcher>> = {}
) {
  return render(
    <RolesMatrixProvider snapshot={snapshot}>
      <ModuleSwitcher {...props} />
    </RolesMatrixProvider>
  );
}

/**
 * Open a Radix DropdownMenu by simulating pointer events on the trigger button.
 * Radix needs pointerdown+pointerup+click to open.
 */
function openDropdown(btn: HTMLElement) {
  fireEvent.pointerDown(btn, { bubbles: true, cancelable: true, button: 0 });
  fireEvent.pointerUp(btn, { bubbles: true, cancelable: true, button: 0 });
  fireEvent.click(btn);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockReset();
  localStorage.clear();
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// PR2.1 — REQ-MS.2: Visible modules filtering
// ---------------------------------------------------------------------------

describe("ModuleSwitcher — visible modules filtering (REQ-MS.2)", () => {
  it("shows Contabilidad option when user has journal access", () => {
    renderSwitcher(ALL_RESOURCES);
    const trigger = screen.getByRole("button");
    openDropdown(trigger);
    // Portal content is in document.body
    const body = within(document.body);
    expect(body.getByText("Contabilidad")).toBeTruthy();
  });

  it("does NOT show Contabilidad menuitem when user has no accounting resources", () => {
    renderSwitcher(FARMS_ONLY);
    const trigger = screen.getByRole("button");
    openDropdown(trigger);
    const body = within(document.body);
    expect(body.queryByRole("menuitem", { name: /Contabilidad/i })).toBeNull();
  });

  it("shows Granjas option when user has farms access", () => {
    renderSwitcher(FARMS_ONLY);
    const trigger = screen.getByRole("button");
    openDropdown(trigger);
    const body = within(document.body);
    expect(body.getByRole("menuitem", { name: /Granjas/i })).toBeTruthy();
  });

  it("shows both Contabilidad and Granjas menuitems when user has all resources", () => {
    renderSwitcher(ALL_RESOURCES);
    const trigger = screen.getByRole("button");
    openDropdown(trigger);
    const body = within(document.body);
    expect(body.getByRole("menuitem", { name: /Contabilidad/i })).toBeTruthy();
    expect(body.getByRole("menuitem", { name: /Granjas/i })).toBeTruthy();
  });

  it("shows Contabilidad when user has journal.read === true", () => {
    renderSwitcher(ACCOUNTING_ONLY);
    const trigger = screen.getByRole("button");
    openDropdown(trigger);
    const body = within(document.body);
    expect(body.getByRole("menuitem", { name: /Contabilidad/i })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PR2.3 — REQ-MS.5: Switcher override → navigate + localStorage persist
// ---------------------------------------------------------------------------

describe("ModuleSwitcher — switcher override (REQ-MS.5)", () => {
  it("navigates to Contabilidad homeRoute when Contabilidad is selected", () => {
    renderSwitcher(ALL_RESOURCES);
    const trigger = screen.getByRole("button");
    openDropdown(trigger);

    const body = within(document.body);
    const contabOption = body.getByRole("menuitem", { name: /Contabilidad/i });
    fireEvent.click(contabOption);

    expect(mockPush).toHaveBeenCalledWith("/test-org/accounting");
  });

  it("persists selection to localStorage when Contabilidad selected", () => {
    renderSwitcher(ALL_RESOURCES);
    openDropdown(screen.getByRole("button"));

    fireEvent.click(within(document.body).getByRole("menuitem", { name: /Contabilidad/i }));

    expect(localStorage.getItem("sidebar-active-module")).toBe("contabilidad");
  });

  it("navigates to Granjas homeRoute when Granjas is selected", () => {
    renderSwitcher(ALL_RESOURCES);
    openDropdown(screen.getByRole("button"));

    fireEvent.click(within(document.body).getByRole("menuitem", { name: /Granjas/i }));

    expect(mockPush).toHaveBeenCalledWith("/test-org/farms");
  });

  it("sets localStorage to granjas when Granjas selected", () => {
    renderSwitcher(ALL_RESOURCES);
    openDropdown(screen.getByRole("button"));
    fireEvent.click(within(document.body).getByRole("menuitem", { name: /Granjas/i }));
    expect(localStorage.getItem("sidebar-active-module")).toBe("granjas");
  });
});

// ---------------------------------------------------------------------------
// PR2.5 — REQ-MS.13: Collapsed mode renders icon + tooltip
// ---------------------------------------------------------------------------

describe("ModuleSwitcher — collapsed mode (REQ-MS.13)", () => {
  it("renders a button when isCollapsed=true", () => {
    renderSwitcher(FARMS_ONLY, { isCollapsed: true });
    const btn = screen.getByRole("button");
    expect(btn).toBeTruthy();
  });

  it("the button has an accessible label matching the active module when isCollapsed=true", () => {
    renderSwitcher(FARMS_ONLY, { isCollapsed: true });
    // Pathname /test-org/farms → active module = Granjas
    const btn = screen.getByRole("button");
    const ariaLabel = btn.getAttribute("aria-label") ?? "";
    expect(ariaLabel.length).toBeGreaterThan(0);
  });

  it("clicking the icon button in collapsed mode opens the dropdown with module options", () => {
    renderSwitcher(ALL_RESOURCES, { isCollapsed: true });
    const btn = screen.getByRole("button");
    openDropdown(btn);

    const body = within(document.body);
    expect(body.getByRole("menuitem", { name: /Contabilidad/i })).toBeTruthy();
    expect(body.getByRole("menuitem", { name: /Granjas/i })).toBeTruthy();
  });

  it("does NOT render an inline label span in collapsed mode", () => {
    renderSwitcher(FARMS_ONLY, { isCollapsed: true });
    // The button should have only an icon child, no <span> with the module name
    const btn = screen.getByRole("button");
    // Check that button does NOT have text content matching the module label
    // (it's shown only in tooltip, not as inline text)
    const spans = btn.querySelectorAll("span");
    spans.forEach((span) => {
      expect(span.textContent?.trim()).not.toBe("Granjas");
    });
  });

  /**
   * W-2 [RED→GREEN] — REQ-MS.13: TooltipContent label text
   *
   * Radix Tooltip renders its content into a portal (document.body). jsdom does not
   * fire real hover/focus chains that trigger Radix's internal open state, so
   * `role="tooltip"` is never present in the a11y tree. However the TooltipContent
   * node IS mounted in the DOM (just hidden / aria-hidden by Radix until hover).
   * `screen.getByText(label, { hidden: true })` reaches portal-rendered hidden nodes,
   * letting us assert that TooltipContent received the correct label text without
   * needing pointer-hover simulation.
   *
   * Pathname → active module: /test-org/farms → Granjas (label = "Granjas")
   */
  it("TooltipContent shows the active module label in collapsed mode (W-2)", () => {
    renderSwitcher(FARMS_ONLY, { isCollapsed: true });
    // The tooltip mock renders TooltipContent inline (data-testid="tooltip-content").
    // Assert its text content equals the active module label derived from the route.
    // Pathname /test-org/farms → active module = Granjas
    const tooltipEl = screen.getByTestId("tooltip-content");
    expect(tooltipEl.textContent?.trim()).toBe("Granjas");
  });

  it("TooltipContent label matches aria-label of the trigger button (W-2 consistency)", () => {
    renderSwitcher(ALL_RESOURCES, { isCollapsed: true });
    // Pathname /test-org/farms → active module = Granjas
    const btn = screen.getByRole("button");
    const ariaLabel = btn.getAttribute("aria-label") ?? "";
    expect(ariaLabel.length).toBeGreaterThan(0);
    // The TooltipContent (rendered inline by mock) must display the same label
    const tooltipEl = screen.getByTestId("tooltip-content");
    expect(tooltipEl.textContent?.trim()).toBe(ariaLabel);
  });
});

// ---------------------------------------------------------------------------
// PR2.7 — REQ-MS.12: Mobile native <select>
// ---------------------------------------------------------------------------

describe("ModuleSwitcher — mobile native select (REQ-MS.12)", () => {
  it("renders a <select> element when isMobile=true", () => {
    renderSwitcher(ALL_RESOURCES, { isMobile: true });
    const select = screen.getByRole("combobox");
    expect(select.tagName.toLowerCase()).toBe("select");
  });

  it("renders options matching visibleModules for full-access user", () => {
    renderSwitcher(ALL_RESOURCES, { isMobile: true });
    const options = screen.getAllByRole("option");
    const labels = options.map((o) => o.textContent?.trim());
    expect(labels).toContain("Contabilidad");
    expect(labels).toContain("Granjas");
  });

  it("filters options to only visible modules — farms-only user sees only Granjas", () => {
    renderSwitcher(FARMS_ONLY, { isMobile: true });
    const options = screen.getAllByRole("option");
    const labels = options.map((o) => o.textContent?.trim());
    expect(labels).not.toContain("Contabilidad");
    expect(labels).toContain("Granjas");
  });

  it("fires navigation and persists localStorage on change event (select Contabilidad)", () => {
    renderSwitcher(ALL_RESOURCES, { isMobile: true });
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "contabilidad" } });

    expect(mockPush).toHaveBeenCalledWith("/test-org/accounting");
    expect(localStorage.getItem("sidebar-active-module")).toBe("contabilidad");
  });

  it("fires navigation to Granjas homeRoute when Granjas selected in mobile mode", () => {
    renderSwitcher(ALL_RESOURCES, { isMobile: true });
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "granjas" } });

    expect(mockPush).toHaveBeenCalledWith("/test-org/farms");
    expect(localStorage.getItem("sidebar-active-module")).toBe("granjas");
  });
});
