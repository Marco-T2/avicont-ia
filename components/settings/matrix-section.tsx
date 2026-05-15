/**
 * PR2.6 [GREEN] — MatrixSection
 * REQ-RM.1, REQ-RM.3, REQ-RM.5
 *
 * Renders one module (or "Organización") section header + one MatrixRow per resource.
 * Shared-resource rows (journal, purchases) include a contextual note per spec §10.
 */
import type { Resource, PostableResource } from "@/features/permissions";
import { MatrixRow } from "@/components/settings/matrix-row";
import { RESOURCE_LABELS } from "@/lib/settings/resource-labels";

/**
 * Contextual notes for shared resources.
 *
 * C4 sidebar-reorg-settings-hub: notes updated to reflect the post-reorg
 * sidebar shape — CxC and CxP are no longer sidebar entries (they live in
 * /informes catalog now). Plan de Cuentas and Cierre Mensual moved to the
 * Settings hub (Configuración).
 *
 * journal backs Libro Diario AND Libro Mayor — toggling one affects both nav items.
 * reports gates the Informes catalog including CxC and CxP entries.
 */
const SHARED_RESOURCE_NOTES: Partial<Record<Resource, string>> = {
  journal: "(Afecta Libro Diario y Libro Mayor)",
  purchases: "(Afecta Compras)",
  sales: "(Afecta Ventas)",
  "accounting-config": "(Afecta Plan de Cuentas en Configuración)",
  period: "(Afecta Cierre Mensual en Configuración)",
  reports: "(Afecta Informes — incluye CxC y CxP)",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface MatrixSectionProps {
  label: string;
  resources: Resource[];
  readSet: Set<Resource>;
  writeSet: Set<Resource>;
  postSet: Set<PostableResource>;
  disabled: boolean;
  onToggle: (
    resource: Resource,
    column: "read" | "write" | "post",
    next: boolean,
  ) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MatrixSection({
  label,
  resources,
  readSet,
  writeSet,
  postSet,
  disabled,
  onToggle,
}: MatrixSectionProps) {
  return (
    <>
      {/* Section heading row spanning all columns */}
      <tr className="bg-muted">
        <td
          colSpan={4}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </td>
      </tr>

      {/* One MatrixRow per resource */}
      {resources.map((resource) => (
        <MatrixRow
          key={resource}
          resource={resource}
          label={RESOURCE_LABELS[resource]}
          note={SHARED_RESOURCE_NOTES[resource]}
          canRead={readSet.has(resource)}
          canWrite={writeSet.has(resource)}
          canPost={postSet.has(resource as PostableResource)}
          disabled={disabled}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}
