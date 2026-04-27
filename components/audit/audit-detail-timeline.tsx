"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ENTITY_TYPE_LABELS,
  buildTimelineSummary,
  isHeaderEvent,
  type AuditEvent,
} from "@/features/audit";
import { formatDateTimeBO } from "@/lib/date-utils";
import { ActionBadge, ClassificationBadge } from "./audit-event-badges";
import { AuditDiffViewer } from "./audit-diff-viewer";

// ── TimelineGroup ─────────────────────────────────────────────────────────────

/**
 * A correlation group derived from a flat list of `AuditEvent`s.
 * One card per group is rendered by `AuditDetailTimeline`.
 */
export type TimelineGroup = {
  /**
   * Group key: `correlationId` for grouped events,
   * `__singleton__:${event.id}` for NULL events.
   *
   * STRICTLY COMPONENT-PRIVATE — used only as React `key` and the
   * `useState` toggle map key. MUST NOT be serialized to URLs, backend
   * filters, `data-*` attributes, localStorage, or any external boundary.
   * (D3.a Fix 3, REQ-CORR.5)
   */
  key: string;
  /** Stable group identifier (correlationId) or null for NULL singletons. */
  correlationId: string | null;
  /** Earliest event in the group (or the header-type event if present). */
  primaryEvent: AuditEvent;
  /** All events in the group, ordered ASC by createdAt (as received). */
  events: AuditEvent[];
  /** Human-readable Spanish summary for the card header (computed once). */
  summary: string;
};

// ── groupByCorrelation ────────────────────────────────────────────────────────

/**
 * Groups a flat event list into `TimelineGroup[]` by `correlationId`.
 *
 * Rules (REQ-CORR.5, D3.a):
 * - Events with the same non-null `correlationId` collapse into one group.
 * - Events with `correlationId = null` each become a singleton group with a
 *   synthetic key `__singleton__:${event.id}` (component-private — see above).
 * - Group order = first-seen order (events arrive ASC chronological per repo
 *   contract, so groups are also chronological).
 *
 * Exported for direct unit testing (E1). Not intended for use outside this
 * file or its tests.
 */
export function groupByCorrelation(events: AuditEvent[]): TimelineGroup[] {
  const buckets = new Map<string, AuditEvent[]>();
  const order: string[] = [];

  for (const ev of events) {
    const key = ev.correlationId ?? `__singleton__:${ev.id}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(ev);
  }

  return order.map((key) => {
    const groupEvents = buckets.get(key)!;
    const primary = pickPrimary(groupEvents);
    return {
      key,
      correlationId: groupEvents[0].correlationId,
      primaryEvent: primary,
      events: groupEvents,
      summary: buildTimelineSummary(groupEvents),
    };
  });
}

function pickPrimary(events: AuditEvent[]): AuditEvent {
  const header = events.find((ev) => isHeaderEvent(ev.entityType));
  return header ?? events[0];
}

// Re-export buildTimelineSummary for direct unit testing (E2).
export { buildTimelineSummary };

// ── AuditDetailTimeline ───────────────────────────────────────────────────────

interface AuditDetailTimelineProps {
  events: AuditEvent[];
}

export function AuditDetailTimeline({ events }: AuditDetailTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No hay eventos de auditoría para este comprobante.
        </CardContent>
      </Card>
    );
  }

  const groups = groupByCorrelation(events);

  function toggleGroup(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const { primaryEvent, events: groupEvents, key, summary } = group;
        const isMulti = groupEvents.length >= 2;
        const isOpen = expanded[key] ?? false;

        return (
          <Card key={key} role="article">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <ActionBadge action={primaryEvent.action} />
                <ClassificationBadge classification={primaryEvent.classification} />
                <span className="text-sm font-medium">
                  {ENTITY_TYPE_LABELS[primaryEvent.entityType]}
                </span>
                {isMulti && summary && (
                  <span className="text-xs text-muted-foreground">{summary}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <span>{formatDateTimeBO(primaryEvent.createdAt)}</span>
                {" · "}
                <span>{primaryEvent.changedBy?.name ?? "Usuario eliminado"}</span>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {primaryEvent.justification && (
                <p className="mb-3 text-sm italic text-muted-foreground">
                  &ldquo;{primaryEvent.justification}&rdquo;
                </p>
              )}

              {isMulti ? (
                <>
                  <button
                    type="button"
                    className="mb-3 text-sm text-primary underline-offset-2 hover:underline focus:outline-none"
                    onClick={() => toggleGroup(key)}
                    aria-expanded={isOpen}
                  >
                    Ver detalle
                  </button>
                  {isOpen && (
                    <div className="space-y-3">
                      {groupEvents.map((ev, idx) => (
                        <div key={ev.id}>
                          {idx > 0 && (
                            <div className="my-2 border-t border-border" />
                          )}
                          <AuditDiffViewer event={ev} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <AuditDiffViewer event={groupEvents[0]} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
