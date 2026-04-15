import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { ReportEntry } from "@/features/reports";

interface ReportCardProps {
  entry: ReportEntry;
  orgSlug: string;
}

/**
 * Presentational Server Component.
 * - Disponible → <Link> (clickable card)
 * - Planificado → <div role="link" aria-disabled="true"> (non-interactive)
 */
export function ReportCard({ entry, orgSlug }: ReportCardProps) {
  const badge =
    entry.status === "available" ? (
      <Badge variant="secondary">Disponible</Badge>
    ) : (
      <Badge variant="outline">Próximamente</Badge>
    );

  const cardBody = (
    <Card
      size="sm"
      className="h-full transition-colors"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{entry.title}</CardTitle>
          {badge}
        </div>
        <CardDescription>{entry.description}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );

  if (entry.status === "available" && entry.route) {
    return (
      <Link
        href={`/${orgSlug}${entry.route}`}
        className="block h-full hover:no-underline"
        aria-label={entry.title}
      >
        {cardBody}
      </Link>
    );
  }

  // Planned: non-navigable, accessible
  return (
    <div
      role="link"
      aria-disabled="true"
      aria-label={entry.title}
      data-testid={`report-card-${entry.id}`}
      className="cursor-default opacity-60"
    >
      <Card size="sm" className="h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm text-muted-foreground">
              {entry.title}
            </CardTitle>
            {badge}
          </div>
          <CardDescription>{entry.description}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
