/**
 * Clerk error contract test — classifier correctness against fixture shapes.
 *
 * RED state (T1 of members-clerk-sync-saga):
 *   Expected failure mode at commit time: module resolution error
 *   `Cannot find module '../clerk-error-classifiers'` — classifier file does
 *   not yet exist. T4 (GREEN) adds `features/organizations/clerk-error-classifiers.ts`
 *   and turns every assertion below green.
 *
 * IMPORTANT (SF-1, unverified fixtures):
 * The JSON fixtures under `__fixtures__/clerk-*.json` were synthesized from the
 * `@clerk/shared` `ClerkAPIResponseError` + `ClerkAPIErrorJSON` *type* shape
 * (see `node_modules/@clerk/shared/dist/runtime/index-DS9PyRNS.d.ts`, interface
 * `ClerkAPIErrorJSON` at line ~1931; `ClerkAPIResponseError` class at
 * `error-D-ayZ5nL.mjs:83`). They were NOT captured from live Clerk API
 * responses — this environment has no Clerk sandbox credentials. The specific
 * error `code` strings (`already_a_member_in_organization`, `resource_not_found`,
 * `rate_limit_exceeded`) are the values the design §3 contract ASSUMES. If
 * the live Clerk response uses a different code, this suite will silently
 * pass the wrong guard. Re-capture fixtures before merging to prod:
 *
 * Re-capture procedure (to be executed once live Clerk creds are available):
 *   1. In a dev Clerk app, call `client.organizations.createOrganizationMembership`
 *      twice for the same user to trigger 422; capture the caught error via
 *      `JSON.stringify({ status, clerkTraceId, retryAfter, data: err.errors.map(errorToJSON) })`.
 *      Write to `__fixtures__/clerk-duplicate-membership.json`.
 *   2. Call `client.organizations.deleteOrganizationMembership` for a non-member
 *      to trigger 404. Capture as above → `clerk-membership-not-found.json`.
 *   3. Rate-limit (429) is hard to reproduce deterministically — keep the
 *      synthetic fixture with `retryAfter: 30` until a live one is captured.
 *
 * Re-run this suite after ANY `@clerk/nextjs` or `@clerk/backend` bump.
 *
 * NOTE: the test rebuilds a *real* `ClerkAPIResponseError` from the fixture
 * via the SDK constructor. This means `isClerkAPIResponseError(err)` returns
 * true and the classifiers run their production code path — not a parallel
 * hand-rolled contract (closes `aspirational_mock_signals_unimplemented_contract`).
 */
import { describe, it, expect } from "vitest";
import { ClerkAPIResponseError } from "@clerk/shared/error";
import duplicateFixture from "./__fixtures__/clerk-duplicate-membership.json";
import notFoundFixture from "./__fixtures__/clerk-membership-not-found.json";
import rateLimitFixture from "./__fixtures__/clerk-rate-limit.json";
import {
  isClerkDuplicateMembershipError,
  isClerkMembershipNotFoundError,
  clerkRetryAfterSeconds,
  clerkErrorFingerprint,
} from "../clerk-error-classifiers";

type ClerkFixture = {
  status: number;
  clerkTraceId?: string;
  retryAfter?: number | null;
  data: Array<{ code: string; message: string; long_message?: string; meta?: Record<string, unknown> }>;
};

function buildClerkError(fixture: ClerkFixture, message = "Clerk API error"): ClerkAPIResponseError {
  return new ClerkAPIResponseError(message, {
    data: fixture.data as unknown as ConstructorParameters<typeof ClerkAPIResponseError>[1]["data"],
    status: fixture.status,
    clerkTraceId: fixture.clerkTraceId,
    retryAfter: fixture.retryAfter ?? undefined,
  });
}

describe("Clerk error contract — duplicate-membership fixture", () => {
  const err = buildClerkError(duplicateFixture as ClerkFixture);

  it("isClerkDuplicateMembershipError → true", () => {
    expect(isClerkDuplicateMembershipError(err)).toBe(true);
  });

  it("isClerkMembershipNotFoundError → false", () => {
    expect(isClerkMembershipNotFoundError(err)).toBe(false);
  });

  it("clerkRetryAfterSeconds → undefined (no retry-after on 422)", () => {
    expect(clerkRetryAfterSeconds(err)).toBeUndefined();
  });

  it("clerkErrorFingerprint → captures code + status + traceId", () => {
    const fp = clerkErrorFingerprint(err);
    expect(fp).toMatchObject({
      code: "already_a_member_in_organization",
      status: 422,
      traceId: "fixture_duplicate_trace",
    });
  });
});

describe("Clerk error contract — membership-not-found fixture", () => {
  const err = buildClerkError(notFoundFixture as ClerkFixture);

  it("isClerkMembershipNotFoundError → true", () => {
    expect(isClerkMembershipNotFoundError(err)).toBe(true);
  });

  it("isClerkDuplicateMembershipError → false", () => {
    expect(isClerkDuplicateMembershipError(err)).toBe(false);
  });

  it("clerkRetryAfterSeconds → undefined", () => {
    expect(clerkRetryAfterSeconds(err)).toBeUndefined();
  });

  it("clerkErrorFingerprint → code=resource_not_found, status=404", () => {
    const fp = clerkErrorFingerprint(err);
    expect(fp).toMatchObject({ code: "resource_not_found", status: 404 });
  });
});

describe("Clerk error contract — rate-limit fixture", () => {
  const err = buildClerkError(rateLimitFixture as ClerkFixture);

  it("isClerkDuplicateMembershipError → false", () => {
    expect(isClerkDuplicateMembershipError(err)).toBe(false);
  });

  it("isClerkMembershipNotFoundError → false", () => {
    expect(isClerkMembershipNotFoundError(err)).toBe(false);
  });

  it("clerkRetryAfterSeconds → 30 (from fixture)", () => {
    expect(clerkRetryAfterSeconds(err)).toBe(30);
  });

  it("clerkErrorFingerprint → code=rate_limit_exceeded, status=429", () => {
    const fp = clerkErrorFingerprint(err);
    expect(fp).toMatchObject({ code: "rate_limit_exceeded", status: 429 });
  });
});

describe("Clerk error contract — non-Clerk error (safety)", () => {
  it("isClerkDuplicateMembershipError → false for plain Error", () => {
    expect(isClerkDuplicateMembershipError(new Error("db down"))).toBe(false);
  });

  it("isClerkMembershipNotFoundError → false for plain Error", () => {
    expect(isClerkMembershipNotFoundError(new Error("db down"))).toBe(false);
  });

  it("clerkErrorFingerprint → returns non_clerk_error shape for plain Error", () => {
    const fp = clerkErrorFingerprint(new Error("db down"));
    expect(fp).toEqual({ code: "non_clerk_error", message: "db down" });
  });

  it("clerkErrorFingerprint → handles non-Error values", () => {
    const fp = clerkErrorFingerprint("weird");
    expect(fp).toEqual({ code: "non_clerk_error", message: "weird" });
  });
});

describe("Clerk error contract — classifier defensive substring match (R-1)", () => {
  it("isClerkDuplicateMembershipError → true for unknown duplicate-like code via substring fallback", () => {
    const err = new ClerkAPIResponseError("dup", {
      data: [{ code: "form_identifier_is_duplicate", message: "x" }],
      status: 422,
    });
    expect(isClerkDuplicateMembershipError(err)).toBe(true);
  });

  it("isClerkDuplicateMembershipError → true for already_a_member_* variants", () => {
    const err = new ClerkAPIResponseError("dup", {
      data: [{ code: "already_a_member_v2", message: "x" }],
      status: 422,
    });
    expect(isClerkDuplicateMembershipError(err)).toBe(true);
  });

  it("isClerkMembershipNotFoundError → true on any 404 regardless of code", () => {
    const err = new ClerkAPIResponseError("nf", {
      data: [{ code: "some_obscure_not_found", message: "x" }],
      status: 404,
    });
    expect(isClerkMembershipNotFoundError(err)).toBe(true);
  });
});
