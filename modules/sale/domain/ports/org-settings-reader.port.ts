import type { OrgSettings } from "@/modules/org-settings/domain/org-settings.entity";

/**
 * Read port for org-settings as consumed by sale-hex use cases (createDraft,
 * post, regenerateJournalForIvaChange). Sale-hex declares this port instead
 * of importing `OrgSettingsService` directly so the application layer remains
 * decoupled from another module's application layer (R2 §3 ports-only).
 *
 * The adapter (A3) wraps `modules/org-settings/application/OrgSettingsService.
 * getOrCreate` — that service composes `findByOrgId + createDefault + save`,
 * so the lazy-create side-effect is contained inside org-settings, not
 * duplicated here. Decision §13 lockeada Step 0 A2 (Opción C).
 */
export interface OrgSettingsReaderPort {
  /**
   * Returns the org's settings, creating defaults on first access. Lazy-create
   * is owned by the adapter — sale-hex sees a total function.
   */
  getOrCreate(organizationId: string): Promise<OrgSettings>;
}
