/**
 * Tag domain types — REQ-40, REQ-44.
 *
 * Slug derivation is server-side (REQ-44); CreateTagInput intentionally
 * excludes `slug` so the service layer cannot accept client-provided slugs.
 * Persisted shape is established by Tag (id, slug, createdAt populated by infra).
 */
export interface Tag {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  color: string | null;
  createdAt: Date;
}

export interface CreateTagInput {
  organizationId: string;
  name: string;
  color?: string;
}
