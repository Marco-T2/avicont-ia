import "server-only";
import { z } from "zod";
import { defineTool } from "../llm";
import { ContactsService } from "@/features/contacts/server";
import type { ContactType } from "@/generated/prisma/client";

// ── Tool definition ──

export const findContactTool = defineTool({
  name: "findContact",
  description:
    "Busca contactos (proveedores, socios, transportistas) por nombre o NIT. " +
    "Devuelve hasta 10 coincidencias activas. Excluye clientes (no aplican a las " +
    "plantillas de gasto/depósito). Usá esta tool cuando el usuario mencione un " +
    "proveedor por nombre en una operación de compra. Si encuentra match exacto " +
    "único, viene en matchedExactly y podés usarlo directo sin preguntar al usuario.",
  inputSchema: z.object({
    query: z
      .string()
      .min(2, "La búsqueda debe tener al menos 2 caracteres")
      .max(100, "La búsqueda no puede superar los 100 caracteres")
      .describe("Texto a buscar en nombre o NIT del contacto"),
  }),
});

// ── Output type ──

export interface FindContactResultItem {
  id: string;
  name: string;
  nit: string | null;
  type: ContactType;
}

export interface FindContactResult {
  contacts: FindContactResultItem[];
  matchedExactly?: string;
}

// ── Executor ──

const RESULT_CAP = 10;
const EXCLUDED_TYPES: readonly ContactType[] = ["CLIENTE"];

export interface FindContactDeps {
  contactsService?: ContactsService;
}

export async function executeFindContact(
  organizationId: string,
  input: { query: string },
  deps: FindContactDeps = {},
): Promise<FindContactResult> {
  const contactsService = deps.contactsService ?? new ContactsService();

  const all = await contactsService.list(organizationId, {
    search: input.query,
    isActive: true,
  });

  const eligible = all.filter((c) => !EXCLUDED_TYPES.includes(c.type));
  const ranked = rankByMatchQuality(eligible, input.query).slice(0, RESULT_CAP);

  const result: FindContactResult = {
    contacts: ranked.map((c) => ({
      id: c.id,
      name: c.name,
      nit: c.nit,
      type: c.type,
    })),
  };

  // Match exacto único → permite que el LLM lo use sin pedir confirmación.
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
  // Orden estable: rank ASC (menor = mejor match), después name ASC.
  ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return ranked;
}

function computeRank(
  contact: { name: string; nit: string | null },
  q: string,
): number {
  const name = contact.name.toLowerCase();
  const nit = contact.nit?.toLowerCase() ?? "";
  if (name === q) return 0; // exact name
  if (nit === q && nit.length > 0) return 1; // exact nit
  if (name.startsWith(q)) return 2; // prefix name
  if (nit.startsWith(q) && nit.length > 0) return 3; // prefix nit
  return 4; // contains (search ya filtró por contains, así que todo lo restante cae acá)
}

// ── Re-export for tests ──
export type { RankedContact };
