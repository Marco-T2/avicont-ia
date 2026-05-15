import { requireAuth, handleError } from "@/features/shared/middleware";
import {
  requireOrgAccess,
  makeOrganizationsService,
} from "@/modules/organizations/presentation/server";
import {
  makeAgentService,
  makeAgentRateLimitService,
} from "@/modules/ai-agent/presentation/server";
import { makeExpenseService } from "@/modules/expense/presentation/server";
import { makeMortalityService } from "@/modules/mortality/presentation/server";
import { createExpenseSchema } from "@/modules/expense/presentation/server";
import { logMortalitySchema } from "@/modules/mortality/presentation/server";
import {
  agentQuerySchema,
  confirmActionSchema,
  createJournalEntryConfirmSchema,
  type CreateJournalEntryConfirmInput,
} from "@/modules/ai-agent/presentation/server";
import { requirePermission } from "@/features/permissions/server";
import {
  makeJournalsService,
  parseEntryDate,
  formatCorrelativeNumber,
} from "@/modules/accounting/presentation/server";
import { makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import {
  ValidationError,
  FISCAL_PERIOD_CLOSED,
} from "@/features/shared/errors";
import { logStructured } from "@/lib/logging/structured";

const orgService = makeOrganizationsService();
const agentService = makeAgentService();
const rateLimitService = makeAgentRateLimitService();
const expensesService = makeExpenseService();
const mortalityService = makeMortalityService();
const journalService = makeJournalsService();
const voucherTypesService = makeVoucherTypesService();
const fiscalPeriodsService = makeFiscalPeriodsService();

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

    // ── Telemetry action — frontend reporta eventos del modal de captura asistida ──
    // Eventos como journal_ai_abandoned se emiten desde el cliente cuando el
    // usuario cierra el modal sin confirmar. El backend los pasa a logStructured
    // junto con orgId/userId para análisis de adopción (¿la gente abre el modal
    // y no termina creando el asiento?). Set restringido — no es un sink general.
    if (action === "telemetry") {
      return await handleTelemetry(request, organizationId, member.user.id, member.role);
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
          data: log.toJSON(),
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
  const voucherType = (
    await voucherTypesService.getByCode(organizationId, voucherTypeCode)
  ).toSnapshot();

  // Resolver fecha → periodId. Extraemos solo la parte de fecha calendario
  // (YYYY-MM-DD) e ignoramos el componente de tiempo y offset. Esto evita que
  // un asiento de "30 de abril 11pm hora La Paz" — que en UTC son las 3am
  // del 1 de mayo — caiga en el período del día siguiente. El form normal y
  // el modal serializan como YYYY-MM-DD; esta normalización es resiliente al
  // caso donde el LLM (o un cliente futuro) mande datetime con offset.
  const date = parseEntryDate(validated.date);
  const period = (await fiscalPeriodsService.findByDate(organizationId, date))?.toSnapshot();
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

  // El 3er arg `audit` (AuditUserContext) lo exige la firma del hex
  // `JournalsService.createEntry` — la UoW lo usa para el scope de la tx.
  // El shim legacy lo derivaba internamente de `input.createdById`; al
  // repuntar directo al hex hay que pasarlo explícito. Mismo patrón que
  // `journal/route.ts` (`{ userId: user.id }`).
  const entry = await journalService.createEntry(
    organizationId,
    {
      date,
      description: validated.description,
      periodId: period.id,
      voucherTypeId: voucherType.id,
      contactId: getContactId(validated),
      sourceType: "ai",                       // marca "Generado por IA" en la columna Origen
      aiOriginalText: validated.originalText, // texto crudo, inmutable post-creación
      createdById: userId,
      lines,
    },
    { userId },
  );

  // El hex `createEntry` devuelve el aggregate `Journal`, cuyo getter
  // `number` es `number | null` (un DRAFT recién creado puede no tener
  // correlativo asignado todavía). El shim legacy devolvía el DTO
  // `JournalEntryWithLines` re-hidratado vía `getById`, cuyo `number` ya
  // era `number` no-nullable — de ahí que esto tipara antes. Guardamos el
  // null igual que `formatCorrelativeNumber` hace con un prefix inválido:
  // sin número, `displayNumber` es null.
  const displayNumber =
    entry.number !== null
      ? formatCorrelativeNumber(voucherType.prefix, entry.date, entry.number)
      : null;

  // `journalService.createEntry()` (hex) devuelve el AGGREGATE `Journal`, no el
  // DTO plano que devolvía el shim legacy. El aggregate expone sus campos solo
  // vía getters no-enumerables sobre un `props` privado — spreadear la instancia
  // (`{ ...entry }`) daría un objeto VACÍO. `entry.toSnapshot()` da el shape
  // plano y serializable que la respuesta JSON necesita (date/number/sourceType/
  // aiOriginalText/lines + resto de campos), preservando la parity del DTO
  // legacy. Decisión lockeada (design #2422 D2): toSnapshot() en vez de un
  // helper `getById()` de re-hidratación — la respuesta solo necesita los campos
  // escalares + lines que el snapshot ya carga.
  return Response.json(
    {
      message: `Borrador creado: ${displayNumber}`,
      data: { ...entry.toSnapshot(), displayNumber },
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

// ── Telemetry handler ──────────────────────────────────────────────────────
//
// Eventos permitidos del modal de captura asistida. Lista cerrada — cualquier
// otro nombre se rechaza con 400. journal_ai_parsed y journal_ai_correction
// los emite el backend desde agent.service; el frontend solo emite los que
// requieren observación del lado cliente (cierre del modal sin confirmar).
const ALLOWED_TELEMETRY_EVENTS = new Set(["journal_ai_abandoned"]);

async function handleTelemetry(
  request: Request,
  organizationId: string,
  userId: string,
  role: string,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { event?: unknown };
  const event = typeof body.event === "string" ? body.event : null;
  if (!event || !ALLOWED_TELEMETRY_EVENTS.has(event)) {
    return Response.json({ error: "Evento de telemetría no permitido." }, { status: 400 });
  }

  logStructured({
    event,
    level: "info",
    mode: "journal-entry-ai",
    orgId: organizationId,
    userId,
    role,
  });

  return Response.json({ ok: true });
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
