import type { Contact, ContactType } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

// ── Re-export Prisma types for convenience ──

export type { Contact, ContactType };

// ── Input types ──

export interface CreateContactInput {
  type: ContactType;
  name: string;
  nit?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTermsDays?: number;
  creditLimit?: Prisma.Decimal | null;
}

export interface UpdateContactInput {
  type?: ContactType;
  name?: string;
  nit?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentTermsDays?: number;
  creditLimit?: Prisma.Decimal | null;
}

// ── Filter types ──

export interface ContactFilters {
  type?: ContactType;
  isActive?: boolean;
  search?: string; // matches name or nit
}

// ── Balance types ──

export interface ContactBalanceSummary {
  contactId: string;
  totalReceivable: Prisma.Decimal;
  totalPayable: Prisma.Decimal;
  netPosition: Prisma.Decimal;
  openReceivableCount: number;
  openPayableCount: number;
}

export interface ContactWithBalance extends Contact {
  balanceSummary: ContactBalanceSummary;
}
