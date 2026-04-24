"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AuditEvent } from "@/features/audit";
import { formatDateBO } from "@/lib/date-utils";
import { ActionBadge, ClassificationBadge } from "./audit-event-badges";
import { AuditDiffViewer } from "./audit-diff-viewer";

interface AuditDetailTimelineProps {
  events: AuditEvent[];
}

export function AuditDetailTimeline({ events }: AuditDetailTimelineProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No hay eventos de auditoría para este comprobante.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((ev) => (
        <Card key={ev.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <ActionBadge action={ev.action} />
              <ClassificationBadge classification={ev.classification} />
              <span className="text-sm font-medium">{ev.entityType}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <span>{formatDateBO(ev.createdAt)}</span>
              {" · "}
              <span>{ev.changedBy?.name ?? "Usuario eliminado"}</span>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {ev.justification && (
              <p className="mb-3 text-sm italic text-muted-foreground">
                &ldquo;{ev.justification}&rdquo;
              </p>
            )}
            <AuditDiffViewer event={ev} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
