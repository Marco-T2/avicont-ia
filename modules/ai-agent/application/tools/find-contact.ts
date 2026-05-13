import type { makeContactsService } from "@/modules/contacts/presentation/server";
import type { ContactType } from "@/generated/prisma/client";
import type {
  FindContactResult,
  FindContactResultItem,
} from "../../domain/tools/tool-output.types";

// ── Executor ──

const RESULT_CAP = 10;
const EXCLUDED_TYPES: readonly ContactType[] = ["CLIENTE"];

export interface FindContactDeps {
  contactsService?: ReturnType<typeof makeContactsService>;
}

/**
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export async function executeFindContact(
  organizationId: string,
  input: { query: string },
  deps: FindContactDeps = {},
): Promise<FindContactResult> {
  let contactsService = deps.contactsService;
  if (!contactsService) {
    const { makeContactsService: factory } = await import("@/modules/contacts/presentation/server");
    contactsService = factory();
  }

  const all = await contactsService.list(organizationId, {
    search: input.query,
    isActive: true,
  });

  const eligible = all.filter((c) => !EXCLUDED_TYPES.includes(c.type));
  const ranked = rankByMatchQuality(eligible, input.query).slice(0, RESULT_CAP);

  const result: FindContactResult = {
    contacts: ranked.map((c): FindContactResultItem => ({
      id: c.id,
      name: c.name,
      nit: c.nit,
      type: c.type,
    })),
  };

  const exactName = eligible.filter(
    (c) => c.name.toLowerCase() === input.query.toLowerCase(),
  );
  const exactNit = eligible.filter((c) => c.nit && c.nit === input.query);
  const exactMatches = [...new Set([...exactName, ...exactNit].map((c) => c.id))];
  if (exactMatches.length === 1) {
    result.matchedExactly = exactMatches[0];
  }

  return result;
}

// ── Helpers ──

interface RankedContact {
  id: string;
  name: string;
  nit: string | null;
  type: ContactType;
  rank: number;
}

function rankByMatchQuality<T extends { id: string; name: string; nit: string | null; type: ContactType }>(
  contacts: T[],
  query: string,
): T[] {
  const q = query.toLowerCase();
  const ranked: Array<T & { rank: number }> = contacts.map((c) => ({
    ...c,
    rank: computeRank(c, q),
  }));
  ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return ranked;
}

function computeRank(
  contact: { name: string; nit: string | null },
  q: string,
): number {
  const name = contact.name.toLowerCase();
  const nit = contact.nit?.toLowerCase() ?? "";
  if (name === q) return 0;
  if (nit === q && nit.length > 0) return 1;
  if (name.startsWith(q)) return 2;
  if (nit.startsWith(q) && nit.length > 0) return 3;
  return 4;
}

export type { RankedContact };
