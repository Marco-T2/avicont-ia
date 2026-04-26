"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDITED_ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  STATUS_BADGE_LABELS,
  buildGroupSummary,
  getVoucherDetailUrl,
  type AuditAction,
  type AuditCursor,
  type AuditEntityType,
  type AuditGroup,
} from "@/features/audit";
import { formatDateBO } from "@/lib/date-utils";
import { ActionBadge, ClassificationBadge } from "./audit-event-badges";
import { AuditDiffViewer } from "./audit-diff-viewer";

// Sentinel para el item "Todos" — Radix Select no acepta value="" (throws runtime error).
const ALL = "__ALL__";

interface AuditEventListProps {
  orgSlug: string;
  initialData: { groups: AuditGroup[]; nextCursor: AuditCursor | null };
  filters: {
    dateFrom: string; // ISO "YYYY-MM-DD"
    dateTo: string; // ISO "YYYY-MM-DD"
    entityType?: AuditEntityType;
    changedById?: string;
    action?: AuditAction;
    cursor?: string; // base64url
  };
  users: Array<{ id: string; name: string }>;
}

export function AuditEventList({
  orgSlug,
  initialData,
  filters,
  users,
}: AuditEventListProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const applyFilter = (next: Partial<typeof filters>) => {
    const merged = { ...filters, ...next, cursor: undefined }; // reset cursor al filtrar
    const sp = new URLSearchParams();
    if (merged.dateFrom) sp.set("dateFrom", merged.dateFrom);
    if (merged.dateTo) sp.set("dateTo", merged.dateTo);
    if (merged.entityType) sp.set("entityType", merged.entityType);
    if (merged.changedById) sp.set("changedById", merged.changedById);
    if (merged.action) sp.set("action", merged.action);
    router.push(`?${sp.toString()}`);
  };

  const loadNextPage = () => {
    if (!initialData.nextCursor) return;
    const sp = new URLSearchParams();
    if (filters.dateFrom) sp.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) sp.set("dateTo", filters.dateTo);
    if (filters.entityType) sp.set("entityType", filters.entityType);
    if (filters.changedById) sp.set("changedById", filters.changedById);
    if (filters.action) sp.set("action", filters.action);
    // El cursor viaja como el base64url original — pero acá solo tenemos el
    // objeto AuditCursor. Lo re-encodeamos.
    const encoded = Buffer.from(JSON.stringify(initialData.nextCursor)).toString(
      "base64url",
    );
    sp.set("cursor", encoded);
    router.push(`?${sp.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="dateFrom">Desde</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => applyFilter({ dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dateTo">Hasta</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) => applyFilter({ dateTo: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={filters.entityType ?? ALL}
              onValueChange={(v) =>
                applyFilter({
                  entityType:
                    v === ALL ? undefined : (v as AuditEntityType),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {AUDITED_ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ENTITY_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Usuario</Label>
            <Select
              value={filters.changedById ?? ALL}
              onValueChange={(v) =>
                applyFilter({ changedById: v === ALL ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Acción</Label>
            <Select
              value={filters.action ?? ALL}
              onValueChange={(v) =>
                applyFilter({
                  action: v === ALL ? undefined : (v as AuditAction),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {AUDIT_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grupos */}
      {initialData.groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay eventos de auditoría en el rango seleccionado.
          </CardContent>
        </Card>
      ) : (
        initialData.groups.map((group) => {
          const key = `${group.parentVoucherType}:${group.parentVoucherId}`;
          const summary = buildGroupSummary(group);

          // A11-S5: grupo huérfano — card minimalista sin CTA
          if (summary.isOrphan) {
            const fallbackEvent = group.events[0] ?? null;
            return (
              <Card key={key} role="article" data-testid="orphan-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    <ClassificationBadge
                      classification={group.parentClassification}
                    />
                    <span className="ml-2">
                      {ENTITY_TYPE_LABELS[group.parentVoucherType]}
                    </span>
                  </CardTitle>
                  {fallbackEvent && (
                    <p className="text-xs text-muted-foreground">
                      {fallbackEvent.changedBy?.name ?? "Usuario eliminado"} ·{" "}
                      {formatDateBO(fallbackEvent.createdAt)}
                    </p>
                  )}
                </CardHeader>
              </Card>
            );
          }

          // Grupo con identidad de comprobante — operation card completa
          const isExpanded = expanded[key] ?? false;
          const ctaHref = getVoucherDetailUrl(
            orgSlug,
            group.parentVoucherType,
            group.parentVoucherId,
          );

          return (
            <Card key={key} role="article">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <ClassificationBadge
                    classification={group.parentClassification}
                  />
                  <span className="text-sm font-medium">
                    {ENTITY_TYPE_LABELS[group.parentVoucherType]} ·{" "}
                    {group.parentVoucherId}
                  </span>
                  {summary.statusTransition && (
                    <span className="text-xs text-muted-foreground">
                      {STATUS_BADGE_LABELS[summary.statusTransition.from ?? ""] ??
                        summary.statusTransition.from}{" "}
                      →{" "}
                      {STATUS_BADGE_LABELS[summary.statusTransition.to ?? ""] ??
                        summary.statusTransition.to}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateBO(group.lastActivityAt)} · {group.eventCount}{" "}
                  {group.eventCount === 1 ? "evento" : "eventos"}
                </span>
              </CardHeader>

              <CardContent className="space-y-3 pb-4">
                {/* Sección de cabecera: evento de tipo header */}
                {summary.headerEvent && (
                  <section data-testid="header-section">
                    <div className="flex items-center gap-2 text-sm">
                      <ActionBadge action={summary.headerEvent.action} />
                      <span>
                        {summary.headerEvent.changedBy?.name ?? "Usuario eliminado"}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDateBO(summary.headerEvent.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        className="ml-auto text-xs text-primary hover:underline"
                      >
                        {isExpanded ? "Ocultar diff" : "Ver diff"}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-2">
                        <AuditDiffViewer event={summary.headerEvent} />
                      </div>
                    )}
                  </section>
                )}

                {/* Sección de detalle: resumen agregado de líneas */}
                {summary.detailTotal > 0 && (
                  <section data-testid="detail-section">
                    <p className="text-sm text-muted-foreground">
                      {[
                        summary.detailCounts.created > 0
                          ? `${summary.detailCounts.created} ${summary.detailCounts.created === 1 ? "creada" : "creadas"}`
                          : null,
                        summary.detailCounts.deleted > 0
                          ? `${summary.detailCounts.deleted} ${summary.detailCounts.deleted === 1 ? "eliminada" : "eliminadas"}`
                          : null,
                        summary.detailCounts.updated > 0
                          ? `${summary.detailCounts.updated} ${summary.detailCounts.updated === 1 ? "modificada" : "modificadas"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </section>
                )}

                {/* CTA al detalle del comprobante */}
                {ctaHref && (
                  <Link
                    href={ctaHref}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver comprobante
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Paginación */}
      {initialData.nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadNextPage}>
            Siguiente página
          </Button>
        </div>
      )}
    </div>
  );
}
