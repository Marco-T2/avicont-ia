"use client";

/**
 * PR1.4 [GREEN] — REQ-MS.3: ROUTE_MODULE_MAP inline constant
 * PR1.6 [GREEN] — REQ-MS.6: getRoleDefaultModule() pure function
 * PR1.8 [GREEN] — REQ-MS.3/4/6/11: useActiveModule() hook
 * PR1.10 [GREEN] — REQ-MS.10: revalidation on matrix change
 * PR5.2 [GREEN] — REQ-MS.14: onboarding toast on first render
 * PR5.4 [GREEN] — REQ-MS.15: dev-mode console.warn for unmapped segments
 * PR5.6 [GREEN] — REQ-MS.10 sign-out: Clerk sign-out clears localStorage
 *
 * Design decisions (from design.md):
 * - Route→module map is inline (not a separate file) at current size of 9 segments
 * - localStorage key matches sidebar-* naming convention: "sidebar-active-module"
 * - localStorage reads happen in useEffect only — SSR safety (mirrors sidebar-provider.tsx)
 * - Module state is separate from SidebarProvider (single responsibility)
 * - getRoleDefaultModule is a pure exported function (testable in isolation)
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { toast } from "sonner";
import { useRolesMatrix } from "@/components/common/roles-matrix-provider";
import type { ClientMatrix } from "@/components/common/roles-matrix-provider";
import { MODULES } from "./registry";
import type { Module, ModuleId } from "./registry";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "sidebar-active-module";
const ONBOARDING_KEY = "sidebar-onboarding-seen";

/**
 * Segments that represent cross-module routes — absent from ROUTE_MODULE_MAP
 * by design. These routes do NOT trigger a dev-mode warn.
 */
const CROSS_MODULE_SEGMENTS = new Set(["members", "documents", ""]);


/**
 * Static map from URL path segment → ModuleId.
 * Segment = pathname.split("/")[2] for paths like /{orgSlug}/{segment}/...
 *
 * Cross-module routes (members, documents, home) are absent — they return
 * undefined and the hook falls back to localStorage or role-based default.
 *
 * Exported for direct unit testing of the map in isolation.
 */
export const ROUTE_MODULE_MAP: Record<string, ModuleId> = {
  accounting: "contabilidad",
  dispatches: "contabilidad",
  purchases: "contabilidad",
  sales: "contabilidad",
  payments: "contabilidad",
  informes: "contabilidad",
  settings: "contabilidad",
  farms: "granjas",
  lots: "granjas",
};

// ---------------------------------------------------------------------------
// Pure helper: accounting resources that determine default module
// ---------------------------------------------------------------------------

const ACCOUNTING_RESOURCES: string[] = [
  "sales",
  "purchases",
  "payments",
  "journal",
  "dispatches",
  "reports",
  "contacts",
  "accounting-config",
];

/**
 * Derives the role-based default module from a ClientMatrix.
 *
 * Logic:
 * 1. If any of the accounting resources is accessible → "contabilidad"
 * 2. Else if farms is accessible → "granjas"
 * 3. Else → null
 *
 * Exported for direct unit testing.
 */
export function getRoleDefaultModule(matrix: ClientMatrix | null): ModuleId | null {
  if (!matrix) return null;
  const hasAccounting = ACCOUNTING_RESOURCES.some((r) =>
    matrix.canAccess(r as Parameters<ClientMatrix["canAccess"]>[0], "read")
  );
  if (hasAccounting) return "contabilidad";
  if (matrix.canAccess("farms", "read")) return "granjas";
  return null;
}

// ---------------------------------------------------------------------------
// Internal helper: validate that a persisted ModuleId is still accessible
// ---------------------------------------------------------------------------

function isModuleAccessible(id: ModuleId, matrix: ClientMatrix | null): boolean {
  if (!matrix) return false;
  const mod = MODULES.find((m) => m.id === id);
  if (!mod) return false;
  return mod.resources.some((r) => matrix.canAccess(r, "read"));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseActiveModuleReturn {
  activeModule: Module | null;
  setActiveModule: (id: ModuleId) => void;
  isCrossModuleRoute: boolean;
}

/**
 * useActiveModule — derives the active sidebar module from:
 *   1. The current pathname (route-based, always wins when it matches)
 *   2. localStorage["sidebar-active-module"] for cross-module routes (useEffect only)
 *   3. getRoleDefaultModule(matrix) as final fallback
 *
 * SSR safety: the initial state is derived from the route only.
 * localStorage is read exclusively in useEffect to prevent hydration mismatch.
 * This mirrors the pattern in sidebar-provider.tsx.
 */
export function useActiveModule(): UseActiveModuleReturn {
  const pathname = usePathname();
  const matrix = useRolesMatrix();
  const clerk = useClerk();

  // Derive route-based moduleId synchronously (safe for SSR initial render)
  const segments = pathname?.split("/") ?? [];
  // Paths are /{orgSlug}/{segment}/... — segment is at index 2
  const segment = segments[2] ?? "";
  const routeModuleId = ROUTE_MODULE_MAP[segment] ?? null;
  const isCrossModuleRoute = routeModuleId === null;

  // Initial state: route-based value (no localStorage) — SSR safe
  const [activeModuleId, setActiveModuleIdState] = useState<ModuleId | null>(
    routeModuleId
  );

  // After mount: resolve localStorage for cross-module routes
  useEffect(() => {
    if (!isCrossModuleRoute) {
      // Route match — update state to reflect the current route
      setActiveModuleIdState(routeModuleId);
      return;
    }

    // Cross-module route: read localStorage
    const stored = localStorage.getItem(STORAGE_KEY) as ModuleId | null;
    if (stored && isModuleAccessible(stored, matrix)) {
      setActiveModuleIdState(stored);
    } else {
      // Invalid/missing localStorage — fall back to role-based default
      const defaultId = getRoleDefaultModule(matrix);
      setActiveModuleIdState(defaultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isCrossModuleRoute, routeModuleId]);

  // PR1.10: revalidation on matrix change — re-check persisted value accessibility
  useEffect(() => {
    if (!isCrossModuleRoute) return;

    const stored = localStorage.getItem(STORAGE_KEY) as ModuleId | null;
    if (stored && !isModuleAccessible(stored, matrix)) {
      // Permission revoked — fall back to role-based default
      const defaultId = getRoleDefaultModule(matrix);
      setActiveModuleIdState(defaultId);
      if (defaultId) {
        localStorage.setItem(STORAGE_KEY, defaultId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrix]);

  // PR5.4 [GREEN] — REQ-MS.15: dev-mode warn for unmapped segments
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!segment) return;
    // Only warn for segments that are not in ROUTE_MODULE_MAP AND not a
    // known cross-module segment. This avoids false positives for /members,
    // /documents, and the org-home route (empty segment).
    if (!ROUTE_MODULE_MAP[segment] && !CROSS_MODULE_SEGMENTS.has(segment)) {
      console.warn(
        `[use-active-module] Segment "${segment}" not in ROUTE_MODULE_MAP. Update the map or add it to CROSS_MODULE_SEGMENTS.`
      );
    }
     
  }, [segment]);

  // PR5.2 [GREEN] — REQ-MS.14: onboarding toast — fires once per browser
  useEffect(() => {
    if (
      !localStorage.getItem(STORAGE_KEY) &&
      !localStorage.getItem(ONBOARDING_KEY)
    ) {
      localStorage.setItem(ONBOARDING_KEY, "true");
      toast.info(
        "Nuevo: módulos. Cambiá entre Contabilidad y Granjas desde el selector arriba."
      );
    }
    // Run once on mount — no deps needed
     
  }, []);

  // PR5.6 [GREEN] — REQ-MS.10 sign-out: clear localStorage on Clerk sign-out
  useEffect(() => {
    const unsubscribe = clerk.addListener(({ session }) => {
      if (session === null) {
        localStorage.removeItem(STORAGE_KEY);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveModule = useCallback(
    (id: ModuleId) => {
      setActiveModuleIdState(id);
      localStorage.setItem(STORAGE_KEY, id);
    },
    []
  );

  const activeModule = activeModuleId
    ? (MODULES.find((m) => m.id === activeModuleId) ?? null)
    : null;

  return { activeModule, setActiveModule, isCrossModuleRoute };
}
