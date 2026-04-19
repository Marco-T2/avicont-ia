/**
 * roles.service.ts — Business logic for custom roles.
 *
 * Responsibilities:
 *   - CRUD (create / list / get / update / delete / exists)
 *   - CR.2 — system role immutability (PATCH/DELETE → 403 SYSTEM_ROLE_IMMUTABLE)
 *   - CR.3 — template snapshot on create (permission arrays copied, not linked)
 *   - CR.4 — slug derivation + reserved guard + collision suffix
 *   - CR.5 — edit matrix + canPost (revalidate cache on success)
 *   - CR.6 / D.4 — self-lock guard: caller cannot strip members.write from OWN role
 *   - CR.7 — delete guard: reject if members are assigned to the role
 *   - D.5 — slug immutable on UPDATE
 *   - D.11 — array normalize (sort + dedupe) on every write
 *
 * Dependencies are injected via the constructor to keep the service pure and
 * easy to unit-test. The caller resolver lets the API layer pass Clerk-user
 * identity in without this module importing Clerk or Prisma directly.
 */
import "server-only";
import {
  ForbiddenError,
  ConflictError,
  NotFoundError,
  SYSTEM_ROLE_IMMUTABLE,
  SELF_LOCK_GUARD,
  ROLE_HAS_MEMBERS,
} from "@/features/shared/errors";
import type { CustomRole } from "@/generated/prisma/client";
import type {
  RolesRepository,
  UpdateCustomRolePatch,
} from "./roles.repository";
import {
  slugify,
  assertNotReserved,
  resolveUniqueSlug,
} from "./roles.validation";
import { revalidateOrgMatrix as defaultRevalidate } from "@/features/shared/permissions.cache";

// ────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────

export type CallerContext = {
  clerkUserId: string;
};

export type CreateRoleInput = {
  name: string;
  templateSlug: string;
  description?: string | null;
  // Optional overrides — if provided, replace the template snapshot for that field.
  permissionsRead?: string[];
  permissionsWrite?: string[];
  canPost?: string[];
  slug?: string; // optional override; still validated + collision-resolved
};

export type UpdateRolePatch = {
  name?: string;
  description?: string | null;
  permissionsRead?: string[];
  permissionsWrite?: string[];
  canPost?: string[];
};

export type RolesServiceDeps = {
  repo: RolesRepository;
  revalidateOrgMatrix?: (orgId: string) => void;
  /**
   * Resolves the caller's current role slug within the given org.
   * Return `null` if the caller has no membership (self-lock guard becomes a
   * no-op in that case — the higher layer should have already gated with
   * requirePermission('members','write')).
   */
  getCallerRoleSlug: (orgId: string, caller: CallerContext) => Promise<string | null>;
};

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

function normalizeArray(arr: readonly string[] | undefined): string[] {
  if (!arr) return [];
  return Array.from(new Set(arr)).sort();
}

function dropSlug<T extends object>(patch: T): Omit<T, "slug"> {
  const copy = { ...(patch as Record<string, unknown>) };
  delete copy.slug;
  return copy as Omit<T, "slug">;
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

export class RolesService {
  private readonly repo: RolesRepository;
  private readonly revalidateOrgMatrix: (orgId: string) => void;
  private readonly getCallerRoleSlug: (
    orgId: string,
    caller: CallerContext,
  ) => Promise<string | null>;

  constructor(deps: RolesServiceDeps) {
    this.repo = deps.repo;
    this.revalidateOrgMatrix = deps.revalidateOrgMatrix ?? defaultRevalidate;
    this.getCallerRoleSlug = deps.getCallerRoleSlug;
  }

  // ──────────────────────────────────────────────────────────
  // Reads
  // ──────────────────────────────────────────────────────────

  async listRoles(orgId: string): Promise<CustomRole[]> {
    return this.repo.findAllByOrg(orgId);
  }

  async getRole(orgId: string, slug: string): Promise<CustomRole> {
    const role = await this.repo.findBySlug(orgId, slug);
    if (!role) throw new NotFoundError("Rol");
    return role;
  }

  async exists(orgId: string, slug: string): Promise<boolean> {
    const role = await this.repo.findBySlug(orgId, slug);
    return role !== null;
  }

  // ──────────────────────────────────────────────────────────
  // Create — template snapshot, slug derivation, normalize, revalidate
  // ──────────────────────────────────────────────────────────

  async createRole(
    orgId: string,
    input: CreateRoleInput,
    _caller: CallerContext,
  ): Promise<CustomRole> {
    // 1. Load template for snapshot
    const template = await this.repo.findBySlug(orgId, input.templateSlug);
    if (!template) {
      throw new NotFoundError(`Plantilla de rol "${input.templateSlug}"`);
    }

    // 2. Derive + validate slug
    const base = input.slug ? slugify(input.slug) : slugify(input.name);
    assertNotReserved(base);

    // 3. Resolve collision against all existing slugs in the org
    const all = await this.repo.findAllByOrg(orgId);
    const existingSlugs = new Set(all.map((r) => r.slug));
    const slug = resolveUniqueSlug(base, existingSlugs);

    // 4. Snapshot template matrix (overridable via input)
    const permissionsRead = normalizeArray(
      input.permissionsRead ?? template.permissionsRead,
    );
    const permissionsWrite = normalizeArray(
      input.permissionsWrite ?? template.permissionsWrite,
    );
    const canPost = normalizeArray(input.canPost ?? template.canPost);

    // 5. Create
    const created = await this.repo.create({
      organizationId: orgId,
      slug,
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
      permissionsRead,
      permissionsWrite,
      canPost,
    });

    // 6. Revalidate cache (CR.5-S3)
    this.revalidateOrgMatrix(orgId);

    return created;
  }

  // ──────────────────────────────────────────────────────────
  // Update — system immutability, self-lock (D.4), normalize, revalidate
  // ──────────────────────────────────────────────────────────

  async updateRole(
    orgId: string,
    slug: string,
    patch: UpdateRolePatch,
    caller: CallerContext,
  ): Promise<CustomRole> {
    // 1. Load target role
    const target = await this.repo.findBySlug(orgId, slug);
    if (!target) throw new NotFoundError("Rol");

    // 2. System role immutability (CR.2)
    if (target.isSystem) {
      throw new ForbiddenError(
        "No se puede modificar un rol del sistema",
        SYSTEM_ROLE_IMMUTABLE,
      );
    }

    // 3. Self-lock guard (D.4 / CR.6)
    //    If the caller's own role is the one being edited, the post-edit
    //    permissionsWrite MUST still contain "members". Otherwise the caller
    //    would lock themselves out of role administration.
    const callerRoleSlug = await this.getCallerRoleSlug(orgId, caller);
    if (callerRoleSlug !== null && callerRoleSlug === slug) {
      // Compute POST-edit permissionsWrite by merging patch onto current.
      const postEditWrite =
        patch.permissionsWrite !== undefined
          ? normalizeArray(patch.permissionsWrite)
          : target.permissionsWrite;

      if (!postEditWrite.includes("members")) {
        throw new ForbiddenError(
          "No podés quitarte a vos mismo la gestión de miembros",
          SELF_LOCK_GUARD,
        );
      }
    }

    // 4. Strip slug from incoming patch (D.5: slug immutable on UPDATE)
    const sanitizedPatch = dropSlug(patch) as UpdateRolePatch;

    // 5. Normalize arrays (D.11)
    const normalized: UpdateCustomRolePatch = {};
    if (sanitizedPatch.name !== undefined) normalized.name = sanitizedPatch.name;
    if (sanitizedPatch.description !== undefined) {
      normalized.description = sanitizedPatch.description;
    }
    if (sanitizedPatch.permissionsRead !== undefined) {
      normalized.permissionsRead = normalizeArray(sanitizedPatch.permissionsRead);
    }
    if (sanitizedPatch.permissionsWrite !== undefined) {
      normalized.permissionsWrite = normalizeArray(sanitizedPatch.permissionsWrite);
    }
    if (sanitizedPatch.canPost !== undefined) {
      normalized.canPost = normalizeArray(sanitizedPatch.canPost);
    }

    // 6. Update
    const updated = await this.repo.update(target.id, normalized);

    // 7. Revalidate cache
    this.revalidateOrgMatrix(orgId);

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // Delete — system immutability, member guard, revalidate
  // ──────────────────────────────────────────────────────────

  async deleteRole(
    orgId: string,
    slug: string,
    _caller: CallerContext,
  ): Promise<void> {
    // 1. Load target role
    const target = await this.repo.findBySlug(orgId, slug);
    if (!target) throw new NotFoundError("Rol");

    // 2. System role immutability (CR.2)
    if (target.isSystem) {
      throw new ForbiddenError(
        "No se puede eliminar un rol del sistema",
        SYSTEM_ROLE_IMMUTABLE,
      );
    }

    // 3. Member guard (CR.7)
    const memberCount = await this.repo.countMembers(slug, orgId);
    if (memberCount > 0) {
      throw new ConflictError(
        `No se puede eliminar: ${memberCount} miembro(s) tienen el rol "${slug}"`,
        ROLE_HAS_MEMBERS,
      );
    }

    // 4. Delete
    await this.repo.delete(target.id);

    // 5. Revalidate cache
    this.revalidateOrgMatrix(orgId);
  }
}
