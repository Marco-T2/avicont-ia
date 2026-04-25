/**
 * ThemeToggle — RED tests for the sidebar theme switch.
 *
 * Behaviour under test:
 *   - When theme is light, renders Moon icon + "tema oscuro" label.
 *   - When theme is dark, renders Sun icon + "tema claro" label.
 *   - Clicking the button toggles between light and dark via next-themes.
 *   - In collapsed sidebar mode, the visible label is hidden but the
 *     accessible name (aria-label) is preserved.
 *
 * next-themes is mocked at module level — the test owns the theme state.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Mocks — top-level so they're hoisted before component import
// ---------------------------------------------------------------------------

const themeState = {
  theme: "light" as "light" | "dark",
  setTheme: vi.fn((next: "light" | "dark") => {
    themeState.theme = next;
  }),
};

vi.mock("next-themes", () => ({
  useTheme: () => themeState,
}));

const sidebarState = { isCollapsed: false };

vi.mock("@/components/sidebar/sidebar-provider", () => ({
  useSidebar: () => ({
    isCollapsed: sidebarState.isCollapsed,
    isMobileOpen: false,
    toggleSidebar: vi.fn(),
    toggleMobile: vi.fn(),
  }),
}));

import { ThemeToggle } from "../theme-toggle";

afterEach(() => {
  cleanup();
  themeState.theme = "light";
  themeState.setTheme.mockClear();
  sidebarState.isCollapsed = false;
});

function renderToggle() {
  return render(
    <TooltipProvider>
      <ThemeToggle />
    </TooltipProvider>
  );
}

describe("ThemeToggle — visual state per active theme", () => {
  it("when theme=light shows the moon icon and 'tema oscuro' aria-label", () => {
    themeState.theme = "light";
    renderToggle();
    const button = screen.getByRole("button", { name: /tema oscuro/i });
    expect(button).toBeTruthy();
  });

  it("when theme=dark shows 'tema claro' aria-label", () => {
    themeState.theme = "dark";
    renderToggle();
    expect(screen.getByRole("button", { name: /tema claro/i })).toBeTruthy();
  });
});

describe("ThemeToggle — click cycles between light and dark", () => {
  it("clicking from light calls setTheme('dark')", () => {
    themeState.theme = "light";
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: /tema oscuro/i }));
    expect(themeState.setTheme).toHaveBeenCalledWith("dark");
  });

  it("clicking from dark calls setTheme('light')", () => {
    themeState.theme = "dark";
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: /tema claro/i }));
    expect(themeState.setTheme).toHaveBeenCalledWith("light");
  });
});

describe("ThemeToggle — collapsed sidebar mode", () => {
  it("hides the visible label but keeps the accessible name (aria-label)", () => {
    themeState.theme = "light";
    sidebarState.isCollapsed = true;
    renderToggle();
    // The button is still findable by accessible name (aria-label)
    const button = screen.getByRole("button", { name: /tema oscuro/i });
    expect(button).toBeTruthy();
    // The visible text label should NOT be in the DOM
    expect(screen.queryByText(/^Tema oscuro$/)).toBeNull();
  });
});
