/**
 * T07 — setAuditContext session var coverage
 *
 * Verifica que setAuditContext emita los SET LOCAL correctos para cada
 * combinación de argumentos (userId, organizationId, justification, correlationId).
 * Los primeros dos parámetros (userId, organizationId) son siempre requeridos;
 * justification y correlationId son opcionales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { setAuditContext } from "@/features/shared/audit-context";

describe("setAuditContext", () => {
  let executeRawUnsafe: ReturnType<typeof vi.fn>;
  let tx: Prisma.TransactionClient;

  beforeEach(() => {
    executeRawUnsafe = vi.fn(async (_: string) => 0);
    tx = { $executeRawUnsafe: executeRawUnsafe } as unknown as Prisma.TransactionClient;
  });

  it("sets userId and organizationId when called with no optional args", async () => {
    await setAuditContext(tx, "user-1", "org-1");

    expect(executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-1");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("app.current_organization_id");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("org-1");
  });

  it("sets userId, organizationId and justification when justification provided", async () => {
    await setAuditContext(tx, "user-1", "org-1", "because");

    expect(executeRawUnsafe).toHaveBeenCalledTimes(3);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-1");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("app.current_organization_id");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("org-1");
    expect(executeRawUnsafe.mock.calls[2][0]).toContain("app.audit_justification");
    expect(executeRawUnsafe.mock.calls[2][0]).toContain("because");
  });

  it("sets userId, organizationId and correlationId when correlationId provided, no justification", async () => {
    await setAuditContext(tx, "user-1", "org-1", undefined, "corr-uuid");

    expect(executeRawUnsafe).toHaveBeenCalledTimes(3);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-1");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("app.current_organization_id");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("org-1");
    expect(executeRawUnsafe.mock.calls[2][0]).toContain("app.correlation_id");
    expect(executeRawUnsafe.mock.calls[2][0]).toContain("corr-uuid");
  });

  it("sets all four session vars when all args provided", async () => {
    await setAuditContext(tx, "user-1", "org-1", "because", "corr-uuid");

    expect(executeRawUnsafe).toHaveBeenCalledTimes(4);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-1");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("app.current_organization_id");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("org-1");
    expect(executeRawUnsafe.mock.calls[2][0]).toContain("app.audit_justification");
    expect(executeRawUnsafe.mock.calls[2][0]).toContain("because");
    expect(executeRawUnsafe.mock.calls[3][0]).toContain("app.correlation_id");
    expect(executeRawUnsafe.mock.calls[3][0]).toContain("corr-uuid");
  });

  it("escapes single quotes in userId and organizationId", async () => {
    await setAuditContext(tx, "user-o'malley", "org-d'empresas");

    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-o''malley");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("org-d''empresas");
  });
});
