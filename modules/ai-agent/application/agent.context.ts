import type { Role } from "@/modules/permissions/domain/permissions";
import type { AgentContextReaderPort } from "../domain/ports/agent-context-reader.port";
import type { RagPort } from "../domain/ports/rag.port";

export interface AgentContextDeps {
  contextReader: AgentContextReaderPort;
  rag: RagPort;
}

/**
 * Construye el string de contexto para el system prompt según el rol del usuario.
 * Recibe los ports vía deps (R5 absoluta — no module singletons).
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export async function buildAgentContext(
  deps: AgentContextDeps,
  orgId: string,
  userId: string,
  role: Role,
): Promise<string> {
  const parts: string[] = [];

  if (role === "member" || role === "admin" || role === "owner") {
    parts.push(await buildSocioContext(deps.contextReader, orgId, userId, role));
  }

  if (role === "contador" || role === "admin" || role === "owner") {
    parts.push(await buildContadorContext(deps.contextReader, orgId));
  }

  return parts.join("\n\n");
}

// ── RAG context: semantic search over documents ──

export async function buildRagContext(
  rag: RagPort,
  orgId: string,
  query: string,
  role: Role,
): Promise<string> {
  const { getRagScopes } = await import("../../permissions/domain/permissions.ts");
  const { logStructured } = await import("../../../lib/logging/structured.ts");

  const scopes = getRagScopes(role);
  if (!scopes) return "";

  try {
    const raw = await rag.search(query, orgId, scopes as string[], 5);
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
    logStructured({
      event: "agent_rag_context_error",
      level: "error",
      orgId,
      role,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
    });
    return "";
  }
}

// ── Socio context: farms, lots, recent expenses ──

async function buildSocioContext(
  contextReader: AgentContextReaderPort,
  orgId: string,
  userId: string,
  role: Role,
): Promise<string> {
  let memberId: string | undefined;
  if (role === "member") {
    const id = await contextReader.findMemberIdByUserId(orgId, userId);
    memberId = id ?? "__no_member__";
  }

  const farms = await contextReader.findFarmsWithActiveLots(orgId, memberId);
  const recentExpenses = await contextReader.findRecentExpenses(orgId, 5, memberId);

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
        lines.push(`  - Lote: ${lot.name} (ID: ${lot.id})`);
      }
    }
  }

  if (recentExpenses.length > 0) {
    lines.push("", "### Gastos recientes:");
    for (const exp of recentExpenses) {
      lines.push(
        `  - Bs. ${Number(exp.amount).toFixed(2)} - ${exp.category} (${exp.date.toISOString().split("T")[0]})`,
      );
    }
  }

  return lines.join("\n");
}

// ── Contador context: accounts, journal entries ──

async function buildContadorContext(
  contextReader: AgentContextReaderPort,
  orgId: string,
): Promise<string> {
  const journalCount = await contextReader.countJournalEntries(orgId);

  const lines: string[] = [
    "## Datos Contables",
    "",
    `Comprobantes registrados: ${journalCount}`,
    "",
    "Nota: El plan de cuentas NO está precargado.",
  ];

  return lines.join("\n");
}
