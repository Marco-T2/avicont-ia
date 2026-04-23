/**
 * PR4.4 [GREEN] — RoleSidebarPreview (Option β — isolated preview)
 * REQ-RM.9, REQ-RM.10, REQ-RM.11, REQ-RM.12, REQ-RM.13, REQ-RM.14, REQ-RM.15
 *
 * Isolated sidebar preview component. Zero coupling to the shipped sidebar.
 * Shares only read-only imports from the registry + the shared drop-orphan util.
 *
 * Design: Option β (§5 of design doc) — new isolated component, NOT a prop-plumbed
 * version of ActiveModuleNav. Rationale: shipped sidebar has Clerk/router/localStorage
 * side-effects that are irrelevant and harmful inside a modal preview.
 *
 * What this component imports:
 *   ✓ MODULES from @/components/sidebar/modules/registry (read-only data)
 *   ✓ dropOrphanSeparators from @/lib/sidebar/drop-orphan-separators (shared pure util)
 *   ✓ buildSyntheticMatrix from @/lib/settings/build-synthetic-matrix
 *
 * What this component does NOT import or use:
 *   ✗ useSidebar, useActiveModule, useRolesMatrix, useClerk, useRouter, usePathname
 *   ✗ localStorage, NavItem component, any Clerk provider
 *
 * Responsive layout (REQ-RM.15, design §7):
 *   - Desktop (sm+): plain div pane with data-testid="preview-desktop"
 *   - Mobile (<sm): <details> with data-testid="preview-mobile" + <summary>
 *   Both mounts render independently (dual-mount pattern — no JS-toggled visibility).
 */

import { MODULES } from "@/components/sidebar/modules/registry";
import { dropOrphanSeparators } from "@/lib/sidebar/drop-orphan-separators";
import { buildSyntheticMatrix } from "@/lib/settings/build-synthetic-matrix";
import type { Resource } from "@/features/shared/permissions";

// ─── Cross-module resources (not in any Module.resources[]) ──────────────────
// These appear in the Organización strip, gated by canAccess(r, "read").

const CROSS_MODULE_ITEMS = [
  { resource: "agent" as Resource, label: "Agente IA" },
  { resource: "members" as Resource, label: "Miembros" },
  { resource: "documents" as Resource, label: "Documentos" },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoleSidebarPreviewProps {
  readSet: Set<Resource>;
  writeSet: Set<Resource>;
  /** orgSlug used to resolve nav item hrefs. Defaults to "preview". */
  orgSlug?: string;
}

// ─── Internal sub-components ─────────────────────────────────────────────────

/** Renders the inner preview content (module list + org strip). */
function PreviewContent({
  readSet,
  writeSet,
  orgSlug: _orgSlug,
}: {
  readSet: Set<Resource>;
  writeSet: Set<Resource>;
  orgSlug: string;
}) {
  const matrix = buildSyntheticMatrix(readSet, writeSet);

  // Determine which modules are visible (at least one resource readable)
  const visibleModules = MODULES.filter((m) =>
    m.resources.some((r) => matrix.canAccess(r, "read")),
  );

  // Determine visible cross-module items
  const visibleCrossModule = CROSS_MODULE_ITEMS.filter((item) =>
    matrix.canAccess(item.resource, "read"),
  );

  const isEmpty = visibleModules.length === 0 && visibleCrossModule.length === 0;

  if (isEmpty) {
    return (
      <div className="text-sm text-muted-foreground italic px-3 py-4">
        Este rol no va a ver ningún módulo todavía.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleModules.map((mod) => {
        // Filter nav items by read access, then drop orphan separators
        const filteredItems = mod.navItems.filter(
          (item) =>
            item.isSeparator ||
            (item.resource != null && matrix.canAccess(item.resource, "read")),
        );
        const cleanItems = dropOrphanSeparators(filteredItems);

        if (cleanItems.length === 0) return null;

        return (
          <div key={mod.id}>
            {/* Module heading */}
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {mod.label}
            </div>
            <div className="space-y-0.5">
              {cleanItems.map((item, idx) => {
                if (item.isSeparator) {
                  return (
                    <div
                      key={`sep-${item.label}-${idx}`}
                      className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground"
                    >
                      {item.label}
                    </div>
                  );
                }
                return (
                  <div
                    key={`${mod.id}-${item.label}-${idx}`}
                    role="menuitem"
                    aria-disabled="true"
                    className="px-3 py-1.5 text-sm rounded-md cursor-default text-foreground/80 hover:bg-accent/50 flex items-center gap-2"
                  >
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Organización strip — cross-module resources */}
      {visibleCrossModule.length > 0 && (
        <div>
          <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Organización
          </div>
          <div className="space-y-0.5">
            {visibleCrossModule.map((item) => (
              <div
                key={item.resource}
                role="menuitem"
                aria-disabled="true"
                className="px-3 py-1.5 text-sm rounded-md cursor-default text-foreground/80 hover:bg-accent/50 flex items-center gap-2"
              >
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * RoleSidebarPreview — isolated β-style preview of the sidebar as the edited
 * role would see it. Zero Clerk/router/localStorage coupling.
 *
 * Dual-mount pattern (REQ-RM.15):
 *   - data-testid="preview-desktop" — always-visible div (hidden sm:block in drawer context)
 *   - data-testid="preview-mobile"  — <details> collapsible (sm:hidden in drawer context)
 *
 * The Tailwind visibility classes (hidden sm:block / sm:hidden) are applied by PR5
 * when this component is slotted into the drawer. PR4 only builds the component.
 */
export function RoleSidebarPreview({
  readSet,
  writeSet,
  orgSlug = "preview",
}: RoleSidebarPreviewProps) {
  const contentProps = { readSet, writeSet, orgSlug };

  return (
    <>
      {/* Desktop pane — hidden on mobile, shown on sm+ */}
      <div
        data-testid="preview-desktop"
        className="hidden sm:block rounded-lg border bg-sidebar/50 p-2 min-w-0"
      >
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 border-b mb-2">
          Vista previa del menú
        </div>
        <PreviewContent {...contentProps} />
      </div>

      {/* Mobile pane — collapsible <details>, shown only below sm */}
      <details
        data-testid="preview-mobile"
        className="sm:hidden rounded-lg border bg-sidebar/50 overflow-hidden"
      >
        <summary className="px-3 py-2 text-sm font-medium cursor-pointer select-none list-none">
          Previsualización del menú
        </summary>
        <div className="p-2">
          <PreviewContent {...contentProps} />
        </div>
      </details>
    </>
  );
}
