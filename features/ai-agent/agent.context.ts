import type { Role } from "@/features/permissions";
import { getRagScopes } from "@/features/permissions";
import { RagService } from "@/features/rag/server";
import { AgentContextRepository } from "./agent-context.repository";

const ragService = new RagService();
const contextRepo = new AgentContextRepository();

/**
 * Construye el string de contexto para el system prompt de Gemini según el rol del usuario y los datos de la org.
 * Le da a Gemini conciencia de qué datos existen para que pueda referenciar IDs y nombres.
 */
export async function buildAgentContext(
  orgId: string,
  userId: string,
  role: Role,
): Promise<string> {
  const parts: string[] = [];

  if (role === "member" || role === "admin" || role === "owner") {
    parts.push(await buildSocioContext(orgId, userId, role));
  }

  if (role === "contador" || role === "admin" || role === "owner") {
    parts.push(await buildContadorContext(orgId));
  }

  return parts.join("\n\n");
}

// ── RAG context: semantic search over documents ──

export async function buildRagContext(
  orgId: string,
  query: string,
  role: Role,
): Promise<string> {
  const scopes = getRagScopes(role);
  if (!scopes) return "";

  try {
    const raw = await ragService.search(query, orgId, scopes, 5);
    const results = raw.filter((r) => r.score >= 0.35);

    if (results.length === 0) return "";

    const lines: string[] = [
      "## Contexto de Documentos (RAG)",
      "",
      "Los siguientes fragmentos de documentos son relevantes para la consulta:",
      "",
    ];

    for (const result of results) {
      lines.push(`> ${result.content}`);
      lines.push("");
    }

    return lines.join("\n");
  } catch (err) {
    console.error("RAG context error:", err);
    return "";
  }
}

// ── Socio context: farms, lots, recent expenses ──

async function buildSocioContext(
  orgId: string,
  userId: string,
  role: Role,
): Promise<string> {
  // Privacy boundary: a `member` socio must only see their own farms / lots
  // / expenses, not the rest of the org. `admin` and `owner` see everything
  // (memberId stays undefined → no filter applied at the repo layer).
  //
  // If a member has no active OrganizationMember row (data inconsistency or
  // mid-deactivation), we fail closed: empty memberId filter would show
  // everything; `__no_member__` matches nothing, which is the safe default.
  let memberId: string | undefined;
  if (role === "member") {
    const id = await contextRepo.findMemberIdByUserId(orgId, userId);
    memberId = id ?? "__no_member__";
  }

  const farms = await contextRepo.findFarmsWithActiveLots(orgId, memberId);
  const recentExpenses = await contextRepo.findRecentExpenses(orgId, 5, memberId);

  const activeLotCount = farms.reduce((sum, f) => sum + f.lots.length, 0);

  const lines: string[] = [
    "## Datos del Socio",
    "",
    `Granjas registradas: ${farms.length}`,
    `Lotes activos: ${activeLotCount}`,
    "",
  ];

  for (const farm of farms) {
    lines.push(`### Granja: ${farm.name} (ID: ${farm.id})`);
    if (farm.lots.length === 0) {
      lines.push("  Sin lotes activos");
    } else {
      for (const lot of farm.lots) {
        lines.push(
          `  - Lote: ${lot.name}, Galpón #${lot.barnNumber}, ${lot.initialCount} pollos iniciales (ID: ${lot.id})`,
        );
      }
    }
  }

  if (recentExpenses.length > 0) {
    lines.push("", "### Gastos recientes:");
    for (const exp of recentExpenses) {
      lines.push(
        `  - Bs. ${Number(exp.amount).toFixed(2)} - ${exp.category} - ${exp.lot.name} (${exp.date.toISOString().split("T")[0]})`,
      );
    }
  }

  return lines.join("\n");
}

// ── Contador context: accounts, journal entries ──

async function buildContadorContext(orgId: string): Promise<string> {
  const journalCount = await contextRepo.countJournalEntries(orgId);

  const lines: string[] = [
    "## Datos Contables",
    "",
    `Comprobantes registrados: ${journalCount}`,
    "",
    "Nota: El plan de cuentas NO está precargado. Usá la herramienta 'listAccounts' si necesitás consultar cuentas específicas, o basate en los documentos disponibles vía RAG.",
  ];

  return lines.join("\n");
}
