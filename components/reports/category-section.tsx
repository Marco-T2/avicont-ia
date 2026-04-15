import type { ReportCategory, ReportEntry } from "@/features/reports";
import { ReportCard } from "./report-card";

interface CategorySectionProps {
  category: ReportCategory;
  entries: ReportEntry[];
  orgSlug: string;
}

/**
 * Presentational Server Component.
 * Renders one category header + a responsive grid of ReportCards.
 */
export function CategorySection({
  category,
  entries,
  orgSlug,
}: CategorySectionProps) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby={`cat-${category.id}`}>
      <h2
        id={`cat-${category.id}`}
        className="text-lg font-semibold mb-3 text-foreground"
      >
        {category.label}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <ReportCard key={entry.id} entry={entry} orgSlug={orgSlug} />
        ))}
      </div>
    </section>
  );
}
