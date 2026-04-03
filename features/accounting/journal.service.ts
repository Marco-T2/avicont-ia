import { NotFoundError, ValidationError } from "@/features/shared/errors";
import { AccountsRepository } from "./accounts.repository";
import { JournalRepository } from "./journal.repository";
import type {
  CreateJournalEntryInput,
  JournalEntryWithLines,
  JournalFilters,
} from "./journal.types";

export class JournalService {
  private readonly repo: JournalRepository;
  private readonly accountsRepo: AccountsRepository;

  constructor(repo?: JournalRepository, accountsRepo?: AccountsRepository) {
    this.repo = repo ?? new JournalRepository();
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
  }

  // ── List journal entries ──

  async list(
    organizationId: string,
    filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Get a single journal entry ──

  async getById(organizationId: string, id: string): Promise<JournalEntryWithLines> {
    const entry = await this.repo.findById(organizationId, id);
    if (!entry) throw new NotFoundError("Asiento contable");
    return entry;
  }

  // ── Create a journal entry (double-entry bookkeeping) ──

  async createEntry(
    organizationId: string,
    input: CreateJournalEntryInput,
  ): Promise<JournalEntryWithLines> {
    const { lines, ...entryData } = input;

    // Validate at least 2 lines
    if (lines.length < 2) {
      throw new ValidationError("Un asiento contable debe tener al menos 2 líneas");
    }

    // Validate debits === credits (double-entry)
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    // Use rounding to avoid floating-point issues
    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      throw new ValidationError("Los débitos y créditos no balancean");
    }

    // Validate all accounts exist and are active
    for (const line of lines) {
      const account = await this.accountsRepo.findById(organizationId, line.accountId);
      if (!account) {
        throw new NotFoundError(`Cuenta ${line.accountId}`);
      }
      if (!account.isActive) {
        throw new ValidationError(`La cuenta "${account.name}" está desactivada`);
      }
    }

    // Auto-assign next number
    const number = await this.repo.getNextNumber(organizationId);

    return this.repo.create(organizationId, entryData, lines, number);
  }
}
