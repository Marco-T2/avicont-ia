import { requireAuth, handleError } from "@/features/shared/middleware";
import {
  requireOrgAccess,
  OrganizationsService,
} from "@/features/organizations/server";
import {
  AgentService,
  AgentRateLimitService,
} from "@/features/ai-agent/server";
import { ExpensesService } from "@/features/expenses/server";
import { MortalityService } from "@/features/mortality/server";
import { createExpenseSchema } from "@/features/expenses/server";
import { logMortalitySchema } from "@/features/mortality/server";
import {
  agentQuerySchema,
  confirmActionSchema,
  createJournalEntryConfirmSchema,
  type CreateJournalEntryConfirmInput,
} from "@/features/ai-agent/server";
import { requirePermission } from "@/features/permissions/server";
import { JournalService } from "@/features/accounting/server";
import { VoucherTypesService } from "@/features/voucher-types/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import {
  ValidationError,
  FISCAL_PERIOD_CLOSED,
} from "@/features/shared/errors";
import { formatCorrelativeNumber } from "@/features/accounting/server";
import { logStructured } from "@/lib/logging/structured";

const orgService = new OrganizationsService();
const agentService = new AgentService();
const rateLimitService = new AgentRateLimitService();
const expensesService = new ExpensesService();
const mortalityService = new MortalityService();
const journalService = new JournalService();
const voucherTypesService = new VoucherTypesService();
const fiscalPeriodsService = new FiscalPeriodsService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const organizationId = await requireOrgAccess(clerkUserId, orgSlug);

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    const member = await orgService.getMemberWithUserByClerkUserId(
      organizationId,
      clerkUserId,
    );

    // ── Confirm action ──
    // await es necesario: sin él, el try/catch de POST no captura rejections
    // de handleConfirm (la promesa retornada NO se awaitea). Bug que vivía
    // latente — todos los tests de confirm asumían happy path.
    if (action === "confirm") {
      return await handleConfirm(request, organizationId, member.user.id, orgSlug);
    }

    // ── Query agent ──
    const body = await request.json();
    const parsed = agentQuerySchema.parse(body);

    // RBAC fino para mode='journal-entry-ai': la captura asistida CREA asientos,
    // así que requiere journal:write. Gatear ANTES del rate limit y del service
    // call para no gastar tokens de Gemini en roles sin permiso. mode='chat'
    // (default) no necesita journal:write — sigue el flow original con tools por rol.
    if (parsed.mode === "journal-entry-ai") {
      await requirePermission("journal", "write", orgSlug);
    }

    // Rate limit gate. Per-user and per-org hourly buckets, configurable via
    // env. Fails open on DB errors (logged inside the service) — accounting
    // is the priority, the agent must not block on a rate-limit outage.
    const decision = await rateLimitService.check(
      organizationId,
      member.user.id,
    );
    if (!decision.allowed) {
      logStructured({
        event: "agent_rate_limited",
        level: "info",
        orgId: organizationId,
        userId: member.user.id,
        scope: decision.scope,
        limit: decision.limit,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
      return Response.json(
        {
          error: "rate_limit_exceeded",
          scope: decision.scope,
          limit: decision.limit,
          retryAfterSeconds: decision.retryAfterSeconds,
          message:
            decision.scope === "user"
              ? `Excediste el límite de ${decision.limit} consultas por hora. Intentá de nuevo en ${decision.retryAfterSeconds} segundos.`
              : `Tu organización excedió el límite de ${decision.limit} consultas por hora. Intentá de nuevo en ${decision.retryAfterSeconds} segundos.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(decision.retryAfterSeconds) },
        },
      );
    }

    const response = await agentService.query(
      organizationId,
      member.user.id,
      member.role,
      parsed.prompt,
      parsed.session_id,
      parsed.mode,
      parsed.contextHints,
    );

    return Response.json(response);
  } catch (error) {
    return handleError(error);
  }
}

// ── Confirm handler: execute the suggested action ──

async function handleConfirm(
  request: Request,
  organizationId: string,
  userId: string,
  orgSlug: string,
): Promise<Response> {
  const body = await request.json();
  const { suggestion } = confirmActionSchema.parse(body);

  switch (suggestion.action) {
    case "createExpense": {
      const d = suggestion.data;
      const validated = createExpenseSchema.parse({
        amount: d.amount,
        category: d.category,
        description: d.description,
        date: d.date,
        lotId: d.lotId,
      });
      const expense = await expensesService.create(organizationId, {
        ...validated,
        createdById: userId,
      });
      return Response.json(
        {
          message: "Gasto registrado exitosamente.",
          data: expense,
        },
        { status: 201 },
      );
    }

    case "logMortality": {
      const d = suggestion.data;
      const validated = logMortalitySchema.parse({
        count: d.count,
        cause: d.cause,
        date: d.date,
        lotId: d.lotId,
      });
      const log = await mortalityService.log(organizationId, {
        ...validated,
        createdById: userId,
      });
      return Response.json(
        {
          message: "Mortalidad registrada exitosamente.",
          data: log,
        },
        { status: 201 },
      );
    }

    case "createJournalEntry":
      return handleCreateJournalEntryConfirm(
        suggestion.data,
        organizationId,
        userId,
        orgSlug,
      );

    default:
      return Response.json(
        { error: `Acción no confirmable: ${suggestion.action}` },
        { status: 400 },
      );
  }
}

// ── Create journal entry (modo captura asistida con IA) ──
//
// El usuario confirmó la sugerencia desde el modal. Validamos el shape contra
// journalEntryAiInputSchema (defensa en profundidad — el modal puede haber
// editado los campos, no nos confiamos del input previo del agente). Resolvemos
// voucherTypeId desde el code (CE | CI) y periodId desde la fecha. Llamamos a
// journalService.createEntry con sourceType='ai' y aiOriginalText para que la
// columna de origen del Libro Diario muestre "Generado por IA" y el texto crudo
// del usuario quede persistido.
async function handleCreateJournalEntryConfirm(
  data: Record<string, unknown>,
  organizationId: string,
  userId: string,
  orgSlug: string,
): Promise<Response> {
  // RBAC: journal:write. Defensa en profundidad — el path mode='journal-entry-ai'
  // ya gatea, pero el confirm puede llegar por otra vía (ej. cliente HTTP custom).
  await requirePermission("journal", "write", orgSlug);

  // Validación del shape del payload del confirm. El modal pudo haber editado
  // campos antes de confirmar — defensa en profundidad. Metadata de display
  // (resolvedAccounts, resolvedContact, voucherTypeCode) se acepta y se ignora.
  const validated = createJournalEntryConfirmSchema.parse(data);

  // Resolver voucherTypeCode → voucherTypeId desde el catálogo del seed.
  const voucherTypeCode = deriveVoucherTypeCode(validated.template);
  const voucherType = await voucherTypesService.getByCode(
    organizationId,
    voucherTypeCode,
  );

  // Resolver fecha → periodId. Extraemos solo la parte de fecha calendario
  // (YYYY-MM-DD) e ignoramos el componente de tiempo y offset. Esto evita que
  // un asiento de "30 de abril 11pm hora La Paz" — que en UTC son las 3am
  // del 1 de mayo — caiga en el período del día siguiente. El form normal y
  // el modal serializan como YYYY-MM-DD; esta normalización es resiliente al
  // caso donde el LLM (o un cliente futuro) mande datetime con offset.
  const date = parseEntryDate(validated.date);
  const period = await fiscalPeriodsService.findByDate(organizationId, date);
  if (!period) {
    throw new ValidationError(
      `No existe un período fiscal para la fecha ${validated.date}. Pedí al admin que lo abra primero.`,
    );
  }
  if (period.status !== "OPEN") {
    throw new ValidationError(
      `El período fiscal de ${validated.date} está cerrado. No se pueden crear asientos.`,
      FISCAL_PERIOD_CLOSED,
    );
  }

  // El builder ya armó las lines en orden estable (débito primero). Mapeamos
  // agregando `order` para satisfacer el shape del repo (asientos generados
  // tienen orden determinístico por construcción).
  const lines = validated.lines.map((line, idx) => ({
    accountId: line.accountId,
    debit: line.debit,
    credit: line.credit,
    order: idx,
  }));

  const entry = await journalService.createEntry(organizationId, {
    date,
    description: validated.description,
    periodId: period.id,
    voucherTypeId: voucherType.id,
    contactId: getContactId(validated),
    sourceType: "ai",                       // marca "Generado por IA" en la columna Origen
    aiOriginalText: validated.originalText, // texto crudo, inmutable post-creación
    createdById: userId,
    lines,
  });

  const displayNumber = formatCorrelativeNumber(
    voucherType.prefix,
    entry.date,
    entry.number,
  );

  return Response.json(
    {
      message: `Borrador creado: ${displayNumber}`,
      data: { ...entry, displayNumber },
    },
    { status: 201 },
  );
}

function deriveVoucherTypeCode(template: string): "CE" | "CI" {
  switch (template) {
    case "expense_bank_payment":
    case "expense_cash_payment":
      return "CE";
    case "bank_deposit":
      return "CI";
    default:
      throw new ValidationError(`Template desconocido: ${template}`);
  }
}

function parseEntryDate(rawDate: string): Date {
  // Extrae YYYY-MM-DD del string ISO (descarta tiempo y offset). El día
  // extraído se interpreta como "fecha calendario" y se construye como UTC
  // midnight — alineado con cómo FiscalPeriodsService persiste el month
  // (getUTCMonth desde startDate mandado como YYYY-MM-DD por el seed).
  const dateOnly = rawDate.split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new ValidationError(
      `La fecha del asiento es inválida (recibido: "${rawDate}").`,
    );
  }
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(
      `La fecha del asiento es inválida (recibido: "${rawDate}").`,
    );
  }
  return parsed;
}

function getContactId(
  validated: CreateJournalEntryConfirmInput,
): string | undefined {
  if (
    validated.template === "expense_bank_payment" ||
    validated.template === "expense_cash_payment"
  ) {
    return validated.contactId;
  }
  return undefined;
}
