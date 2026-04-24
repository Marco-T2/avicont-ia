import {
  ValidationError,
  ACCOUNT_NOT_POSTABLE,
  VOUCHER_TYPE_NOT_IN_ORG,
  JOURNAL_NOT_BALANCED,
  CONTACT_REQUIRED_FOR_ACCOUNT,
} from "@/features/shared/errors";
import type { Prisma } from "@/generated/prisma/client";
import type { AccountsRepository } from "./accounts.repository";
import type { VoucherTypesRepository } from "@/features/voucher-types/server";
import { JournalRepository } from "./journal.repository";
import type { JournalEntryWithLines } from "./journal.types";

// ── Entry template types ──

export interface EntryLineTemplate {
  accountCode: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
  contactId?: string;
  description?: string;
}

interface EntryTemplate {
  organizationId: string;
  voucherTypeCode: string;
  contactId?: string;
  date: Date;
  periodId: string;
  description: string;
  referenceNumber?: number;
  sourceType: string;
  sourceId: string;
  lines: EntryLineTemplate[];
  createdById: string;
}

// ── Auto-entry generator ──

export class AutoEntryGenerator {
  private readonly journalRepo: JournalRepository;

  constructor(
    private readonly accountsRepo: AccountsRepository,
    private readonly voucherTypesRepo: VoucherTypesRepository,
    journalRepo?: JournalRepository,
  ) {
    this.journalRepo = journalRepo ?? new JournalRepository();
  }

  async generate(
    tx: Prisma.TransactionClient,
    template: EntryTemplate,
  ): Promise<JournalEntryWithLines> {
    // 1. Resolve voucherTypeCode → VoucherTypeCfg scoped to org
    const voucherType = await this.voucherTypesRepo.findByCode(
      template.organizationId,
      template.voucherTypeCode,
    );
    if (!voucherType) {
      throw new ValidationError(
        `Tipo de comprobante ${template.voucherTypeCode} no configurado para esta organización`,
        VOUCHER_TYPE_NOT_IN_ORG,
      );
    }

    // 2. Resolve each account code → account; validate active + isDetail
    const resolvedLines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      contactId?: string;
      description?: string;
      order: number;
    }> = [];

    for (let i = 0; i < template.lines.length; i++) {
      const lineTemplate = template.lines[i];

      const account = await this.accountsRepo.findByCode(
        template.organizationId,
        lineTemplate.accountCode,
      );

      if (!account || !account.isActive || !account.isDetail) {
        throw new ValidationError(
          `Cuenta ${lineTemplate.accountCode} no es posteable (no encontrada, inactiva o no es de detalle)`,
          ACCOUNT_NOT_POSTABLE,
        );
      }

      if (account.requiresContact && !lineTemplate.contactId) {
        throw new ValidationError(
          `La cuenta "${account.name}" requiere un contacto en la línea`,
          CONTACT_REQUIRED_FOR_ACCOUNT,
        );
      }

      resolvedLines.push({
        accountId: account.id,
        debit: lineTemplate.side === "DEBIT" ? lineTemplate.amount : 0,
        credit: lineTemplate.side === "CREDIT" ? lineTemplate.amount : 0,
        contactId: lineTemplate.contactId,
        description: lineTemplate.description,
        order: i,
      });
    }

    // 3. Validate double-entry balance (sum debits == sum credits)
    const totalDebit = resolvedLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = resolvedLines.reduce((s, l) => s + l.credit, 0);

    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      throw new ValidationError(
        "El asiento no balancea: débitos y créditos son distintos",
        JOURNAL_NOT_BALANCED,
      );
    }

    // 4. Create JournalEntry with status POSTED directly (system-generated entries
    //    skip DRAFT). Number is allocated atomically inside the retry loop, which
    //    is critical because auto-entries from sales/purchases/dispatches run in
    //    bulk and race each other on the unique (org, type, period, number) index.
    return this.journalRepo.createWithRetryTx(
      tx,
      template.organizationId,
      {
        date: template.date,
        description: template.description,
        periodId: template.periodId,
        voucherTypeId: voucherType.id,
        contactId: template.contactId,
        sourceType: template.sourceType,
        sourceId: template.sourceId,
        referenceNumber: template.referenceNumber,
        createdById: template.createdById,
      },
      resolvedLines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
        contactId: l.contactId,
        order: l.order,
      })),
      "POSTED",
    );
  }
}
