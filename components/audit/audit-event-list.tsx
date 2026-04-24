"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  AUDIT_ACTIONS,
  AUDITED_ENTITY_TYPES,
  type AuditAction,
  type AuditCursor,
  type AuditEntityType,
  type AuditGroup,
} from "@/features/audit";
import { formatDateBO } from "@/lib/date-utils";
import { ActionBadge, ClassificationBadge } from "./audit-event-badges";

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
                    {t}
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
                    {a}
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
          const isExpanded = expanded[key] ?? false;
          const visible = isExpanded ? group.events : group.events.slice(0, 3);
          const hidden = group.events.length - visible.length;

          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <ClassificationBadge
                    classification={group.parentClassification}
                  />
                  <Link
                    href={`/${orgSlug}/audit/${group.parentVoucherType}/${group.parentVoucherId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {group.parentVoucherType} · {group.parentVoucherId}
                  </Link>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateBO(group.lastActivityAt)} · {group.eventCount}{" "}
                  {group.eventCount === 1 ? "evento" : "eventos"}
                </span>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {visible.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <ActionBadge action={ev.action} />
                    <span>{ev.entityType}</span>
                    <span className="truncate">
                      {ev.changedBy?.name ?? "Usuario eliminado"}
                    </span>
                    <span className="ml-auto">
                      {formatDateBO(ev.createdAt)}
                    </span>
                  </div>
                ))}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [key]: true }))
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    Ver {hidden} {hidden === 1 ? "más" : "más"}
                  </button>
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
