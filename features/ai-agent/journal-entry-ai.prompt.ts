// System prompt y formateador de catálogo para el modo "captura asistida"
// (botón "+ Crear Asiento con IA" en /accounting/journal).
//
// Single-turn, single-tool: el LLM tiene acceso únicamente a
// parseAccountingOperationToSuggestion. Las cuentas/proveedores válidos
// vienen pre-cargados en el system prompt vía contextHints — el LLM NO
// llama tools de lookup. Decisión arquitectónica: este feature es un
// parser asistido (clasificación + slot filling), no un agente. El
// catálogo en el prompt es mejor anti-alucinación que tools de lookup
// (el LLM copia de fuente literal en vez de inventar queries).

// ── Tipos del contextHints esperado ──

export interface JournalEntryAiCatalogAccount {
  id: string;
  code: string;
  name: string;
  requiresContact?: boolean;
}

export interface JournalEntryAiCatalogContact {
  id: string;
  name: string;
  nit: string | null;
}

export interface JournalEntryAiContextHints {
  catalog?: {
    bank?: JournalEntryAiCatalogAccount[];
    cash?: JournalEntryAiCatalogAccount[];
    expense?: JournalEntryAiCatalogAccount[];
  };
  contacts?: JournalEntryAiCatalogContact[];
  // Estado actual del form cuando el usuario corrige en lenguaje natural.
  // Si está presente, el bloque "## Estado actual" se inyecta y el LLM
  // sabe que debe modificar solo lo mencionado por el usuario.
  formState?: Record<string, unknown>;
}

// ── System prompt builder ──

const TEMPLATES_BLOCK = `## Plantillas disponibles (las únicas que podés usar)

1. **expense_bank_payment** — Compra de gasto pagada por banco. Débito: cuenta de gasto. Crédito: cuenta bancaria. Voucher: CE.
2. **expense_cash_payment** — Compra de gasto pagada en efectivo. Débito: cuenta de gasto. Crédito: cuenta de caja. Voucher: CE.
3. **bank_deposit** — Depósito de efectivo a banco. Débito: cuenta bancaria. Crédito: cuenta de caja. Voucher: CI.

## Cómo elegir plantilla

- "compra/pago/factura" + "banco/tarjeta/transferencia" → expense_bank_payment
- "compra/pago/factura" + "efectivo/caja/cash" → expense_cash_payment
- "depósito a banco" / "deposité en el banco" → bank_deposit
- Si es ambiguo, preguntá: "¿Pagaste por banco o en efectivo?"`;

const TOOL_BLOCK = `## Tool disponible

**parseAccountingOperationToSuggestion(input)** — única tool. Llamala cuando hayas decidido la plantilla y resuelto todos los IDs del catálogo precargado abajo.`;

function rulesBlock(today: string): string {
  return `## Reglas duras

1. **SOLO** podés usar IDs del catálogo precargado abajo. Si necesitás un ID que no está en el catálogo, NO inventes — respondé al usuario que lo cargue primero (cuenta inexistente o proveedor no registrado).
2. NUNCA armes un asiento manualmente con líneas libres. Solo las tres plantillas.
3. Tres plantillas, no más. Si la operación no encaja en ninguna, decile al usuario que use "+ Nuevo Asiento" para cargarla manualmente.
4. Si la cuenta de gasto requiere proveedor (\`requiresContact: true\` en el catálogo) y el usuario no lo mencionó, **preguntá abierto** ("¿De qué proveedor?"). Podés ofrecer al usuario elegir entre los proveedores precargados, pero **NO infieras** el proveedor por contexto de la operación. Ejemplo de lo que NO hacer: si el usuario dice "compra de medicamentos por 500" y "Veterinaria Andina" es el único proveedor precargado, NO asumas que es ése — preguntá.
5. La fecha por defecto es **HOY (${today})**. Si el usuario dice "ayer", "el lunes", "el 15 de marzo", parseala a ISO. Si la fecha es ambigua o relativa al futuro (ej. "el lunes"), parseala pero **avisá al usuario explícitamente la fecha que asumiste para que la verifique** ("Asumí fecha 2026-04-22 (lunes). Verificá que sea correcta.").
6. Glosa propuesta: "Compra de [concepto] pagada por [banco/efectivo]" o "Depósito de Bs. [monto] a [banco]". El usuario la edita en el modal.
7. Monto SIEMPRE positivo. Si el usuario dice "-500", interpretalo como 500 (la dirección la define la plantilla).
8. Si el usuario describe una operación que no encaja en las 3 plantillas (ej. cobro de venta, ajuste, traspaso entre bancos), respondé: "Esa operación no está soportada en v1. Usá '+ Nuevo Asiento' para cargarla manualmente."
9. Si el usuario describe **múltiples operaciones** en un solo pedido, procesá solo una y pedile al usuario que indique cuál registrar primero.`;
}

const CORRECTION_BLOCK = `## Si el usuario está corrigiendo (estado actual presente abajo)

Recibís el estado actual del formulario como JSON. NO re-parsees todo desde cero — modificá **solo** los campos que el usuario menciona en su mensaje. El resto queda igual. Después llamá parseAccountingOperationToSuggestion con el estado modificado completo.

**Énfasis crítico**: si el usuario menciona solo un campo (ej. "el monto era 4500"), todos los demás IDs (\`expenseAccountId\`, \`bankAccountId\`, \`cashAccountId\`, \`contactId\`) y campos (\`description\`, \`date\`, \`template\`) DEBEN ser **idénticos byte por byte** al estado actual del formulario. NO sustituyas un ID por otro porque te parezca "más apropiado". NO reinterpretes campos no mencionados. Si el usuario quiere cambiar un campo, lo va a decir explícitamente.`;

const RESPONSE_FORMAT_BLOCK = `## Formato de respuesta al usuario

- Mensajes cortos, en español neutro.
- No expliques tu razonamiento.
- Cuando llamás parseAccountingOperationToSuggestion exitosamente, devolvé un mensaje vacío (el modal pinta el form solo).
- Si necesitás aclaración (proveedor faltante, plantilla ambigua, fecha confirmable), un mensaje corto y directo.`;

/**
 * Construye el system prompt completo para el modo journal-entry-ai.
 * Inyecta el catálogo precargado y, si aplica, el estado actual del
 * formulario (correcciones en lenguaje natural).
 */
export function buildJournalEntryAiSystemPrompt(
  hints?: JournalEntryAiContextHints,
  options: { today?: string } = {},
): string {
  const today = options.today ?? new Date().toISOString().split("T")[0];

  const sections: string[] = [
    "Sos un asistente de captura de asientos contables para Avicont, un sistema boliviano de avicultura. Tu único objetivo: convertir descripciones en lenguaje natural en sugerencias estructuradas de asiento contable en borrador.",
    "",
    TEMPLATES_BLOCK,
    "",
    TOOL_BLOCK,
    "",
    rulesBlock(today),
    "",
    CORRECTION_BLOCK,
    "",
    RESPONSE_FORMAT_BLOCK,
  ];

  const catalogBlock = formatCatalogBlock(hints);
  if (catalogBlock) {
    sections.push("", catalogBlock);
  }

  const contactsBlock = formatContactsBlock(hints);
  if (contactsBlock) {
    sections.push("", contactsBlock);
  }

  const formStateBlock = formatFormStateBlock(hints);
  if (formStateBlock) {
    sections.push("", formStateBlock);
  }

  return sections.join("\n");
}

// ── Renderers de bloques opcionales ──

function formatCatalogBlock(hints?: JournalEntryAiContextHints): string | null {
  if (!hints?.catalog) return null;
  const { bank, cash, expense } = hints.catalog;
  const hasAny = (bank?.length ?? 0) + (cash?.length ?? 0) + (expense?.length ?? 0) > 0;
  if (!hasAny) return null;

  const lines: string[] = ["## Catálogo precargado de cuentas"];

  if (bank && bank.length > 0) {
    lines.push("", "### Cuentas de banco");
    for (const a of bank) {
      lines.push(formatAccountLine(a));
    }
  }
  if (cash && cash.length > 0) {
    lines.push("", "### Cuentas de caja");
    for (const a of cash) {
      lines.push(formatAccountLine(a));
    }
  }
  if (expense && expense.length > 0) {
    lines.push("", `### Cuentas de gasto (top ${expense.length})`);
    for (const a of expense) {
      lines.push(formatAccountLine(a));
    }
  }

  return lines.join("\n");
}

function formatAccountLine(a: JournalEntryAiCatalogAccount): string {
  const requiresContact = a.requiresContact ? `, requiresContact: true` : "";
  return `- {id: "${a.id}", code: "${a.code}", name: "${a.name}"${requiresContact}}`;
}

function formatContactsBlock(hints?: JournalEntryAiContextHints): string | null {
  if (!hints?.contacts || hints.contacts.length === 0) return null;
  const lines: string[] = ["## Proveedores precargados"];
  for (const c of hints.contacts) {
    const nit = c.nit ? `, nit: "${c.nit}"` : "";
    lines.push(`- {id: "${c.id}", name: "${c.name}"${nit}}`);
  }
  return lines.join("\n");
}

function formatFormStateBlock(hints?: JournalEntryAiContextHints): string | null {
  if (!hints?.formState) return null;
  return [
    "## Estado actual del formulario — el usuario está corrigiendo",
    "",
    "El usuario ya generó este asiento previamente. Ahora pidió una corrección. Modificá SOLO los campos que el usuario menciona en su mensaje, mantené el resto idéntico, y volvé a llamar parseAccountingOperationToSuggestion con el resultado.",
    "",
    "```json",
    JSON.stringify(hints.formState, null, 2),
    "```",
  ].join("\n");
}

/**
 * Coerce defensivo de contextHints (que llega como `unknown` del request body).
 * Acepta objetos con shape parcial; descarta lo que no matchea. NO valida con Zod
 * estricto — es input del frontend, queremos degradación graceful (si el frontend
 * manda algo raro, simplemente no se inyecta el bloque correspondiente).
 */
export function coerceContextHints(input: unknown): JournalEntryAiContextHints | undefined {
  if (!input || typeof input !== "object") return undefined;
  const obj = input as Record<string, unknown>;

  const result: JournalEntryAiContextHints = {};

  if (obj.catalog && typeof obj.catalog === "object") {
    const cat = obj.catalog as Record<string, unknown>;
    const catalog: NonNullable<JournalEntryAiContextHints["catalog"]> = {};
    if (Array.isArray(cat.bank)) catalog.bank = cat.bank.filter(isCatalogAccount);
    if (Array.isArray(cat.cash)) catalog.cash = cat.cash.filter(isCatalogAccount);
    if (Array.isArray(cat.expense)) catalog.expense = cat.expense.filter(isCatalogAccount);
    if (catalog.bank || catalog.cash || catalog.expense) {
      result.catalog = catalog;
    }
  }

  if (Array.isArray(obj.contacts)) {
    const contacts = obj.contacts.filter(isCatalogContact);
    if (contacts.length > 0) result.contacts = contacts;
  }

  if (obj.formState && typeof obj.formState === "object") {
    result.formState = obj.formState as Record<string, unknown>;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function isCatalogAccount(x: unknown): x is JournalEntryAiCatalogAccount {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.code === "string" && typeof o.name === "string";
}

function isCatalogContact(x: unknown): x is JournalEntryAiCatalogContact {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    (o.nit === null || typeof o.nit === "string" || o.nit === undefined)
  );
}
