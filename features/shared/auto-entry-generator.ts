import {
  ValidationError,
  ACCOUNT_NOT_POSTABLE,
  VOUCHER_TYPE_NOT_IN_ORG,
  JOURNAL_NOT_BALANCED,
  CONTACT_REQUIRED_FOR_ACCOUNT,
} from "@/features/shared/errors";
import type { Prisma, VoucherTypeCode } from "@/generated/prisma/client";
import type { AccountsRepository } from "@/features/accounting/accounts.repository";
import type { VoucherTypesRepository } from "@/features/voucher-types/voucher-types.repository";
import type { JournalEntryWithLines } from "@/features/accounting/journal.types";

// ── Entry template types ──

export interface EntryLineTemplate {
  accountCode: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
  contactId?: string;
  description?: string;
}

export interface EntryTemplate {
  organizationId: string;
  voucherTypeCode: VoucherTypeCode;
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
  constructor(
    private readonly accountsRepo: AccountsRepository,
    private readonly voucherTypesRepo: VoucherTypesRepository,
  ) {}

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

    // 4. Get next correlative number (same MAX+1 strategy as JournalRepository.getNextNumber)
    const last = await tx.journalEntry.findFirst({
      where: {
        organizationId: template.organizationId,
        voucherTypeId: voucherType.id,
        periodId: template.periodId,
      },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;

    // 5. Create JournalEntry with status POSTED directly (system-generated entries skip DRAFT)
    const entry = await tx.journalEntry.create({
      data: {
        number,
        date: template.date,
        description: template.description,
        status: "POSTED",
        periodId: template.periodId,
        voucherTypeId: voucherType.id,
        contactId: template.contactId ?? null,
        sourceType: template.sourceType,
        sourceId: template.sourceId,
        referenceNumber: template.referenceNumber ?? null,
        createdById: template.createdById,
        organizationId: template.organizationId,
        lines: {
          create: resolvedLines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description ?? null,
            contactId: l.contactId ?? null,
            order: l.order,
          })),
        },
      },
      include: {
        lines: {
          include: { account: true, contact: true },
          orderBy: { order: "asc" as const },
        },
        contact: true,
        voucherType: true,
      },
    });

    return entry as JournalEntryWithLines;
  }
}
