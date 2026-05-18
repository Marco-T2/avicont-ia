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
  // REQ-42/43 — optional tag slugs from the searchDocuments tool input. When
  // present, RagPort.search filters with AND-semantics (resolved slug -> id
  // in LegacyRagAdapter; JOIN+HAVING in VectorRepository).
  tags?: string[],
): Promise<string> {
  const { getRagScopes } = await import("../../permissions/domain/permissions.ts");
  const { logStructured } = await import("../../../lib/logging/structured.ts");

  const scopes = getRagScopes(role);
  if (!scopes) return "";

  try {
    const raw = await rag.search(query, orgId, scopes as string[], 5, tags);
    const results = raw.filter((r) => r.score >= 0.35);

    if (results.length === 0) return "";

    const lines: string[] = [
      "## Contexto de Documentos (RAG)",
      "",
      "Los siguientes fragmentos de documentos son relevantes para la consulta:",
      "",
    ];

    // REQ-32 — citation prefix per snippet. `[{documentName}#{sectionRef}]`
    // where sectionRef is `sectionPath` when present else `chunk ${chunkIndex}`.
    // Both the LLM-loop path AND the REQ-25 bypass path (which returns this
    // text directly) emit verifiable citation tokens. Token regex:
    // `^\[[^#\n]+#[^\]\n]+\]` (multiline) — locked α-sentinel in C1.4.
    for (const result of results) {
      const { documentName, chunkIndex, sectionPath } = result.metadata;
      const sectionRef = sectionPath ?? `chunk ${chunkIndex}`;
      lines.push(`[${documentName}#${sectionRef}]`);
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

// ── Socio context: lots, recent expenses ──

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

  // Post retire-farm-collapse-to-lot (D-3): port returns flat `ActiveLot[]`
  // con `farmName` como texto libre. Agrupamos client-side acá para preservar
  // el rendering "## Granja: X" cuando hay ≥1 farmName distinta.
  const activeLots = await contextReader.findActiveLotsByMember(orgId, memberId);
  const recentExpenses = await contextReader.findRecentExpenses(orgId, 5, memberId);

  const groupedByFarm = new Map<string, typeof activeLots>();
  for (const lot of activeLots) {
    const key = lot.farmName;
    const bucket = groupedByFarm.get(key) ?? [];
    bucket.push(lot);
    groupedByFarm.set(key, bucket);
  }

  const lines: string[] = [
    "## Datos del Socio",
    "",
    `Granjas registradas: ${groupedByFarm.size}`,
    `Lotes activos: ${activeLots.length}`,
    "",
  ];

  for (const [farmName, lots] of groupedByFarm) {
    lines.push(`### Granja: ${farmName}`);
    for (const lot of lots) {
      // Post simplify-lot-identifier: surface the derived identifier
      // ("{farmName} - DD/MM/YYYY") so the LLM picks the same handle
      // the user sees in the UI.
      lines.push(`  - Lote: ${lot.displayName} (ID: ${lot.id})`);
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
