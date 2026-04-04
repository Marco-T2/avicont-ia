import type { Role } from "@/features/shared/permissions";
import { getRagScopes } from "@/features/shared/permissions";
import { RagService } from "@/features/rag";
import { AgentContextRepository } from "./agent-context.repository";

const ragService = new RagService();
const contextRepo = new AgentContextRepository();

/**
 * Build context string for the Gemini system prompt based on user role and org data.
 * This gives Gemini awareness of what data exists so it can reference IDs and names.
 */
export async function buildAgentContext(
  orgId: string,
  userId: string,
  role: Role,
): Promise<string> {
  const parts: string[] = [];

  if (role === "member" || role === "admin" || role === "owner") {
    parts.push(await buildSocioContext(orgId, userId));
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
    const results = await ragService.search(query, orgId, scopes, 5);

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
  _userId: string,
): Promise<string> {
  const farms = await contextRepo.findFarmsWithActiveLots(orgId);
  const recentExpenses = await contextRepo.findRecentExpenses(orgId, 5);

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
  const accounts = await contextRepo.findActiveAccounts(orgId);
  const journalCount = await contextRepo.countJournalEntries(orgId);

  const lines: string[] = [
    "## Datos Contables",
    "",
    `Cuentas activas: ${accounts.length}`,
    `Comprobantes registrados: ${journalCount}`,
    "",
    "### Plan de Cuentas:",
  ];

  for (const acc of accounts) {
    const indent = "  ".repeat(acc.level);
    lines.push(`${indent}${acc.code} - ${acc.name} (${acc.type}, ID: ${acc.id})`);
  }

  return lines.join("\n");
}
