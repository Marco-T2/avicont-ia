import type { ModuleHintValue } from "@/modules/ai-agent/domain/types/module-hint.types";

/**
 * Derive a module hint from the current dashboard pathname.
 * Pathname convention: `/<orgSlug>/<moduleSegment>/...`.
 *
 * - /<orgSlug>/accounting/...           -> "accounting"
 * - /<orgSlug>/farms/... | /lots/...    -> "farm"
 * - anything else (incl. root, sales, purchases, documents, etc.)  -> null
 *
 * PURE. No React, no usePathname. Test with plain string fixtures.
 *
 * If i18n is added (e.g. /es/<orgSlug>/...), revisit this — currently the
 * dashboard layout is at app/(dashboard)/[orgSlug]/ with no locale segment.
 */
export function deriveModuleHint(pathname: string): ModuleHintValue {
  // pathname like "/acme/accounting/journals" -> segments = ["", "acme", "accounting", "journals"]
  const segments = pathname.split("/");
  const moduleSegment = segments[2]; // 0 = "", 1 = orgSlug, 2 = module
  if (moduleSegment === "accounting") return "accounting";
  if (moduleSegment === "farms" || moduleSegment === "lots") return "farm";
  return null;
}
