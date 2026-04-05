import type { Contact, ContactType } from "@/generated/prisma/client";

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
  creditLimit?: number | null;
}

export interface UpdateContactInput {
  type?: ContactType;
  name?: string;
  nit?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentTermsDays?: number;
  creditLimit?: number | null;
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
  totalReceivable: number;
  totalPayable: number;
  netPosition: number;
  openReceivableCount: number;
  openPayableCount: number;
}

export interface ContactWithBalance extends Contact {
  balanceSummary: ContactBalanceSummary;
}

// ── Pending document types ──

export interface PendingDocument {
  id: string;
  type: "receivable" | "payable";
  description: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: Date;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
}
