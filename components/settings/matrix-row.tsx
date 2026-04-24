/**
 * PR2.4 [GREEN] — MatrixRow
 * REQ-RM.5, REQ-RM.6, REQ-RM.7, REQ-RM.8
 *
 * One resource row in the grouped matrix with Ver / Editar / Registrar cells.
 * Registrar column renders ONLY for postable resources (sales, purchases, journal).
 * Non-postable rows show an empty <td> to preserve column alignment.
 *
 * Raw <input type="checkbox"> — no shadcn Checkbox install per spec constraint.
 */
import type { Resource, PostableResource } from "@/features/permissions";

// Postable resources — must NOT be imported from features/shared/permissions
// (getPostAllowedRoles / POST_ALLOWED_ROLES are internal); use local constant.
const POSTABLE_RESOURCES = new Set<Resource>(["sales", "purchases", "journal"] as PostableResource[]);

interface MatrixRowProps {
  resource: Resource;
  /** Display label for the resource — passed by MatrixSection */
  label: string;
  /** Optional contextual note (shared-resource hint, e.g. Libro Diario + Libro Mayor) */
  note?: string;
  canRead: boolean;
  canWrite: boolean;
  /** Only meaningful for postable resources; ignored for others */
  canPost: boolean;
  disabled: boolean;
  onToggle: (
    resource: Resource,
    column: "read" | "write" | "post",
    next: boolean,
  ) => void;
}

export function MatrixRow({
  resource,
  label,
  note,
  canRead,
  canWrite,
  canPost,
  disabled,
  onToggle,
}: MatrixRowProps) {
  const isPostable = POSTABLE_RESOURCES.has(resource);

  return (
    <tr className="border-b last:border-b-0">
      {/* Resource label column */}
      <td className="px-3 py-2 font-medium text-sm">
        <span>{label}</span>
        {note && (
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            {note}
          </span>
        )}
      </td>

      {/* Ver (read) */}
      <td className="text-center px-3 py-2">
        <input
          type="checkbox"
          data-testid={`toggle-read-${resource}`}
          checked={canRead}
          disabled={disabled}
          onChange={() => onToggle(resource, "read", !canRead)}
          className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
        />
      </td>

      {/* Editar (write) */}
      <td className="text-center px-3 py-2">
        <input
          type="checkbox"
          data-testid={`toggle-write-${resource}`}
          checked={canWrite}
          disabled={disabled}
          onChange={() => onToggle(resource, "write", !canWrite)}
          className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
        />
      </td>

      {/* Registrar (post) — only for postable resources */}
      {isPostable ? (
        <td className="text-center px-3 py-2">
          <input
            type="checkbox"
            data-testid={`toggle-canpost-${resource}`}
            checked={canPost}
            disabled={disabled}
            onChange={() => onToggle(resource, "post", !canPost)}
            className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
          />
        </td>
      ) : (
        <td className="text-center px-3 py-2" aria-hidden="true" />
      )}
    </tr>
  );
}
