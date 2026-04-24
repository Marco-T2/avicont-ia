import "server-only";

import { prisma } from "@/lib/prisma";
import { AuditRepository, type AuditRow } from "./audit.repository";
import { classify } from "./audit.classifier";
import type {
  AuditCursor,
  AuditEntityType,
  AuditEvent,
  AuditGroup,
  AuditListFilters,
} from "./audit.types";

export class AuditService {
  private readonly repo: AuditRepository;

  constructor(repo?: AuditRepository) {
    this.repo = repo ?? new AuditRepository();
  }

  async listGrouped(
    organizationId: string,
    filters: AuditListFilters,
  ): Promise<{ groups: AuditGroup[]; nextCursor: AuditCursor | null }> {
    const { rows, nextCursor } = await this.repo.listFlat(organizationId, filters);
    const users = await this.resolveUserNames(rows);
    const events = rows.map((row) => this.toEvent(row, users));
    const groups = this.groupByVoucher(events);
    return { groups, nextCursor };
  }

  async getVoucherHistory(
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<AuditEvent[]> {
    const rows = await this.repo.getVoucherHistory(
      organizationId,
      entityType,
      entityId,
    );
    const users = await this.resolveUserNames(rows);
    return rows
      .map((row) => this.toEvent(row, users))
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  private toEvent(row: AuditRow, users: Map<string, string>): AuditEvent {
    const classification = classify(
      row.entityType,
      row.parentEntityType === "journal_entries"
        ? { kind: "journal_entries", sourceType: row.parentSourceType }
        : { kind: "none" },
    );
    return {
      id: row.id,
      createdAt: row.createdAt,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      classification,
      changedBy: row.changedById
        ? { id: row.changedById, name: users.get(row.changedById) ?? "Usuario eliminado" }
        : null,
      justification: row.justification,
      parentVoucherType: row.parentEntityType,
      parentVoucherId: row.parentEntityId,
      parentSourceType: row.parentSourceType,
      oldValues: row.oldValues,
      newValues: row.newValues,
      correlationId: row.correlationId,
    };
  }

  private groupByVoucher(events: AuditEvent[]): AuditGroup[] {
    const byKey = new Map<string, AuditEvent[]>();
    for (const ev of events) {
      const key = `${ev.parentVoucherType}:${ev.parentVoucherId}`;
      const arr = byKey.get(key) ?? [];
      arr.push(ev);
      byKey.set(key, arr);
    }
    const groups: AuditGroup[] = [];
    for (const [, arr] of byKey) {
      const head = arr[0]; // events vienen ordenados DESC desde el repo
      groups.push({
        parentVoucherType: head.parentVoucherType,
        parentVoucherId: head.parentVoucherId,
        parentClassification: head.classification,
        lastActivityAt: head.createdAt,
        eventCount: arr.length,
        events: arr,
      });
    }
    groups.sort(
      (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
    );
    return groups;
  }

  private async resolveUserNames(rows: AuditRow[]): Promise<Map<string, string>> {
    const ids = Array.from(
      new Set(rows.map((r) => r.changedById).filter((x): x is string => !!x)),
    );
    if (ids.length === 0) return new Map();
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    return new Map(users.map((u) => [u.id, u.name ?? u.email]));
  }
}
