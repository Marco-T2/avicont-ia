import "server-only";
import { ForbiddenError, NotFoundError } from "@/features/shared/errors";
import type { ClerkAuthPort } from "../domain/ports/clerk-auth.port";
import type { OrganizationsService } from "./organizations.service";
import type { MembersService } from "./members.service";

/**
 * Clerk's owner-equivalent role. Clerk default roles are `org:admin` (owner /
 * full-control) and `org:member` (standard member). Custom roles slug in as
 * `org:<slug>`. The lazy-sync init gate uses this constant to refuse
 * first-time DB initialization by anyone other than the org owner — see
 * REQ "restrictive" path in EnsureFromClerkService.ensure().
 */
const CLERK_OWNER_ROLE = "org:admin";

export interface EnsureFromClerkDeps {
  clerkAuth: ClerkAuthPort;
  organizations: OrganizationsService;
  members: MembersService;
}

/**
 * Lazy-sync use case — keeps local DB (Organization + OrganizationMember)
 * in step with Clerk on each `requirePermission` call.
 *
 * Two scenarios:
 *
 *  1. Org missing locally → only the Clerk-owner can initialize. Pulls
 *     `{ name, slug }` from Clerk and delegates to
 *     `OrganizationsService.syncOrganization` (atomic: org + owner member +
 *     voucher types + chart of accounts + system roles). Non-owners hit a
 *     `ForbiddenError` with a guiding message — they must wait for the owner.
 *
 *  2. Org present locally, member missing → consults Clerk for the user's
 *     membership; if found, delegates to `MembersService.addMember` (which
 *     resolves email → user via UsersService + reuses the member-clerk-saga
 *     — duplicates in Clerk are treated as idempotent success, the saga's
 *     `isClerkDuplicateMembershipError` guard). If user is not a member in
 *     Clerk either → `ForbiddenError`.
 *
 * Trade-offs declared:
 *  - Latency: hits Clerk on cache-miss. ~50-200ms per first request.
 *  - Race: two concurrent first-requests can both hit step 2; the inner
 *    `syncOrganization`'s `findByClerkId` check makes it idempotent.
 *  - Deletes in Clerk do NOT propagate here — for that, webhooks are the
 *    correct mechanism.
 */
export class EnsureFromClerkService {
  constructor(private readonly deps: EnsureFromClerkDeps) {}

  async ensure(
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<{ orgId: string }> {
    const { clerkAuth, organizations, members } = this.deps;

    // Scenario 1: ¿existe org local?
    const localOrg = await organizations
      .getByClerkId(clerkOrgId)
      .catch((err: unknown) => {
        if (err instanceof NotFoundError) return null;
        throw err;
      });

    if (!localOrg) {
      // Gate: solo el owner Clerk puede inicializar (modo restrictivo).
      const membership = await clerkAuth.findMembership(
        clerkOrgId,
        clerkUserId,
      );
      if (!membership) {
        throw new ForbiddenError(
          "No sos miembro de esta organización en Clerk.",
        );
      }
      if (membership.role !== CLERK_OWNER_ROLE) {
        throw new ForbiddenError(
          "La organización no está inicializada localmente. " +
            "Solo el propietario puede ejecutar la primera sincronización. " +
            "Pedile al propietario que entre primero.",
        );
      }

      const clerkOrg = await clerkAuth.getOrganization(clerkOrgId);
      if (!clerkOrg) {
        throw new NotFoundError("Organización en Clerk");
      }

      const result = await organizations.syncOrganization(
        {
          clerkOrgId,
          name: clerkOrg.name,
          slug: clerkOrg.slug ?? undefined,
        },
        clerkUserId,
      );
      // syncOrganization ya crea el owner member en la misma transacción.
      return { orgId: result.organization.id };
    }

    // Scenario 2: org existe local. ¿existe el member local?
    const localMember = await organizations
      .getMemberByClerkUserId(localOrg.id, clerkUserId)
      .catch((err: unknown) => {
        if (err instanceof ForbiddenError) return null;
        throw err;
      });

    if (localMember) {
      return { orgId: localOrg.id };
    }

    // Member missing → pull from Clerk y crear local.
    const membership = await clerkAuth.findMembership(
      clerkOrgId,
      clerkUserId,
    );
    if (!membership) {
      throw new ForbiddenError(
        "No sos miembro de esta organización en Clerk.",
      );
    }

    // addMember corre el member-clerk-saga; trata duplicate-en-Clerk como
    // idempotent success — perfect para lazy sync donde el member YA existe
    // en Clerk y solo queremos materializar el record local.
    await members.addMember(localOrg.id, membership.email, membership.role);

    return { orgId: localOrg.id };
  }
}
