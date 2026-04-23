import "server-only";
import { isClerkAPIResponseError } from "@clerk/shared/error";

/**
 * Clerk error classifiers for the members-clerk-sync-saga.
 *
 * Three strategies intentionally layered (per design §3 R-1):
 *   1. Exact code match against the documented Clerk API code strings.
 *   2. Substring fallback for duplicate/already_a_member variants — preserves
 *      the old ad-hoc helper's behaviour and tolerates minor Clerk drift.
 *   3. HTTP status 404 for the not-found path — robust against code renames.
 *
 * Contract tests live at `__tests__/clerk-error-contract.test.ts` and assert
 * these functions against captured fixtures. Re-run contract tests after
 * ANY `@clerk/nextjs` or `@clerk/backend` version bump; re-capture fixtures
 * if Clerk's error shape drifts.
 */

const DUPLICATE_CODES = ["already_a_member_in_organization", "duplicate_record"];
const NOT_FOUND_CODES = ["resource_not_found", "organization_membership_not_found"];

export function isClerkDuplicateMembershipError(err: unknown): boolean {
  if (!isClerkAPIResponseError(err)) return false;
  const code = err.errors?.[0]?.code ?? "";
  if (DUPLICATE_CODES.includes(code)) return true;
  // Defensive substring match — matches legacy helper behaviour.
  if (code.includes("duplicate")) return true;
  if (code.includes("already_a_member")) return true;
  return false;
}

export function isClerkMembershipNotFoundError(err: unknown): boolean {
  if (!isClerkAPIResponseError(err)) return false;
  // 404 is the canonical signal regardless of error code.
  if (err.status === 404) return true;
  const code = err.errors?.[0]?.code ?? "";
  return NOT_FOUND_CODES.includes(code);
}

export function clerkRetryAfterSeconds(err: unknown): number | undefined {
  if (!isClerkAPIResponseError(err)) return undefined;
  return err.retryAfter;
}

export type ClerkErrorFingerprint =
  | { code?: string; status?: number; traceId?: string }
  | { code: "non_clerk_error"; message: string };

export function clerkErrorFingerprint(err: unknown): ClerkErrorFingerprint {
  if (isClerkAPIResponseError(err)) {
    return {
      code: err.errors?.[0]?.code,
      status: err.status,
      traceId: err.clerkTraceId,
    };
  }
  return {
    code: "non_clerk_error",
    message: err instanceof Error ? err.message : String(err),
  };
}
