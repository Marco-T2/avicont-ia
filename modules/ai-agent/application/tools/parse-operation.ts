import type {
  JournalEntryAiInput,
  JournalEntryAiTemplate,
} from "../../domain/validation/agent.validation";
import type {
  CreateJournalEntrySuggestion,
  JournalEntryAiVoucherTypeCode,
  ResolvedAccountInfo,
  ResolvedContactInfo,
} from "../../domain/types/agent.types";
import type {
  AccountsLookupPort,
  Account as AccountPortShape,
} from "../../domain/ports/accounts-lookup.port";
import type { makeContactsService } from "@/modules/contacts/presentation/server";

// ── Voucher type derivation ──

function deriveVoucherTypeCode(template: JournalEntryAiTemplate): JournalEntryAiVoucherTypeCode {
  switch (template) {
    case "expense_bank_payment":
    case "expense_cash_payment":
      return "CE";
    case "bank_deposit":
      return "CI";
  }
}

// ── Executor ──

export interface ParseAccountingOperationDeps {
  accountsLookup: AccountsLookupPort;
  contactsService?: ReturnType<typeof makeContactsService>;
}

/**
 * REQ-004: consume AccountsLookupPort en lugar de PrismaAccountsRepo directo.
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export async function executeParseAccountingOperation(
  organizationId: string,
  rawInput: unknown,
  deps: ParseAccountingOperationDeps,
): Promise<CreateJournalEntrySuggestion> {
  const [
    { journalEntryAiInputSchema },
    {
      ValidationError,
      ACCOUNT_NOT_POSTABLE,
      CONTACT_REQUIRED_FOR_ACCOUNT,
      JOURNAL_AI_ACCOUNT_NOT_FOUND,
      JOURNAL_AI_CONTACT_NOT_FOUND,
    },
  ] = await Promise.all([
    import("../../domain/validation/agent.validation.ts"),
    import("@/features/shared/errors"),
  ]);

  const accountsLookup = deps.accountsLookup;
  let contactsService = deps.contactsService;
  if (!contactsService) {
    const { makeContactsService: factory } = await import("@/modules/contacts/presentation/server");
    contactsService = factory();
  }

  // 1. Validación Zod.
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

  const accountIds = collectAccountIds(input);
  const accounts = await accountsLookup.findManyByIds(organizationId, accountIds);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const missing = accountIds.filter((id) => !accountById.has(id));
  if (missing.length > 0) {
    throw new ValidationError(
      `No se encontraron cuentas con los IDs: ${missing.join(", ")}. ` +
        `Usá findAccountsByPurpose para listar opciones válidas.`,
      JOURNAL_AI_ACCOUNT_NOT_FOUND,
      { missing },
    );
  }

  const notUsable = accounts.filter((a) => !a.isDetail);
  if (notUsable.length > 0) {
    throw new ValidationError(
      `Cuentas no usables (deben ser de detalle y activas): ${formatAccountList(notUsable)}.`,
      ACCOUNT_NOT_POSTABLE,
      { notUsable: notUsable.map((a) => a.id) },
    );
  }

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
  byId: Map<string, AccountPortShape>,
): AccountPortShape | undefined {
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

function buildResolvedAccounts(accounts: AccountPortShape[]): Record<string, ResolvedAccountInfo> {
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

function formatAccountList(accounts: AccountPortShape[]): string {
  return accounts.map((a) => `${a.code} ${a.name}`).join(", ");
}
