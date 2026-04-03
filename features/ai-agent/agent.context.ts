import { prisma } from "@/lib/prisma";
import type { AgentRole } from "./agent.types";

/**
 * Build context string for the Gemini system prompt based on user role and org data.
 * This gives Gemini awareness of what data exists so it can reference IDs and names.
 */
export async function buildAgentContext(
  orgId: string,
  userId: string,
  role: AgentRole,
): Promise<string> {
  const parts: string[] = [];

  if (role === "socio" || role === "admin") {
    parts.push(await buildSocioContext(orgId, userId));
  }

  if (role === "contador" || role === "admin") {
    parts.push(await buildContadorContext(orgId));
  }

  return parts.join("\n\n");
}

// ── Socio context: farms, lots, recent expenses ──

async function buildSocioContext(
  orgId: string,
  _userId: string,
): Promise<string> {
  const farms = await prisma.farm.findMany({
    where: { organizationId: orgId },
    include: {
      lots: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          barnNumber: true,
          initialCount: true,
          startDate: true,
          status: true,
        },
      },
    },
  });

  const recentExpenses = await prisma.expense.findMany({
    where: { organizationId: orgId },
    orderBy: { date: "desc" },
    take: 5,
    select: {
      amount: true,
      category: true,
      date: true,
      lot: { select: { name: true } },
    },
  });

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
  const accounts = await prisma.account.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      level: true,
    },
    orderBy: { code: "asc" },
  });

  const journalCount = await prisma.journalEntry.count({
    where: { organizationId: orgId },
  });

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
