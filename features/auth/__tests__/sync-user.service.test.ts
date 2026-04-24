/**
 * Audit H #3 — sync-user error-handling boundary
 *
 * Covers the CRITICAL finding from Audit H (2026-04-24): `resolveByClerkId`
 * returns `User` on hit and throws `NotFoundError` on miss, but
 * `sync-user.service.ts:20` wraps the call in `.catch(() => null)`, which
 * collapses ANY error (DB timeout, connection loss, unexpected throw) into the
 * "user does not exist" branch. Result: a transient infrastructure failure
 * silently falls through to `findOrCreate`, violating idempotency — the second
 * query can create a duplicate user, or mask the real fault entirely.
 *
 * Expected failure mode on current (pre-fix) code:
 *   - A generic Error thrown by `resolveByClerkId` is swallowed.
 *   - `findOrCreate` is invoked (the else branch runs with `existing = null`).
 *   - `syncUserToDatabase()` resolves successfully instead of throwing.
 *   - Assertions `rejects.toThrow` and `findOrCreate not called` both fail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, NotFoundError } from "@/features/shared/errors";

const {
  mockResolveByClerkId,
  mockFindOrCreate,
  mockUpdate,
  mockCurrentUser,
} = vi.hoisted(() => ({
  mockResolveByClerkId: vi.fn(),
  mockFindOrCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockCurrentUser: vi.fn(),
}));

vi.mock("@/features/users/server", () => ({
  UsersService: class {
    resolveByClerkId = mockResolveByClerkId;
    findOrCreate = mockFindOrCreate;
    update = mockUpdate;
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: mockCurrentUser,
}));

import { syncUserToDatabase } from "../sync-user.service";

const CLERK_USER = {
  id: "clerk_user_abc",
  emailAddresses: [{ emailAddress: "user@example.com" }],
  firstName: "Ada",
  lastName: "Lovelace",
};

const DB_USER = {
  id: "db_user_1",
  clerkUserId: CLERK_USER.id,
  email: "user@example.com",
  name: "Ada Lovelace",
};

describe("syncUserToDatabase — error-handling boundary (Audit H #3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no authenticated Clerk user", async () => {
    mockCurrentUser.mockResolvedValue(null);

    const result = await syncUserToDatabase();

    expect(result).toBeNull();
    expect(mockResolveByClerkId).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });

  it("updates the existing DB user when resolveByClerkId finds one", async () => {
    mockCurrentUser.mockResolvedValue(CLERK_USER);
    mockResolveByClerkId.mockResolvedValue(DB_USER);
    mockUpdate.mockResolvedValue({ ...DB_USER, name: "Ada Lovelace" });

    const result = await syncUserToDatabase();

    expect(result).toEqual({ ...DB_USER, name: "Ada Lovelace" });
    expect(mockUpdate).toHaveBeenCalledWith(DB_USER.id, {
      email: "user@example.com",
      name: "Ada Lovelace",
    });
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });

  it("falls through to findOrCreate when resolveByClerkId throws NotFoundError (user truly missing)", async () => {
    mockCurrentUser.mockResolvedValue(CLERK_USER);
    mockResolveByClerkId.mockRejectedValue(new NotFoundError("Usuario"));
    mockFindOrCreate.mockResolvedValue(DB_USER);

    const result = await syncUserToDatabase();

    expect(result).toEqual(DB_USER);
    expect(mockFindOrCreate).toHaveBeenCalledWith({
      clerkUserId: CLERK_USER.id,
      email: "user@example.com",
      name: "Ada Lovelace",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("propagates a non-NotFound error from resolveByClerkId instead of falling through to findOrCreate", async () => {
    mockCurrentUser.mockResolvedValue(CLERK_USER);
    // Infra failure, NOT a semantic "not found". Current code swallows this
    // via `.catch(() => null)` and silently proceeds to findOrCreate, which
    // would (wrongly) create a duplicate user if the initial query had actually
    // succeeded in the DB layer but failed network-side.
    mockResolveByClerkId.mockRejectedValue(new Error("DB connection lost"));
    // Prove the pre-fix path: if findOrCreate is reachable, it would resolve.
    mockFindOrCreate.mockResolvedValue({ id: "duplicate_user" });

    await expect(syncUserToDatabase()).rejects.toBeInstanceOf(AppError);
    await expect(syncUserToDatabase()).rejects.toMatchObject({
      code: "SYNC_USER_FAILED",
      statusCode: 500,
    });

    expect(mockFindOrCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("re-throws AppError subclasses without wrapping them", async () => {
    mockCurrentUser.mockResolvedValue(CLERK_USER);
    const forbidden = new AppError("policy violation", 403, "FORBIDDEN");
    mockResolveByClerkId.mockRejectedValue(forbidden);

    await expect(syncUserToDatabase()).rejects.toBe(forbidden);
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });
});
