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
 * journal backs Libro Diario AND Libro Mayor — toggling one affects both nav items.
 * purchases backs Compras y Servicios AND CxP — same pairing.
 */
const SHARED_RESOURCE_NOTES: Partial<Record<Resource, string>> = {
  journal: "(Afecta Libro Diario y Libro Mayor)",
  purchases: "(Afecta Compras y CxP)",
  sales: "(Afecta Ventas y CxC)",
  "accounting-config": "(Afecta Plan de Cuentas)",
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
      <tr className="bg-gray-100">
        <td
          colSpan={4}
          className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600"
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
