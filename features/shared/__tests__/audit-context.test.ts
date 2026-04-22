/**
 * T07 RED — setAuditContext correlationId extension
 *
 * Verifica que setAuditContext emita los SET LOCAL correctos para cada
 * combinación de argumentos opcionales (justification, correlationId).
 * RED: los tests (c) y (d) fallarán hasta que T08 agregue el parámetro correlationId.
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

  it("sets only userId when called with no optional args", async () => {
    await setAuditContext(tx, "user-1");

    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-1");
  });

  it("sets userId and justification when justification provided", async () => {
    await setAuditContext(tx, "user-1", "because");

    expect(executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-1");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("app.audit_justification");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("because");
  });

  it("sets userId and correlationId when correlationId provided, no justification", async () => {
    await setAuditContext(tx, "user-1", undefined, "corr-uuid");

    expect(executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-1");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("app.correlation_id");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("corr-uuid");
  });

  it("sets all three session vars when all args provided", async () => {
    await setAuditContext(tx, "user-1", "because", "corr-uuid");

    expect(executeRawUnsafe).toHaveBeenCalledTimes(3);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("app.current_user_id");
    expect(executeRawUnsafe.mock.calls[0][0]).toContain("user-1");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("app.audit_justification");
    expect(executeRawUnsafe.mock.calls[1][0]).toContain("because");
    expect(executeRawUnsafe.mock.calls[2][0]).toContain("app.correlation_id");
    expect(executeRawUnsafe.mock.calls[2][0]).toContain("corr-uuid");
  });
});
