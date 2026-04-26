import { z } from "zod";

// Modos del agente. "chat" es el default (conversación libre). "journal-entry-ai" es
// el modo de captura asistida del botón "+ Crear Asiento con IA" — single-turn,
// sin RAG, sin historial, con catálogo precargado de cuentas/contactos en
// contextHints (formato definido en journal-entry-ai.prompt.ts).
export const AGENT_MODES = ["chat", "journal-entry-ai"] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

export const agentQuerySchema = z.object({
  prompt: z.string().min(1, "Se requiere un prompt"),
  session_id: z.string().optional(),
  mode: z.enum(AGENT_MODES).optional().default("chat"),
  contextHints: z.unknown().optional(),
});

export const confirmActionSchema = z.object({
  suggestion: z.object({
    action: z.string().min(1, "Se requiere una acción"),
    data: z.record(z.string(), z.unknown()).default({}),
  }),
});

// ── Schemas Zod para captura asistida de asientos contables ───────────────────
// Botón "+ Crear Asiento con IA" en /accounting/journal. Estos schemas son el
// contrato que el LLM debe respetar al llamar a la tool
// parseAccountingOperationToSuggestion. NO incluyen lookups de DB (existencia
// de cuentas, isDetail, requiresContact) — esas validaciones corren en el builder
// del agente y en journal.service como defensa en profundidad.

export const JOURNAL_ENTRY_AI_TEMPLATES = [
  "expense_bank_payment",
  "expense_cash_payment",
  "bank_deposit",
] as const;

export type JournalEntryAiTemplate = (typeof JOURNAL_ENTRY_AI_TEMPLATES)[number];

const isoDateString = z
  .string()
  .min(1, "La fecha es requerida")
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "Fecha inválida — debe ser ISO 8601 (YYYY-MM-DD o datetime completo)",
  });

const baseShape = {
  date: isoDateString,
  description: z
    .string()
    .min(3, "La glosa debe tener al menos 3 caracteres")
    .max(500, "La glosa no puede superar los 500 caracteres"),
  amount: z
    .number({ message: "El monto debe ser un número" })
    .positive("El monto debe ser mayor a 0")
    .max(9_999_999_999.99, "El monto excede el máximo permitido"),
  originalText: z
    .string()
    .min(1, "El texto original es requerido")
    .max(2000, "El texto original no puede superar los 2000 caracteres"),
};

export const expenseBankPaymentSchema = z
  .object({
    ...baseShape,
    template: z.literal("expense_bank_payment"),
    expenseAccountId: z.string().cuid("ID de cuenta de gasto inválido"),
    bankAccountId: z.string().cuid("ID de cuenta bancaria inválido"),
    contactId: z.string().cuid("ID de contacto inválido").optional(),
  })
  .strict();

export const expenseCashPaymentSchema = z
  .object({
    ...baseShape,
    template: z.literal("expense_cash_payment"),
    expenseAccountId: z.string().cuid("ID de cuenta de gasto inválido"),
    cashAccountId: z.string().cuid("ID de cuenta de caja inválido"),
    contactId: z.string().cuid("ID de contacto inválido").optional(),
  })
  .strict();

export const bankDepositSchema = z
  .object({
    ...baseShape,
    template: z.literal("bank_deposit"),
    bankAccountId: z.string().cuid("ID de cuenta bancaria inválido"),
    cashAccountId: z.string().cuid("ID de cuenta de caja inválido"),
  })
  .strict();

// Discriminated union sobre los tres templates. El superRefine final corre los
// refinamientos cross-field que dependen del discriminator (no se pueden
// expresar dentro de cada miembro sin romper el discriminator).
export const journalEntryAiInputSchema = z
  .discriminatedUnion("template", [
    expenseBankPaymentSchema,
    expenseCashPaymentSchema,
    bankDepositSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.template === "expense_bank_payment" && data.expenseAccountId === data.bankAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankAccountId"],
        message: "expenseAccountId no puede ser igual a bankAccountId",
      });
    }
    if (data.template === "expense_cash_payment" && data.expenseAccountId === data.cashAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashAccountId"],
        message: "expenseAccountId no puede ser igual a cashAccountId",
      });
    }
    if (data.template === "bank_deposit" && data.bankAccountId === data.cashAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cashAccountId"],
        message: "bankAccountId no puede ser igual a cashAccountId",
      });
    }
  });

export type JournalEntryAiInput = z.infer<typeof journalEntryAiInputSchema>;

// Schema para el payload del action=confirm de createJournalEntry. Valida el
// shape que llega del modal (CreateJournalEntrySuggestion["data"]), que puede
// haber sido editado por el usuario antes de confirmar. Usa passthrough para
// no rechazar metadata de display (resolvedAccounts, resolvedContact,
// voucherTypeCode) que el route handler ignora — sólo le importa lo que va
// al servicio. Defensa en profundidad: el journalService valida cuadre,
// período abierto, isDetail, etc. nuevamente.
export const createJournalEntryConfirmSchema = z
  .object({
    template: z.enum(JOURNAL_ENTRY_AI_TEMPLATES),
    date: isoDateString,
    description: z
      .string()
      .min(3, "La glosa debe tener al menos 3 caracteres")
      .max(500, "La glosa no puede superar los 500 caracteres"),
    amount: z.number().positive("El monto debe ser mayor a 0"),
    contactId: z.string().cuid("ID de contacto inválido").optional(),
    originalText: z
      .string()
      .min(1, "El texto original es requerido")
      .max(2000, "El texto original no puede superar los 2000 caracteres"),
    lines: z
      .array(
        z.object({
          accountId: z.string().cuid("ID de cuenta inválido"),
          debit: z.number().min(0, "El débito no puede ser negativo"),
          credit: z.number().min(0, "El crédito no puede ser negativo"),
        }),
      )
      .min(2, "Un asiento contable debe tener al menos 2 líneas"),
  })
  .passthrough();

export type CreateJournalEntryConfirmInput = z.infer<typeof createJournalEntryConfirmSchema>;
