import { reportCategories, type ReportEntry } from "@/features/reports";
import { CategorySection } from "./category-section";

interface CatalogPageProps {
  orgSlug: string;
  /**
   * Pre-filtered entries from the page route. The route resolves per-entry
   * RBAC via `canAccess(role, entry.resource, "read", orgId)` and passes
   * only allowed entries here. This component remains presentational —
   * grouping by category + status-based rendering only.
   */
  entries: readonly ReportEntry[];
}

/**
 * Presentational Server Component.
 * Groups the provided entries by category, renders in ascending sortOrder.
 * Hidden entries are excluded. Categories with no visible entries are skipped.
 */
export function CatalogPage({ orgSlug, entries }: CatalogPageProps) {
  const sortedCategories = [...reportCategories].sort(
    (a, b) => a.order - b.order
  );

  return (
    <div className="space-y-8">
      {sortedCategories.map((category) => {
        const categoryEntries = entries.filter(
          (entry) =>
            entry.category === category.id && entry.status !== "hidden"
        );

        return (
          <CategorySection
            key={category.id}
            category={category}
            entries={categoryEntries}
            orgSlug={orgSlug}
          />
        );
      })}
    </div>
  );
}
