/**
 * roles.validation.ts — Pure validation utilities for custom roles.
 *
 * Scope: D.5 — Slug strategy (slugify, reserved list, collision suffix -2..-99).
 * NO DB access in this file. The service layer composes these with the repository.
 *
 * Error code naming: spec wins over design —
 *   - RESERVED_SLUG (422 ValidationError) — reserved slug on CREATE
 *   - SLUG_TAKEN (409 ConflictError) — collision could not be resolved with -2..-99
 */
import { isSystemRole } from "@/features/permissions";
import {
  ValidationError,
  ConflictError,
  RESERVED_SLUG,
  SLUG_TAKEN,
} from "@/features/shared/errors";

const MAX_SLUG_LENGTH = 32;
const MAX_COLLISION_SUFFIX = 99;

/**
 * Derive a URL-safe slug from a human-readable name.
 *
 * Steps (D.5):
 *  1. lowercase + trim
 *  2. NFKD normalize + strip diacritics (combining marks)
 *  3. replace non-[a-z0-9]+ runs with "-"
 *  4. collapse repeated "-"
 *  5. trim leading/trailing "-"
 *  6. cap length at 32 characters, then re-trim trailing "-" (in case the
 *     slice landed on a separator)
 */
export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    // Strip combining diacritical marks (U+0300..U+036F)
    .replace(/[\u0300-\u036f]/g, "")
    // Any run of non-alphanumeric characters becomes a single "-"
    .replace(/[^a-z0-9]+/g, "-")
    // Collapse any remaining repeats (defensive)
    .replace(/-+/g, "-")
    // Strip leading/trailing dashes
    .replace(/^-+|-+$/g, "");

  if (base.length <= MAX_SLUG_LENGTH) return base;

  // Truncate and re-trim trailing dash if cut landed on a separator
  return base.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
}

/**
 * Guard: reject the 5 system slugs on CREATE.
 * System slugs belong to isSystem=true rows only — admins may not create a
 * custom role that collides with them.
 *
 * On UPDATE the slug is immutable (D.5), so this check is only relevant at
 * the CREATE step.
 */
export function assertNotReserved(slug: string): void {
  if (isSystemRole(slug)) {
    throw new ValidationError(
      `El slug "${slug}" está reservado por el sistema`,
      RESERVED_SLUG,
    );
  }
}

/**
 * Resolve a unique slug within an org by appending "-2", "-3", ..., "-99" on
 * collision. Throws ConflictError(SLUG_TAKEN) if every suffix up to 99 is
 * already taken.
 *
 * Pure function — caller is responsible for passing a Set of existing slugs
 * in the org (typically derived from `rolesRepository.findAllByOrg`).
 */
export function resolveUniqueSlug(
  base: string,
  existingSlugs: Set<string>,
): string {
  if (!existingSlugs.has(base)) return base;

  for (let i = 2; i <= MAX_COLLISION_SUFFIX; i++) {
    const candidate = `${base}-${i}`;
    if (!existingSlugs.has(candidate)) return candidate;
  }

  throw new ConflictError(
    `No se pudo resolver un slug único para "${base}" (límite ${MAX_COLLISION_SUFFIX})`,
    SLUG_TAKEN,
  );
}

