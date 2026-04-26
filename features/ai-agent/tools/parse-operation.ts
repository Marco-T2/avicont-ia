import "server-only";
import { defineTool } from "../llm";
import {
  journalEntryAiInputSchema,
  type JournalEntryAiInput,
  type JournalEntryAiTemplate,
} from "../agent.validation";
import type {
  CreateJournalEntrySuggestion,
  JournalEntryAiVoucherTypeCode,
  ResolvedAccountInfo,
  ResolvedContactInfo,
} from "../agent.types";
import { AccountsRepository } from "@/features/accounting/server";
import { ContactsService } from "@/features/contacts/server";
import {
  ValidationError,
  ACCOUNT_NOT_POSTABLE,
  CONTACT_REQUIRED_FOR_ACCOUNT,
  JOURNAL_AI_ACCOUNT_NOT_FOUND,
  JOURNAL_AI_CONTACT_NOT_FOUND,
} from "@/features/shared/errors";
import type { Account } from "@/generated/prisma/client";

// ── Tool definition ──

export const parseAccountingOperationToSuggestionTool = defineTool({
  name: "parseAccountingOperationToSuggestion",
  description:
    "Construye una sugerencia estructurada de asiento contable en borrador a partir " +
    "de una plantilla y parámetros ya resueltos. Llamá esta tool SOLO cuando ya hayas " +
    "resuelto los IDs de cuentas con findAccountsByPurpose y, si la operación lo requiere, " +
    "el ID del contacto con findContact. NO inventes IDs — la validación de existencia " +
    "rechaza cualquier ID que no esté en la base de datos. Esta tool NO persiste el " +
    "asiento; la creación real se confirma desde el modal de la UI.",
  inputSchema: journalEntryAiInputSchema,
});

// ── Voucher type derivation ──

function deriveVoucherTypeCode(template: JournalEntryAiTemplate): JournalEntryAiVoucherTypeCode {
  switch (template) {
    case "expense_bank_payment":
    case "expense_cash_payment":
      return "CE"; // Egreso de dinero
    case "bank_deposit":
      return "CI"; // Ingreso a banco
  }
}

// ── Executor ──

export interface ParseAccountingOperationDeps {
  accountsRepo?: AccountsRepository;
  contactsService?: ContactsService;
}

/**
 * Recibe input ya validado (Zod corre antes en el dispatcher de tools del agente)
 * o sin validar (si lo llamás como builder puro). Internamente vuelve a validar
 * con safeParse para garantizar invariantes — defensa en profundidad.
 */
export async function executeParseAccountingOperation(
  organizationId: string,
  rawInput: unknown,
  deps: ParseAccountingOperationDeps = {},
): Promise<CreateJournalEntrySuggestion> {
  const accountsRepo = deps.accountsRepo ?? new AccountsRepository();
  const contactsService = deps.contactsService ?? new ContactsService();

  // 1. Validación Zod (discriminator + cross-field).
  const parsed = journalEntryAiInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ValidationError(
      `Input de asiento inválido: ${issues}`,
      "VALIDATION",
      { issues: parsed.error.issues },
    );
  }
  const input: JournalEntryAiInput = parsed.data;

  // 2. Lookup batch de todas las cuentas referenciadas según el template.
  const accountIds = collectAccountIds(input);
  const accounts = await accountsRepo.findManyByIds(organizationId, accountIds);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // 3. Existencia (todos los IDs deben mapear a cuentas reales de la org).
  const missing = accountIds.filter((id) => !accountById.has(id));
  if (missing.length > 0) {
    throw new ValidationError(
      `No se encontraron cuentas con los IDs: ${missing.join(", ")}. ` +
        `Usá findAccountsByPurpose para listar opciones válidas.`,
      JOURNAL_AI_ACCOUNT_NOT_FOUND,
      { missing },
    );
  }

  // 4. Cuentas usables (isDetail + isActive).
  const notUsable = accounts.filter((a) => !a.isDetail || !a.isActive);
  if (notUsable.length > 0) {
    throw new ValidationError(
      `Cuentas no usables (deben ser de detalle y activas): ${formatAccountList(notUsable)}.`,
      ACCOUNT_NOT_POSTABLE,
      { notUsable: notUsable.map((a) => a.id) },
    );
  }

  // 5. Contacto requerido (cuenta de gasto con requiresContact=true). bank_deposit
  // no admite contactId en el schema, así que getContactId devuelve undefined ahí.
  const expenseAccount = getExpenseAccount(input, accountById);
  const contactId = getContactId(input);
  if (expenseAccount?.requiresContact && !contactId) {
    throw new ValidationError(
      `La cuenta ${expenseAccount.code} ${expenseAccount.name} requiere proveedor. ` +
        `Usá findContact para resolverlo y volvé a llamar la tool con contactId.`,
      CONTACT_REQUIRED_FOR_ACCOUNT,
      { expenseAccountId: expenseAccount.id },
    );
  }

  // 6. Lookup del contacto si se proveyó (verifica existencia, org-scope, isActive).
  let resolvedContact: ResolvedContactInfo | undefined;
  if (contactId) {
    try {
      const contact = await contactsService.getActiveById(organizationId, contactId);
      resolvedContact = {
        id: contact.id,
        name: contact.name,
        nit: contact.nit,
      };
    } catch {
      throw new ValidationError(
        `No se encontró el contacto con ID ${contactId}. ` +
          `Usá findContact para buscar proveedores válidos.`,
        JOURNAL_AI_CONTACT_NOT_FOUND,
        { contactId },
      );
    }
  }

  // 7. Construcción del asiento (lines en orden estable: débito primero).
  const lines = buildLines(input);
  const resolvedAccounts = buildResolvedAccounts(accounts);

  return {
    action: "createJournalEntry",
    data: {
      template: input.template,
      voucherTypeCode: deriveVoucherTypeCode(input.template),
      date: input.date,
      description: input.description,
      amount: input.amount,
      contactId,
      lines,
      originalText: input.originalText,
      resolvedAccounts,
      resolvedContact,
    },
  };
}

// ── Helpers internos ──

function collectAccountIds(input: JournalEntryAiInput): string[] {
  switch (input.template) {
    case "expense_bank_payment":
      return [input.expenseAccountId, input.bankAccountId];
    case "expense_cash_payment":
      return [input.expenseAccountId, input.cashAccountId];
    case "bank_deposit":
      return [input.bankAccountId, input.cashAccountId];
  }
}

function getExpenseAccount(
  input: JournalEntryAiInput,
  byId: Map<string, Account>,
): Account | undefined {
  if (input.template === "expense_bank_payment" || input.template === "expense_cash_payment") {
    return byId.get(input.expenseAccountId);
  }
  return undefined;
}

function getContactId(input: JournalEntryAiInput): string | undefined {
  if (input.template === "expense_bank_payment" || input.template === "expense_cash_payment") {
    return input.contactId;
  }
  return undefined;
}

function buildLines(input: JournalEntryAiInput): CreateJournalEntrySuggestion["data"]["lines"] {
  const amount = input.amount;
  switch (input.template) {
    case "expense_bank_payment":
      return [
        { accountId: input.expenseAccountId, debit: amount, credit: 0 },
        { accountId: input.bankAccountId, debit: 0, credit: amount },
      ];
    case "expense_cash_payment":
      return [
        { accountId: input.expenseAccountId, debit: amount, credit: 0 },
        { accountId: input.cashAccountId, debit: 0, credit: amount },
      ];
    case "bank_deposit":
      return [
        { accountId: input.bankAccountId, debit: amount, credit: 0 },
        { accountId: input.cashAccountId, debit: 0, credit: amount },
      ];
  }
}

function buildResolvedAccounts(accounts: Account[]): Record<string, ResolvedAccountInfo> {
  const map: Record<string, ResolvedAccountInfo> = {};
  for (const a of accounts) {
    map[a.id] = {
      code: a.code,
      name: a.name,
      requiresContact: a.requiresContact,
    };
  }
  return map;
}

function formatAccountList(accounts: Account[]): string {
  return accounts.map((a) => `${a.code} ${a.name}`).join(", ");
}
