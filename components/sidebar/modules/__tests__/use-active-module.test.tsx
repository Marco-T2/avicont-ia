/**
 * PR1.3 [RED] — REQ-MS.3 + REQ-MS.4: ROUTE_MODULE_MAP segment resolution tests.
 * PR1.5 [RED] — REQ-MS.6: getRoleDefaultModule() tests.
 * PR1.7 [RED] — REQ-MS.3, REQ-MS.4, REQ-MS.6, REQ-MS.11: useActiveModule() hook state machine.
 * PR1.9 [RED] — REQ-MS.10: localStorage invalidation on permission revoke + persistence.
 *
 * Uses jsdom environment (components project) — needed for React hooks + localStorage.
 * NOTE: tasks artifact specified .test.ts extension, but the vitest config routes
 * .test.tsx to the jsdom "components" project, which is required for React hook testing.
 * Deviation documented in apply-progress.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import type { ClientMatrixSnapshot } from "@/components/common/roles-matrix-provider";

// ---------------------------------------------------------------------------
// next/navigation mock — must be defined before importing the hook
// ---------------------------------------------------------------------------

let mockPathname = "/test-org/accounting/journal";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useParams: () => ({ orgSlug: "test-org" }),
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import AFTER mock setup
// ---------------------------------------------------------------------------

import {
  useActiveModule,
  ROUTE_MODULE_MAP,
  getRoleDefaultModule,
} from "../use-active-module";

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

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

const FARMS_ONLY: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "member",
  permissionsRead: ["farms", "documents", "agent"],
  permissionsWrite: [],
  canPost: [],
};

const ACCOUNTING_ONLY: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "contador",
  permissionsRead: [
    "accounting-config",
    "sales",
    "purchases",
    "payments",
    "journal",
    "dispatches",
    "reports",
    "contacts",
  ],
  permissionsWrite: [],
  canPost: [],
};

const NO_RESOURCES: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "custom-no-access",
  permissionsRead: [],
  permissionsWrite: [],
  canPost: [],
};

function wrapper(snapshot: ClientMatrixSnapshot | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RolesMatrixProvider snapshot={snapshot}>{children}</RolesMatrixProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// PR1.3 — ROUTE_MODULE_MAP segment resolution (REQ-MS.3, REQ-MS.4)
// ---------------------------------------------------------------------------

describe("PR1.3 — REQ-MS.3: ROUTE_MODULE_MAP segment resolution", () => {
  it("maps 'accounting' → 'contabilidad'", () => {
    expect(ROUTE_MODULE_MAP["accounting"]).toBe("contabilidad");
  });

  it("maps 'dispatches' → 'contabilidad'", () => {
    expect(ROUTE_MODULE_MAP["dispatches"]).toBe("contabilidad");
  });

  it("maps 'purchases' → 'contabilidad'", () => {
    expect(ROUTE_MODULE_MAP["purchases"]).toBe("contabilidad");
  });

  it("maps 'sales' → 'contabilidad'", () => {
    expect(ROUTE_MODULE_MAP["sales"]).toBe("contabilidad");
  });

  it("maps 'payments' → 'contabilidad'", () => {
    expect(ROUTE_MODULE_MAP["payments"]).toBe("contabilidad");
  });

  it("maps 'informes' → 'contabilidad'", () => {
    expect(ROUTE_MODULE_MAP["informes"]).toBe("contabilidad");
  });

  it("maps 'settings' → 'contabilidad'", () => {
    expect(ROUTE_MODULE_MAP["settings"]).toBe("contabilidad");
  });

  it("maps 'farms' → 'granjas'", () => {
    expect(ROUTE_MODULE_MAP["farms"]).toBe("granjas");
  });

  it("maps 'lots' → 'granjas'", () => {
    expect(ROUTE_MODULE_MAP["lots"]).toBe("granjas");
  });

  it("does NOT map 'members' (cross-module)", () => {
    expect(ROUTE_MODULE_MAP["members"]).toBeUndefined();
  });

  it("does NOT map 'documents' (cross-module)", () => {
    expect(ROUTE_MODULE_MAP["documents"]).toBeUndefined();
  });

  it("does NOT map 'home' (cross-module)", () => {
    expect(ROUTE_MODULE_MAP["home"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PR1.5 — getRoleDefaultModule() (REQ-MS.6)
// ---------------------------------------------------------------------------

describe("PR1.5 — REQ-MS.6: getRoleDefaultModule()", () => {
  it("returns 'contabilidad' when matrix has sales access", () => {
    const matrixWithSales = {
      orgId: "org-1",
      role: "owner",
      canAccess: (resource: string, action: string) =>
        action === "read" && ["sales", "journal"].includes(resource),
      canPost: () => false,
    };
    expect(getRoleDefaultModule(matrixWithSales as any)).toBe("contabilidad");
  });

  it("returns 'contabilidad' when matrix has journal access", () => {
    const matrixWithJournal = {
      orgId: "org-1",
      role: "contador",
      canAccess: (resource: string, action: string) =>
        action === "read" && resource === "journal",
      canPost: () => false,
    };
    expect(getRoleDefaultModule(matrixWithJournal as any)).toBe("contabilidad");
  });

  it("returns 'contabilidad' when matrix has purchases access", () => {
    const m = {
      orgId: "o",
      role: "r",
      canAccess: (r: string, a: string) => a === "read" && r === "purchases",
      canPost: () => false,
    };
    expect(getRoleDefaultModule(m as any)).toBe("contabilidad");
  });

  it("returns 'contabilidad' when matrix has payments access", () => {
    const m = {
      orgId: "o",
      role: "r",
      canAccess: (r: string, a: string) => a === "read" && r === "payments",
      canPost: () => false,
    };
    expect(getRoleDefaultModule(m as any)).toBe("contabilidad");
  });

  it("returns 'contabilidad' when matrix has dispatches access", () => {
    const m = {
      orgId: "o",
      role: "r",
      canAccess: (r: string, a: string) => a === "read" && r === "dispatches",
      canPost: () => false,
    };
    expect(getRoleDefaultModule(m as any)).toBe("contabilidad");
  });

  it("returns 'contabilidad' when matrix has reports access", () => {
    const m = {
      orgId: "o",
      role: "r",
      canAccess: (r: string, a: string) => a === "read" && r === "reports",
      canPost: () => false,
    };
    expect(getRoleDefaultModule(m as any)).toBe("contabilidad");
  });

  it("returns 'contabilidad' when matrix has contacts access", () => {
    const m = {
      orgId: "o",
      role: "r",
      canAccess: (r: string, a: string) => a === "read" && r === "contacts",
      canPost: () => false,
    };
    expect(getRoleDefaultModule(m as any)).toBe("contabilidad");
  });

  it("returns 'contabilidad' when matrix has accounting-config access", () => {
    const m = {
      orgId: "o",
      role: "r",
      canAccess: (r: string, a: string) =>
        a === "read" && r === "accounting-config",
      canPost: () => false,
    };
    expect(getRoleDefaultModule(m as any)).toBe("contabilidad");
  });

  it("returns 'granjas' when matrix has only farms access (member role)", () => {
    const memberMatrix = {
      orgId: "org-1",
      role: "member",
      canAccess: (resource: string, action: string) =>
        action === "read" && resource === "farms",
      canPost: () => false,
    };
    expect(getRoleDefaultModule(memberMatrix as any)).toBe("granjas");
  });

  it("returns 'granjas' for auxiliar-without-accounting", () => {
    const m = {
      orgId: "o",
      role: "auxiliar",
      canAccess: (r: string, a: string) =>
        a === "read" && ["farms", "documents", "agent", "dispatches"].includes(r),
      canPost: () => false,
    };
    // auxiliar with dispatches DOES have accounting access → contabilidad
    // but auxiliar without dispatches/journal etc → granjas
    const mNoAccounting = {
      orgId: "o",
      role: "auxiliar",
      canAccess: (r: string, a: string) =>
        a === "read" && ["farms", "documents", "agent"].includes(r),
      canPost: () => false,
    };
    expect(getRoleDefaultModule(mNoAccounting as any)).toBe("granjas");
  });

  it("returns null when matrix is null", () => {
    expect(getRoleDefaultModule(null)).toBeNull();
  });

  it("returns null when matrix has no accessible modules", () => {
    const emptyMatrix = {
      orgId: "org-1",
      role: "custom",
      canAccess: () => false,
      canPost: () => false,
    };
    expect(getRoleDefaultModule(emptyMatrix as any)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PR1.7 — useActiveModule() hook state machine (REQ-MS.3, REQ-MS.4, REQ-MS.6, REQ-MS.11)
// ---------------------------------------------------------------------------

describe("PR1.7 — REQ-MS.3: useActiveModule() — route match overrides localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/test-org/accounting/journal";
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("returns contabilidad for /accounting/* route", () => {
    mockPathname = "/test-org/accounting/journal";
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    expect(result.current.activeModule?.id).toBe("contabilidad");
  });

  it("route match overrides localStorage value", () => {
    mockPathname = "/test-org/farms";
    localStorage.setItem("sidebar-active-module", "contabilidad");
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    expect(result.current.activeModule?.id).toBe("granjas");
  });

  it("returns granjas for /farms/* route", () => {
    mockPathname = "/test-org/farms";
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    expect(result.current.activeModule?.id).toBe("granjas");
  });

  it("returns granjas for /lots/* route", () => {
    mockPathname = "/test-org/lots/123";
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    expect(result.current.activeModule?.id).toBe("granjas");
  });

  it("isCrossModuleRoute is false for a module route", () => {
    mockPathname = "/test-org/accounting/journal";
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    expect(result.current.isCrossModuleRoute).toBe(false);
  });
});

describe("PR1.7 — REQ-MS.4: useActiveModule() — cross-module route reads localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("cross-module /members uses localStorage value 'granjas'", async () => {
    mockPathname = "/test-org/members";
    localStorage.setItem("sidebar-active-module", "granjas");
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    // After useEffect resolves
    await act(async () => {});
    expect(result.current.activeModule?.id).toBe("granjas");
  });

  it("cross-module /documents uses localStorage value 'contabilidad'", async () => {
    mockPathname = "/test-org/documents";
    localStorage.setItem("sidebar-active-module", "contabilidad");
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    await act(async () => {});
    expect(result.current.activeModule?.id).toBe("contabilidad");
  });

  it("isCrossModuleRoute is true for /members", () => {
    mockPathname = "/test-org/members";
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    expect(result.current.isCrossModuleRoute).toBe(true);
  });
});

describe("PR1.7 — REQ-MS.6: useActiveModule() — role-based fallback", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/test-org/members";
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("no localStorage + accounting access → defaults to contabilidad", async () => {
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ACCOUNTING_ONLY),
    });
    await act(async () => {});
    expect(result.current.activeModule?.id).toBe("contabilidad");
  });

  it("no localStorage + farms-only access → defaults to granjas", async () => {
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(FARMS_ONLY),
    });
    await act(async () => {});
    expect(result.current.activeModule?.id).toBe("granjas");
  });

  it("no localStorage + null matrix → activeModule is null", async () => {
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(null),
    });
    await act(async () => {});
    expect(result.current.activeModule).toBeNull();
  });
});

describe("PR1.7 — REQ-MS.11: SSR safety — no localStorage access on initial render", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("initial activeModule is derived from route without localStorage on module route", () => {
    mockPathname = "/test-org/accounting/journal";
    // localStorage has a different value — initial render MUST use route
    localStorage.setItem("sidebar-active-module", "granjas");
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    // Synchronous initial render must be route-based (contabilidad), not localStorage (granjas)
    expect(result.current.activeModule?.id).toBe("contabilidad");
  });
});

// ---------------------------------------------------------------------------
// PR1.9 — localStorage invalidation on permission revoke (REQ-MS.10)
// ---------------------------------------------------------------------------

describe("PR1.9 — REQ-MS.10: localStorage invalidation when module inaccessible", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/test-org/members";
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("falls back to granjas when localStorage='contabilidad' but no accounting access", async () => {
    localStorage.setItem("sidebar-active-module", "contabilidad");
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(FARMS_ONLY),
    });
    await act(async () => {});
    expect(result.current.activeModule?.id).toBe("granjas");
  });

  it("uses contabilidad when localStorage='contabilidad' and accounting is accessible", async () => {
    localStorage.setItem("sidebar-active-module", "contabilidad");
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ACCOUNTING_ONLY),
    });
    await act(async () => {});
    expect(result.current.activeModule?.id).toBe("contabilidad");
  });

  it("persists value across re-renders (mock reload)", async () => {
    localStorage.setItem("sidebar-active-module", "granjas");
    const { result, rerender } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    await act(async () => {});
    expect(result.current.activeModule?.id).toBe("granjas");

    // Simulate re-render (reload equivalent in tests)
    rerender();
    await act(async () => {});
    expect(result.current.activeModule?.id).toBe("granjas");
  });

  it("updates localStorage when module changes via setActiveModule", async () => {
    const { result } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    await act(async () => {
      result.current.setActiveModule("granjas");
    });
    expect(localStorage.getItem("sidebar-active-module")).toBe("granjas");
  });
});

// ---------------------------------------------------------------------------
// PR5.1 — REQ-MS.14: onboarding toast (RED)
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("PR5.1 — REQ-MS.14: onboarding toast fires once", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/test-org/members";
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("calls toast.info exactly once when both keys absent", async () => {
    // No sidebar-active-module, no sidebar-onboarding-seen → toast must fire
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it("does NOT call toast.info when sidebar-onboarding-seen is 'true'", async () => {
    localStorage.setItem("sidebar-onboarding-seen", "true");
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("sets sidebar-onboarding-seen after showing toast", async () => {
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});
    expect(localStorage.getItem("sidebar-onboarding-seen")).toBe("true");
  });

  it("does NOT fire again on re-render once seen key is set", async () => {
    const { rerender } = renderHook(() => useActiveModule(), {
      wrapper: wrapper(ALL_RESOURCES),
    });
    await act(async () => {});
    vi.clearAllMocks();
    rerender();
    await act(async () => {});
    expect(toast.info).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PR5.3 — REQ-MS.15: dev-mode console.warn for unmapped segments (RED)
// ---------------------------------------------------------------------------

describe("PR5.3 — REQ-MS.15: dev-mode console.warn for unmapped route segment", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("calls console.warn in development when segment is unknown", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockPathname = "/test-org/unknown-section/page";
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unknown-section")
    );
  });

  it("does NOT call console.warn in production for unmapped segment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockPathname = "/test-org/unknown-section/page";
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does NOT warn for cross-module routes (members, documents)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockPathname = "/test-org/members";
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does NOT warn for known module segments", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockPathname = "/test-org/accounting/journal";
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PR5.5 — REQ-MS.10 sign-out: Clerk sign-out clears localStorage (RED)
// ---------------------------------------------------------------------------

// Mock useClerk — addListener receives a callback; we expose a way to trigger it
let clerkListenerCallback: ((resources: { session: null | object }) => void) | null = null;

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({
    addListener: vi.fn((cb: (resources: { session: null | object }) => void) => {
      clerkListenerCallback = cb;
      return () => { clerkListenerCallback = null; }; // unsubscribe
    }),
  }),
}));

describe("PR5.5 — REQ-MS.10: Clerk sign-out clears sidebar-active-module", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPathname = "/test-org/members";
    clerkListenerCallback = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    clerkListenerCallback = null;
  });

  it("removes sidebar-active-module from localStorage when Clerk session becomes null", async () => {
    localStorage.setItem("sidebar-active-module", "contabilidad");
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});

    // Simulate Clerk sign-out: session becomes null
    expect(clerkListenerCallback).not.toBeNull();
    act(() => {
      clerkListenerCallback!({ session: null });
    });

    expect(localStorage.getItem("sidebar-active-module")).toBeNull();
  });

  it("does NOT remove sidebar-active-module when Clerk session is non-null (normal update)", async () => {
    localStorage.setItem("sidebar-active-module", "granjas");
    renderHook(() => useActiveModule(), { wrapper: wrapper(ALL_RESOURCES) });
    await act(async () => {});

    // Simulate non-sign-out Clerk event: session is non-null
    act(() => {
      clerkListenerCallback!({ session: { id: "sess_123" } });
    });

    expect(localStorage.getItem("sidebar-active-module")).toBe("granjas");
  });
});
