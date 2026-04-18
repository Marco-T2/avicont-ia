/**
 * PR3 3.1 RED — canPost guard at service layer (REQ-P.3-S3 / D.3)
 *
 * Scope: sales, purchases, journal `createAndPost` MUST refuse POST for roles
 * not in POST_ALLOWED_ROLES, throwing ForbiddenError with code
 * POST_NOT_ALLOWED_FOR_ROLE. Guard is fail-fast — it runs before touching
 * any repo or service dependency, so we instantiate each service with
 * default deps and rely on the guard tripping first.
 */
import { describe, it, expect } from "vitest";
import { SaleService } from "@/features/sale/sale.service";
import { PurchaseService } from "@/features/purchase/purchase.service";
import { JournalService } from "@/features/accounting/journal.service";
import {
  ForbiddenError,
  POST_NOT_ALLOWED_FOR_ROLE,
} from "@/features/shared/errors";

const ORG = "org_canpost";

describe("SaleService.createAndPost — canPost guard (REQ-P.3-S3)", () => {
  it("auxiliar → ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE)", async () => {
    const service = new SaleService();
    await expect(
      service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "auxiliar",
      }),
    ).rejects.toMatchObject({
      code: POST_NOT_ALLOWED_FOR_ROLE,
      statusCode: 403,
    });
  });

  it("cobrador → ForbiddenError (cobrador cannot post sales)", async () => {
    const service = new SaleService();
    await expect(
      service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "cobrador",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("member → ForbiddenError", async () => {
    const service = new SaleService();
    await expect(
      service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "member",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("PurchaseService.createAndPost — canPost guard (REQ-P.3-S3)", () => {
  it("auxiliar → ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE)", async () => {
    const service = new PurchaseService();
    await expect(
      service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "auxiliar",
      }),
    ).rejects.toMatchObject({
      code: POST_NOT_ALLOWED_FOR_ROLE,
      statusCode: 403,
    });
  });

  it("cobrador → ForbiddenError", async () => {
    const service = new PurchaseService();
    await expect(
      service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "cobrador",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("JournalService.createAndPost — canPost guard (REQ-P.3)", () => {
  it("auxiliar → ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE)", async () => {
    const service = new JournalService();
    await expect(
      service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "auxiliar",
      }),
    ).rejects.toMatchObject({
      code: POST_NOT_ALLOWED_FOR_ROLE,
      statusCode: 403,
    });
  });

  it("cobrador → ForbiddenError", async () => {
    const service = new JournalService();
    await expect(
      service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "cobrador",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("member → ForbiddenError", async () => {
    const service = new JournalService();
    await expect(
      service.createAndPost(ORG, {} as never, {
        userId: "u1",
        role: "member",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
