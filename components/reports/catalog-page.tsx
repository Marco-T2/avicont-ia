import { reportCategories, reportRegistry } from "@/features/reports";
import { CategorySection } from "./category-section";

interface CatalogPageProps {
  orgSlug: string;
}

/**
 * Presentational Server Component.
 * Groups registry entries by category, renders in ascending sortOrder.
 * Hidden entries are excluded. Categories with no visible entries are skipped.
 */
export function CatalogPage({ orgSlug }: CatalogPageProps) {
  const sortedCategories = [...reportCategories].sort(
    (a, b) => a.order - b.order
  );

  return (
    <div className="space-y-8">
      {sortedCategories.map((category) => {
        const entries = reportRegistry.filter(
          (entry) =>
            entry.category === category.id && entry.status !== "hidden"
        );

        return (
          <CategorySection
            key={category.id}
            category={category}
            entries={entries}
            orgSlug={orgSlug}
          />
        );
      })}
    </div>
  );
}
