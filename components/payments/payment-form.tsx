"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, CheckSquare, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { PaymentWithRelations, PaymentDirection, PaymentMethod, CreditAllocationSource } from "@/features/payment/payment.types";
import type { PendingDocument } from "@/features/contacts/contacts.types";
import { JustificationModal } from "@/components/shared/justification-modal";
import { todayLocal } from "@/lib/date-utils";

// ── Helpers ──

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PAYMENT_METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "DEPOSITO", label: "Depósito" },
] as const;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  VOIDED: { label: "Anulado", className: "bg-red-100 text-red-700" },
  LOCKED: { label: "Bloqueado", className: "bg-blue-100 text-blue-800 border-blue-300" },
};

// ── Allocation line state ──

interface AllocationLine {
  id: string;
  type: "receivable" | "payable";
  description: string;
  totalAmount: number;
  paid: number;
  balance: number;       // max assignable (real balance + this payment's allocation)
  displayBalance: number; // actual CxC balance for display
  sourceType: string | null;
  sourceId: string | null;
  dueDate: Date;
  assignedAmount: string; // string for input control
  checked: boolean;
}

// ── Credit line state ──

interface CreditLine {
  sourcePaymentId: string;
  description: string;
  date: Date;
  originalAmount: number;
  available: number;
  assignedAmount: string;
  checked: boolean;
}

// ── Merge helper ──

/**
 * Merges existing (checked) allocation lines with a fresh list of pending
 * documents fetched from the API.
 *
 * Rules:
 *  - Dedup by `id` — existing allocation wins (keeps checked: true and assignedAmount).
 *  - Pending docs not already in existing list are appended as unchecked / 0.
 *  - Result is sorted by dueDate ascending, tie-break by id ascending.
 */
function mergeAllocationsWithPending(
  existing: AllocationLine[],
  pending: AllocationLine[],
): AllocationLine[] {
  const existingIds = new Set(existing.map((a) => a.id));
  const newLines = pending
    .filter((p) => !existingIds.has(p.id))
    .map((p) => ({ ...p, checked: false, assignedAmount: "0" }));

  return [...existing, ...newLines].sort((a, b) => {
    const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ── Props ──

interface ContactOption {
  id: string;
  name: string;
  type: string;
}

interface PeriodOption {
  id: string;
  name?: string;
  year?: number;
  status: string;
}

interface DocTypeOption {
  id: string;
  code: string;
  name: string;
  direction: string;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

interface PaymentFormProps {
  orgSlug: string;
  contacts: ContactOption[];
  periods: PeriodOption[];
  existingPayment?: PaymentWithRelations;
  userRole?: string;
  defaultType?: "COBRO" | "PAGO";
  operationalDocTypes?: DocTypeOption[];
  cashAccounts?: AccountOption[];
  bankAccounts?: AccountOption[];
  defaultCashCode?: string;
  defaultBankCode?: string;
}

export default function PaymentForm({
  orgSlug,
  contacts,
  periods,
  existingPayment,
  userRole,
  defaultType,
  operationalDocTypes = [],
  cashAccounts = [],
  bankAccounts = [],
  defaultCashCode,
  defaultBankCode,
}: PaymentFormProps) {
  const router = useRouter();

  // ── Determine mode ──
  const isNew = !existingPayment;
  const isDraft = existingPayment?.status === "DRAFT";
  const isPosted = existingPayment?.status === "POSTED";
  const isVoided = existingPayment?.status === "VOIDED";
  const isLocked = existingPayment?.status === "LOCKED";
  const isAdminOrOwner = userRole === "admin" || userRole === "owner";
  const isReadOnly = isVoided || (isLocked && !isAdminOrOwner);

  // Infer direction from existing payment allocations, then fallback to contact type
  function inferDirection(payment: PaymentWithRelations): PaymentDirection {
    if (payment.allocations.length > 0) {
      return payment.allocations[0].receivableId ? "COBRO" : "PAGO";
    }
    // No allocations — infer from contact type
    const contact = contacts.find((c) => c.id === payment.contactId);
    if (contact?.type === "CLIENTE") return "COBRO";
    if (contact?.type === "PROVEEDOR") return "PAGO";
    return defaultType ?? "COBRO";
  }

  // ── Header state ──
  const [paymentType, setPaymentType] = useState<PaymentDirection>(
    existingPayment ? inferDirection(existingPayment) : (defaultType ?? "COBRO"),
  );
  const [contactId, setContactId] = useState(existingPayment?.contactId ?? "");
  const [periodId, setPeriodId] = useState(
    existingPayment?.periodId ?? periods[0]?.id ?? "",
  );
  const [date, setDate] = useState(
    existingPayment
      ? new Date(existingPayment.date).toISOString().split("T")[0]
      : todayLocal(),
  );
  const [method, setMethod] = useState<PaymentMethod>(existingPayment?.method ?? "EFECTIVO");

  // ── Account selection ──
  const isBankMethod = (m: string) =>
    m === "TRANSFERENCIA" || m === "DEPOSITO" || m === "CHEQUE";

  const [accountCode, setAccountCode] = useState(
    existingPayment?.accountCode ?? "",
  );

  const [description, setDescription] = useState(existingPayment?.description ?? "");
  const [notes, setNotes] = useState(existingPayment?.notes ?? "");
  const [operationalDocTypeId, setOperationalDocTypeId] = useState(
    existingPayment?.operationalDocTypeId ?? "",
  );
  const [referenceNumber, setReferenceNumber] = useState(
    existingPayment?.referenceNumber?.toString() ?? "",
  );
  const [amountOverride, setAmountOverride] = useState(
    existingPayment ? String(existingPayment.amount) : "",
  );

  // ── Allocations state ──
  const [allocations, setAllocations] = useState<AllocationLine[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);

  // ── Credit lines state ──
  const [creditLines, setCreditLines] = useState<CreditLine[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // ── Credit applied — computed from checked credit lines ──
  const creditApplied = creditLines
    .filter((c) => c.checked)
    .reduce((sum, c) => sum + (parseFloat(c.assignedAmount) || 0), 0);

  // ── Submission state ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  // ── Justification modal state ──
  const [showJustification, setShowJustification] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "void" | null>(null);
  const [isJustificationLoading, setIsJustificationLoading] = useState(false);

  // ── Load existing allocations ──
  useEffect(() => {
    if (existingPayment && existingPayment.allocations.length > 0) {
      const lines: AllocationLine[] = existingPayment.allocations.map((a) => {
        const target = a.receivable ?? a.payable;
        const desc = target
          ? `${target.sourceType ?? "Documento"} — ${(target as Record<string, unknown>).description ?? ""}`
          : "Documento";
        return {
          id: a.receivableId ?? a.payableId ?? a.id,
          type: a.receivableId ? "receivable" : "payable",
          description: desc,
          totalAmount: Number((target as Record<string, unknown>)?.amount ?? 0),
          paid: Number((target as Record<string, unknown>)?.paid ?? 0),
          balance: Number((target as Record<string, unknown>)?.balance ?? 0) + Number(a.amount),
          displayBalance: Number((target as Record<string, unknown>)?.balance ?? 0),
          sourceType: (target as Record<string, unknown>)?.sourceType as string | null ?? null,
          sourceId: (target as Record<string, unknown>)?.sourceId as string | null ?? null,
          dueDate: (target as Record<string, unknown>)?.dueDate as Date ?? new Date(),
          assignedAmount: String(a.amount),
          checked: true,
        };
      });
      setAllocations(lines);
    }
  }, [existingPayment]);

  // ── Fetch pending documents when contact changes ──
  const fetchPendingDocuments = useCallback(
    async (selectedContactId: string) => {
      if (!selectedContactId) {
        setAllocations([]);
        setCreditBalance(0);
        setCreditLines([]);
        return;
      }

      setLoadingDocs(true);
      setLoadingCredits(true);
      try {
        const docType = paymentType === "COBRO" ? "receivable" : "payable";
        const excludeParam = !isNew && existingPayment
          ? `?excludePaymentId=${existingPayment.id}`
          : "";
        const [docsRes, creditRes, unappliedRes] = await Promise.all([
          fetch(
            `/api/organizations/${orgSlug}/contacts/${selectedContactId}/pending-documents?type=${docType}`,
          ),
          fetch(
            `/api/organizations/${orgSlug}/contacts/${selectedContactId}/credit-balance`,
          ),
          fetch(
            `/api/organizations/${orgSlug}/contacts/${selectedContactId}/unapplied-payments${excludeParam}`,
          ),
        ]);

        // Hoist pending lines so they're accessible for credit auto-selection
        let resolvedPendingLines: AllocationLine[] = [];

        if (docsRes.ok) {
          const { documents } = (await docsRes.json()) as { documents: PendingDocument[] };
          resolvedPendingLines = documents.map((doc) => ({
            id: doc.id,
            type: doc.type,
            description: doc.description,
            totalAmount: doc.amount,
            paid: doc.paid,
            balance: doc.balance,
            displayBalance: doc.balance,
            sourceType: doc.sourceType,
            sourceId: doc.sourceId,
            dueDate: doc.dueDate,
            assignedAmount: "0",
            checked: false,
          }));

          if (isNew) {
            // Don't auto-check invoices yet — wait for credit auto-selection
            // Invoices will be checked only up to what credits cover
            setAllocations(resolvedPendingLines);
          } else {
            // Editing — merge pending docs into existing allocations
            setAllocations((prev) => mergeAllocationsWithPending(prev, resolvedPendingLines));
          }
        } else if (!isNew) {
          toast.error("No se pudieron cargar los documentos pendientes adicionales");
        }

        if (creditRes.ok) {
          const { creditBalance: bal } = (await creditRes.json()) as { creditBalance: number };
          setCreditBalance(bal ?? 0);
        }

        if (unappliedRes.ok) {
          const { payments: unapplied } = (await unappliedRes.json()) as {
            payments: Array<{
              id: string;
              description: string;
              date: Date;
              amount: number;
              available: number;
            }>;
          };
          const fetchedCreditLines: CreditLine[] = unapplied.map((p) => ({
            sourcePaymentId: p.id,
            description: p.description,
            date: p.date,
            originalAmount: p.amount,
            available: p.available,
            assignedAmount: "0",
            checked: false,
          }));

          if (isNew) {
            // Auto-check credits (sorted date ASC) to cover as much of the invoices as possible
            const totalInvoices = resolvedPendingLines.reduce(
              (sum, a) => sum + a.balance,
              0,
            );
            const sortedCredits = [...fetchedCreditLines].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
            );
            let creditRemaining = totalInvoices;
            const autoCredits = sortedCredits.map((c) => {
              if (creditRemaining <= 0) return c;
              const apply = Math.min(c.available, creditRemaining);
              creditRemaining -= apply;
              return { ...c, checked: apply > 0, assignedAmount: String(apply) };
            });
            setCreditLines(autoCredits);

            // Total credit applied
            const totalCreditApplied = autoCredits.reduce(
              (sum, c) => sum + (c.checked ? parseFloat(c.assignedAmount) || 0 : 0),
              0,
            );

            // Auto-check invoices ONLY up to what credits cover (FIFO by dueDate)
            if (totalCreditApplied > 0) {
              const sorted = [...resolvedPendingLines].sort((a, b) => {
                const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                return dateDiff !== 0 ? dateDiff : a.id < b.id ? -1 : 1;
              });
              let coverRemaining = totalCreditApplied;
              const autoAllocations = sorted.map((a) => {
                if (coverRemaining <= 0 || a.balance <= 0) return a;
                const assign = Math.min(a.balance, coverRemaining);
                coverRemaining -= assign;
                return { ...a, checked: true, assignedAmount: String(assign) };
              });
              setAllocations(autoAllocations);
            }
            // If no credits: leave everything deselected, importe stays at 0
            // User enters amount → handleAmountBlur FIFO, or checks manually
          } else {
            // Editing — merge: existing checked lines win; append new ones unchecked
            setCreditLines((prev) => {
              const existingIds = new Set(prev.map((c) => c.sourcePaymentId));
              const newLines = fetchedCreditLines.filter(
                (c) => !existingIds.has(c.sourcePaymentId),
              );
              return [...prev, ...newLines];
            });
          }
        }
      } catch {
        if (isNew) {
          toast.error("Error al cargar documentos pendientes");
        } else {
          toast.error("No se pudieron cargar los documentos pendientes adicionales");
        }
      } finally {
        setLoadingDocs(false);
        setLoadingCredits(false);
      }
    },
    [orgSlug, paymentType, isNew, existingPayment],
  );

  // ── Fetch docs when contact or type changes ──
  // Fires for new payments AND for edits (DRAFT, POSTED, LOCKED+admin).
  // Skipped for VOIDED payments (read-only with no editable state).
  useEffect(() => {
    if (contactId && !isVoided) {
      fetchPendingDocuments(contactId);
    }
  }, [contactId, isVoided, paymentType, fetchPendingDocuments]);

  // ── Reset accountCode when method changes (new payments only) ──
  useEffect(() => {
    if (!existingPayment) {
      setAccountCode("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);


  // ── Allocation handlers ──

  function updateAllocationAmount(id: string, value: string) {
    setAllocations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, assignedAmount: value } : a)),
    );
  }

  function selectAll() {
    setAllocations((prev) => {
      const updated = prev.map((a) => ({ ...a, checked: true, assignedAmount: String(a.balance) }));
      const totalChecked = updated.reduce((sum, a) => sum + a.balance, 0);
      const totalCredits = creditLines
        .filter((c) => c.checked)
        .reduce((sum, c) => sum + (parseFloat(c.assignedAmount) || 0), 0);
      const cashNeeded = Math.max(0, totalChecked - totalCredits);
      setAmountOverride(cashNeeded > 0 ? String(cashNeeded) : "");
      return updated;
    });
  }

  function handleCheckToggle(id: string, checked: boolean) {
    setAllocations((prev) => {
      const updated = prev.map((line) => {
        if (line.id !== id) return line;
        if (!checked) return { ...line, checked: false, assignedAmount: "0" };
        const currentApplied = prev
          .filter((l) => l.id !== id && l.checked)
          .reduce((sum, l) => sum + (parseFloat(l.assignedAmount) || 0), 0);
        const paymentAmt = parseFloat(amountOverride) || 0;
        const currentCreditTotal = creditLines
          .filter((c) => c.checked)
          .reduce((sum, c) => sum + (parseFloat(c.assignedAmount) || 0), 0);
        const totalFunds = paymentAmt + currentCreditTotal;
        const remaining = totalFunds > 0
          ? Math.max(0, totalFunds - currentApplied)
          : line.balance;
        const fillAmount = Math.min(line.balance, remaining);
        return { ...line, checked: true, assignedAmount: String(fillAmount) };
      });

      // Update importe recibido to reflect cash needed:
      // Cash needed = total checked allocations - total credits
      const totalChecked = updated
        .filter((a) => a.checked)
        .reduce((sum, a) => sum + (parseFloat(a.assignedAmount) || 0), 0);
      const totalCredits = creditLines
        .filter((c) => c.checked)
        .reduce((sum, c) => sum + (parseFloat(c.assignedAmount) || 0), 0);
      const cashNeeded = Math.max(0, totalChecked - totalCredits);
      setAmountOverride(cashNeeded > 0 ? String(cashNeeded) : "");

      return updated;
    });
  }

  function handleAmountBlur() {
    const parsed = parseFloat(amountOverride);
    const hasCreditsCovering = creditLines.some(
      (c) => c.checked && parseFloat(c.assignedAmount) > 0,
    );

    // If amount is 0/empty but credits are covering, don't reset allocations
    if (!amountOverride || isNaN(parsed) || parsed <= 0) {
      if (!hasCreditsCovering) {
        setAllocations((prev) =>
          prev.map((a) => ({ ...a, checked: false, assignedAmount: "0" })),
        );
      }
      return;
    }

    // FIFO allocation of cash amount across invoices
    const currentCreditTotal = creditLines
      .filter((c) => c.checked)
      .reduce((sum, c) => sum + (parseFloat(c.assignedAmount) || 0), 0);
    const totalFunds = parsed + currentCreditTotal;

    const sorted = [...allocations].sort((a, b) => {
      const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    let remaining = totalFunds;
    const newAllocations = sorted.map((a) => {
      if (remaining > 0 && a.balance > 0) {
        const assigned = Math.min(a.balance, remaining);
        remaining -= assigned;
        return { ...a, checked: true, assignedAmount: String(assigned) };
      }
      return { ...a, checked: false, assignedAmount: "0" };
    });

    setAllocations(newAllocations);
  }

  // ── Computed totals ──

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.assignedAmount) || 0),
    0,
  );

  // paymentAmount = cash received (0 if empty/blank — credit-only mode)
  const paymentAmount =
    amountOverride && parseFloat(amountOverride) > 0
      ? parseFloat(amountOverride)
      : 0;

  // Total funding available = cash + credits
  const totalFunding = paymentAmount + creditApplied;

  const creditFromPayment =
    paymentAmount > totalAllocated ? paymentAmount - totalAllocated : 0;

  // ── Mode detection ──
  // Mode B: credit-only payment (no new cash), just apply existing credits to invoices
  const isCreditOnly = paymentAmount === 0 && creditApplied > 0;

  // ── Auto-description ──
  const autoDescription = useCallback(() => {
    const contactName = contacts.find((c) => c.id === contactId)?.name ?? "";
    const typeLabel = paymentType === "COBRO" ? "Cobro" : "Pago";
    const methodLabel =
      PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
    return `${typeLabel} ${methodLabel} - ${contactName}`;
  }, [contactId, contacts, paymentType, method]);

  useEffect(() => {
    if (isNew && contactId && !description) {
      setDescription(autoDescription());
    }
  }, [isNew, contactId, method, paymentType, autoDescription, description]);

  // ── Validation ──

  const activeAllocations = allocations.filter(
    (a) => a.checked && parseFloat(a.assignedAmount) > 0,
  );

  const hasOverAllocation = allocations.some(
    (a) => parseFloat(a.assignedAmount) > a.balance,
  );

  const hasCreditOverLimit = creditLines.some(
    (c) => c.checked && parseFloat(c.assignedAmount) > c.available,
  );

  const canSubmit =
    contactId &&
    periodId &&
    date &&
    description.trim() &&
    (paymentAmount > 0 || creditApplied > 0) &&
    !hasOverAllocation &&
    !hasCreditOverLimit;

  // ── Build CreditAllocationSource[] with receivableId FIFO mapping ──
  // For each checked credit line, distribute its assignedAmount across checked allocations
  // in FIFO order. Creates one entry per (sourcePayment, receivable) pair.
  function buildCreditSources(): CreditAllocationSource[] {
    const checkedCredits = creditLines.filter(
      (c) => c.checked && parseFloat(c.assignedAmount) > 0,
    );
    if (checkedCredits.length === 0) return [];

    // Only receivable allocations can be paid via credit (COBRO direction)
    const checkedReceivables = allocations
      .filter((a) => a.checked && a.type === "receivable" && parseFloat(a.assignedAmount) > 0)
      .sort((a, b) => {
        const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return dateDiff !== 0 ? dateDiff : a.id < b.id ? -1 : 1;
      });

    if (checkedReceivables.length === 0) return [];

    const sources: CreditAllocationSource[] = [];
    // Track remaining capacity per receivable
    const receivableRemaining = new Map<string, number>(
      checkedReceivables.map((a) => [a.id, parseFloat(a.assignedAmount) || 0]),
    );

    for (const credit of checkedCredits) {
      let creditRemaining = parseFloat(credit.assignedAmount) || 0;
      for (const alloc of checkedReceivables) {
        if (creditRemaining <= 0) break;
        const allocRemaining = receivableRemaining.get(alloc.id) ?? 0;
        if (allocRemaining <= 0) continue;
        const apply = Math.min(creditRemaining, allocRemaining);
        sources.push({
          sourcePaymentId: credit.sourcePaymentId,
          receivableId: alloc.id,
          amount: apply,
        });
        receivableRemaining.set(alloc.id, allocRemaining - apply);
        creditRemaining -= apply;
      }
    }

    return sources;
  }

  // Build cash-only allocations: total assigned minus what credits cover per CxC
  function buildCashAllocations(creditSources: CreditAllocationSource[]) {
    const creditByReceivable = new Map<string, number>();
    for (const cs of creditSources) {
      creditByReceivable.set(
        cs.receivableId,
        (creditByReceivable.get(cs.receivableId) ?? 0) + cs.amount,
      );
    }
    return activeAllocations
      .map((a) => {
        const totalAssigned = parseFloat(a.assignedAmount) || 0;
        const creditCovering = creditByReceivable.get(a.id) ?? 0;
        const cashPortion = Math.max(0, totalAssigned - creditCovering);
        return {
          ...(a.type === "receivable"
            ? { receivableId: a.id }
            : { payableId: a.id }),
          amount: cashPortion,
        };
      })
      .filter((a) => a.amount > 0);
  }

  // ── Mode B submit (credit-only — no new payment, just apply credits) ──

  async function handleApplyCredits() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const creditSources = buildCreditSources();
      if (creditSources.length === 0) {
        toast.error("No hay créditos asignados a documentos pendientes");
        return;
      }

      const body = {
        contactId,
        creditSources,
      };

      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/apply-credits`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al aplicar créditos");
      }

      toast.success("Créditos aplicados correctamente");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aplicar créditos");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Submit (create or update) ──

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (isCreditOnly) {
      // Mode B: delegate to credit-only handler
      await handleApplyCredits();
      return;
    }
    setIsSubmitting(true);

    try {
      const creditSources = buildCreditSources();
      const allocs = buildCashAllocations(creditSources);

      const body = {
        method,
        date,
        amount: paymentAmount,
        creditSources: creditSources.length > 0 ? creditSources : undefined,
        direction: allocs.length === 0 ? paymentType : undefined,
        description: description.trim(),
        periodId,
        contactId,
        allocations: allocs,
        notes: notes.trim() || undefined,
        operationalDocTypeId: operationalDocTypeId || undefined,
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        accountCode: accountCode || undefined,
      };

      const url = existingPayment
        ? `/api/organizations/${orgSlug}/payments/${existingPayment.id}`
        : `/api/organizations/${orgSlug}/payments`;

      const response = await fetch(url, {
        method: existingPayment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al guardar el pago");
      }

      toast.success(
        existingPayment
          ? "Pago actualizado correctamente"
          : "Pago guardado como borrador",
      );
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el pago",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Post (DRAFT → POSTED) ──

  async function handlePost() {
    if (!existingPayment) return;
    if (
      !confirm(
        "¿Está seguro de contabilizar este pago? Esta acción generará el asiento contable correspondiente.",
      )
    )
      return;

    setIsPosting(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "POSTED" }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar el pago");
      }

      toast.success("Pago contabilizado correctamente");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al contabilizar el pago",
      );
    } finally {
      setIsPosting(false);
    }
  }

  // ── Void (POSTED → VOIDED) ──

  async function handleVoid() {
    if (!existingPayment) return;
    if (
      !confirm(
        "¿Está seguro de anular este pago? Se revertirán los asientos contables y las actualizaciones de CxC/CxP.",
      )
    )
      return;

    setIsVoiding(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VOIDED" }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al anular el pago");
      }

      toast.success("Pago anulado correctamente");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al anular el pago",
      );
    } finally {
      setIsVoiding(false);
    }
  }

  // ── Delete (DRAFT only) ──

  async function handleDelete() {
    if (!existingPayment) return;
    if (!confirm("¿Está seguro de eliminar este pago borrador?")) return;

    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al eliminar el pago");
      }

      toast.success("Pago eliminado correctamente");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el pago",
      );
    }
  }

  // ── Create and Post (atomic POSTED creation) ──

  async function handleCreateAndPost() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const creditSources = buildCreditSources();
      const allocs = buildCashAllocations(creditSources);

      const body = {
        method,
        date,
        amount: paymentAmount,
        creditSources: creditSources.length > 0 ? creditSources : undefined,
        direction: allocs.length === 0 ? paymentType : undefined,
        description: description.trim(),
        periodId,
        contactId,
        allocations: allocs,
        notes: notes.trim() || undefined,
        operationalDocTypeId: operationalDocTypeId || undefined,
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        accountCode: accountCode || undefined,
        postImmediately: true,
      };

      const response = await fetch(`/api/organizations/${orgSlug}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar el pago");
      }

      toast.success("Pago contabilizado");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar el pago");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── LOCKED edit handlers ──

  async function handleLockedSave(justification: string) {
    if (!existingPayment) return;
    setIsJustificationLoading(true);
    try {
      const creditSources = buildCreditSources();
      const allocs = buildCashAllocations(creditSources);

      const body = {
        method,
        date,
        amount: paymentAmount,
        creditSources: creditSources.length > 0 ? creditSources : undefined,
        direction: allocs.length === 0 ? paymentType : undefined,
        description: description.trim(),
        periodId,
        contactId,
        allocations: allocs,
        notes: notes.trim() || undefined,
        operationalDocTypeId: operationalDocTypeId || null,
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        accountCode: accountCode || null,
        justification,
      };

      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al guardar el pago bloqueado");
      }

      toast.success("Pago actualizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el pago bloqueado");
    } finally {
      setIsJustificationLoading(false);
    }
  }

  async function handleLockedVoid(justification: string) {
    if (!existingPayment) return;
    setIsJustificationLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VOIDED", justification }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al anular el pago bloqueado");
      }

      toast.success("Pago anulado");
      router.push(`/${orgSlug}/payments`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular el pago bloqueado");
    } finally {
      setIsJustificationLoading(false);
    }
  }

  // ── POSTED edit handler ──

  async function handlePostedSave(justification: string) {
    if (!existingPayment) return;
    setIsJustificationLoading(true);
    try {
      const creditSources = buildCreditSources();
      const allocs = buildCashAllocations(creditSources);

      const body = {
        method,
        date,
        amount: paymentAmount,
        creditSources: creditSources.length > 0 ? creditSources : undefined,
        direction: allocs.length === 0 ? paymentType : undefined,
        description: description.trim(),
        periodId,
        contactId,
        allocations: allocs,
        notes: notes.trim() || undefined,
        operationalDocTypeId: operationalDocTypeId || null,
        referenceNumber: referenceNumber ? parseInt(referenceNumber, 10) : undefined,
        accountCode: accountCode || null,
        justification,
      };

      const response = await fetch(
        `/api/organizations/${orgSlug}/payments/${existingPayment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al guardar el pago contabilizado");
      }

      toast.success("Pago actualizado y asiento recalculado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el pago contabilizado");
    } finally {
      setIsJustificationLoading(false);
    }
  }

  const backHref = `/${orgSlug}/payments`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={backHref}>
          <Button type="button" variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver a Cobros y Pagos
          </Button>
        </Link>

        {existingPayment && (
          <div className="flex items-center gap-2">
            {isVoided && (
              <Badge className="bg-red-100 text-red-700 text-sm px-3 py-1">
                ANULADO
              </Badge>
            )}
            <Badge className={STATUS_BADGE[existingPayment.status]?.className ?? ""}>
              {STATUS_BADGE[existingPayment.status]?.label ?? existingPayment.status}
            </Badge>
          </div>
        )}
      </div>

      {/* Header fields */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isNew
              ? `Nuevo ${paymentType === "COBRO" ? "Cobro" : "Pago"}`
              : `${paymentType === "COBRO" ? "Cobro" : "Pago"} — ${existingPayment?.description ?? ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Tipo Documento / Nro Referencia / Fecha / Período (4 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tipo de Documento Operacional */}
            <div className="space-y-2">
              <Label htmlFor="operational-doc-type">Tipo de Documento</Label>
              {isReadOnly ? (
                <Input
                  value={existingPayment?.operationalDocType
                    ? `${existingPayment.operationalDocType.code} — ${existingPayment.operationalDocType.name}`
                    : "—"}
                  readOnly
                  className="bg-muted cursor-default"
                />
              ) : (
                <Select
                  value={operationalDocTypeId || "__none__"}
                  onValueChange={(v) =>
                    setOperationalDocTypeId(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger id="operational-doc-type" className="w-full">
                    <SelectValue placeholder="Sin documento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin documento</SelectItem>
                    {operationalDocTypes
                      .filter((dt) =>
                        dt.direction === paymentType || dt.direction === "BOTH",
                      )
                      .map((dt) => (
                        <SelectItem key={dt.id} value={dt.id}>
                          {dt.code} — {dt.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Número de Referencia */}
            <div className="space-y-2">
              <Label htmlFor="payment-reference-number">N° Referencia (opcional)</Label>
              {isReadOnly ? (
                <Input
                  value={existingPayment?.referenceNumber?.toString() ?? "—"}
                  readOnly
                  className="bg-muted cursor-default"
                />
              ) : (
                <Input
                  id="payment-reference-number"
                  type="number"
                  min={1}
                  step={1}
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Ej: 1234"
                />
              )}
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="payment-date">Fecha</Label>
              <Input
                id="payment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                readOnly={isReadOnly}
                className={isReadOnly ? "bg-muted cursor-default" : ""}
                required
              />
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label htmlFor="period">Período</Label>
              {isReadOnly ? (
                <Input
                  value={existingPayment?.period?.name ?? ""}
                  readOnly
                  className="bg-muted cursor-default"
                />
              ) : (
                <Select value={periodId} onValueChange={setPeriodId}>
                  <SelectTrigger id="period" className="w-full">
                    <SelectValue placeholder="Seleccione período" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name ?? `Período ${p.year}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Row 2: Cliente / Método de Pago / Cuenta (3 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Contacto */}
            <div className="space-y-2">
              <Label htmlFor="contact">
                {paymentType === "COBRO" ? "Cliente" : "Proveedor"}
              </Label>
              {isReadOnly ? (
                <Input
                  value={existingPayment?.contact?.name ?? ""}
                  readOnly
                  className="bg-muted cursor-default"
                />
              ) : (
                <Select
                  value={contactId}
                  onValueChange={setContactId}
                  disabled={!!existingPayment}
                >
                  <SelectTrigger id="contact" className="w-full">
                    <SelectValue placeholder="Seleccione contacto" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Método de Pago — oculto en modo crédito (Mode B) */}
            {!isCreditOnly && (
              <div className="space-y-2">
                <Label htmlFor="method">Método de Pago</Label>
                {isReadOnly ? (
                  <Input
                    value={
                      PAYMENT_METHODS.find((m) => m.value === method)?.label ??
                      method
                    }
                    readOnly
                    className="bg-muted cursor-default"
                  />
                ) : (
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger id="method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Cuenta — solo si hay opciones disponibles */}
            {(() => {
              const accountOptions = isBankMethod(method)
                ? bankAccounts
                : cashAccounts;
              if (accountOptions.length === 0) return null;
              return (
                <div className="space-y-2">
                  <Label htmlFor="account-code">Cuenta</Label>
                  {isReadOnly ? (
                    <Input
                      value={accountCode || "—"}
                      readOnly
                      className="bg-muted cursor-default"
                    />
                  ) : (
                    <Select
                      value={accountCode || ""}
                      onValueChange={setAccountCode}
                    >
                      <SelectTrigger id="account-code" className="w-full">
                        <SelectValue placeholder="Seleccione cuenta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accountOptions.map((a) => (
                          <SelectItem key={a.id} value={a.code}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Row 3: Descripción (full width) */}
          <div className="grid grid-cols-1 gap-4">
            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="payment-description">Descripción</Label>
              <Input
                id="payment-description"
                placeholder="Descripción del pago"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={isReadOnly}
                className={isReadOnly ? "bg-muted cursor-default" : ""}
                required
              />
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notas (opcional)</Label>
              <Textarea
                id="payment-notes"
                placeholder="Observaciones adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                readOnly={isReadOnly}
                className={isReadOnly ? "bg-muted cursor-default" : ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Importe recibido — aparece antes de las asignaciones (estilo QuickBooks) */}
      {!isVoided && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="payment-amount-override">Importe recibido (Bs.)</Label>
                {isReadOnly && !isPosted ? (
                  <Input
                    value={existingPayment ? formatCurrency(existingPayment.amount) : ""}
                    readOnly
                    className="bg-muted cursor-default font-mono font-bold"
                  />
                ) : (
                  <Input
                    id="payment-amount-override"
                    type="number"
                    min={0}
                    step={0.01}
                    value={amountOverride}
                    onChange={(e) => setAmountOverride(e.target.value)}
                    onBlur={handleAmountBlur}
                    placeholder="0.00"
                    className="font-mono font-bold"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {!isReadOnly || isPosted
                    ? "Deje vacío para usar el total asignado en las líneas"
                    : ""}
                </p>
              </div>

              {/* Resumen en tiempo real */}
              <div className="flex gap-6 text-sm flex-wrap">
                <div className="text-center">
                  <p className="text-muted-foreground">Importe aplicado</p>
                  <p className="font-mono font-semibold text-gray-800">
                    {formatCurrency(totalAllocated)}
                  </p>
                </div>
                {creditFromPayment > 0 && (
                  <div className="text-center">
                    <p className="text-amber-700">Importe a acreditar</p>
                    <p className="font-mono font-semibold text-amber-700">
                      {formatCurrency(creditFromPayment)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allocations table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Asignación a{" "}
              {paymentType === "COBRO"
                ? "Cuentas por Cobrar"
                : "Cuentas por Pagar"}
            </CardTitle>
            {!isReadOnly && allocations.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Seleccionar Todo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingDocs && allocations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Cargando documentos pendientes...
              </span>
            </div>
          ) : !contactId && isNew ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>Seleccione un contacto para ver los documentos pendientes</p>
            </div>
          ) : allocations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>
                No hay documentos pendientes para este{" "}
                {paymentType === "COBRO" ? "cliente" : "proveedor"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {!isReadOnly && (
                      <th className="py-3 px-3 w-10" />
                    )}
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Descripción
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Total
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Pagado
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">
                      Saldo
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600 w-40">
                      Aplicar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc) => {
                    const assigned = parseFloat(alloc.assignedAmount) || 0;
                    const overLimit = assigned > alloc.balance;
                    return (
                      <tr
                        key={alloc.id}
                        className={`border-b hover:bg-gray-50/50 ${
                          alloc.checked ? "bg-blue-50/30" : ""
                        }`}
                      >
                        {!isReadOnly && (
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={alloc.checked}
                              onChange={(e) => handleCheckToggle(alloc.id, e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-800">
                              {alloc.description}
                            </p>
                            {alloc.dueDate && (
                              <p className="text-xs text-gray-400">
                                Vence: {formatDate(alloc.dueDate)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(alloc.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-500">
                          {formatCurrency(alloc.paid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {formatCurrency(alloc.displayBalance)}
                        </td>
                        <td className="py-3 px-4">
                          {isReadOnly ? (
                            <Input
                              value={
                                assigned > 0
                                  ? assigned.toLocaleString("es-BO", {
                                      minimumFractionDigits: 2,
                                    })
                                  : "—"
                              }
                              readOnly
                              className="h-8 text-right bg-muted cursor-default font-mono"
                            />
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              max={alloc.balance}
                              step={0.01}
                              value={alloc.assignedAmount}
                              onChange={(e) =>
                                updateAllocationAmount(alloc.id, e.target.value)
                              }
                              placeholder="0.00"
                              className={`h-8 text-right font-mono ${
                                overLimit
                                  ? "border-red-500 focus-visible:ring-red-500"
                                  : ""
                              }`}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Summary */}
                <tfoot>
                  <tr className="border-t bg-gray-50">
                    <td
                      colSpan={isReadOnly ? 4 : 5}
                      className="py-2 px-4 text-right text-sm text-gray-600"
                    >
                      Importe aplicado:
                    </td>
                    <td className="py-2 px-4 text-right font-mono font-medium">
                      {formatCurrency(totalAllocated)}
                    </td>
                  </tr>

                  {/* Credit balance row */}
                  {creditFromPayment > 0 && !isReadOnly && (
                    <tr className="bg-amber-50">
                      <td
                        colSpan={5}
                        className="py-2 px-4 text-right text-sm text-amber-700"
                      >
                        Importe a acreditar:
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-amber-700 font-medium">
                        {formatCurrency(creditFromPayment)}
                      </td>
                    </tr>
                  )}

                  {/* Existing credit balance */}
                  {creditBalance > 0 && isNew && (
                    <tr className="bg-blue-50">
                      <td
                        colSpan={5}
                        className="py-2 px-4 text-right text-sm text-blue-700"
                      >
                        Saldo a favor existente del contacto:
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-blue-700 font-medium">
                        {formatCurrency(creditBalance)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}

          {hasOverAllocation && (
            <p className="text-red-500 text-sm mt-2">
              Una o más asignaciones exceden el saldo disponible del documento.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Credits table — visible when credit lines exist or are loading */}
      {(creditLines.length > 0 || loadingCredits) && (
        <Card>
          <CardHeader>
            <CardTitle>Créditos disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCredits && creditLines.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">
                  Cargando créditos disponibles...
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {!isReadOnly && (
                        <th className="py-3 px-3 w-10" />
                      )}
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        Descripción
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Importe original
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">
                        Saldo disponible
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 w-40">
                        Aplicar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditLines.map((credit) => {
                      const assigned = parseFloat(credit.assignedAmount) || 0;
                      const overLimit = credit.checked && assigned > credit.available;
                      return (
                        <tr
                          key={credit.sourcePaymentId}
                          className={`border-b hover:bg-gray-50/50 ${
                            credit.checked ? "bg-blue-50/30" : ""
                          }`}
                        >
                          {!isReadOnly && (
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={credit.checked}
                                onChange={(e) => {
                                  const nowChecked = e.target.checked;
                                  setCreditLines((prev) =>
                                    prev.map((c) => {
                                      if (c.sourcePaymentId !== credit.sourcePaymentId) return c;
                                      if (!nowChecked) return { ...c, checked: false, assignedAmount: "0" };
                                      return { ...c, checked: true, assignedAmount: String(c.available) };
                                    }),
                                  );
                                }}
                                className="h-4 w-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-800">
                                {credit.description}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatDate(credit.date)}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatCurrency(credit.originalAmount)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium">
                            {formatCurrency(credit.available)}
                          </td>
                          <td className="py-3 px-4">
                            {isReadOnly ? (
                              <Input
                                value={
                                  assigned > 0
                                    ? assigned.toLocaleString("es-BO", {
                                        minimumFractionDigits: 2,
                                      })
                                    : "—"
                                }
                                readOnly
                                className="h-8 text-right bg-muted cursor-default font-mono"
                              />
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                max={credit.available}
                                step={0.01}
                                value={credit.assignedAmount}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCreditLines((prev) =>
                                    prev.map((c) =>
                                      c.sourcePaymentId === credit.sourcePaymentId
                                        ? { ...c, assignedAmount: val }
                                        : c,
                                    ),
                                  );
                                }}
                                placeholder="0.00"
                                className={`h-8 text-right font-mono ${
                                  overLimit
                                    ? "border-red-500 focus-visible:ring-red-500"
                                    : ""
                                }`}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Footer */}
                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td
                        colSpan={isReadOnly ? 3 : 4}
                        className="py-2 px-4 text-right text-sm text-gray-600"
                      >
                        Crédito aplicado:
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-medium">
                        {formatCurrency(creditApplied)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {hasCreditOverLimit && (
              <p className="text-red-500 text-sm mt-2">
                Uno o más créditos exceden el saldo disponible.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Journal Entry reference (POSTED) */}
      {isPosted && existingPayment?.journalEntry && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Asiento Contable:</span>
              <span className="font-mono text-blue-600">
                {`#${existingPayment.journalEntry.number}`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href={backHref}>
          <Button type="button" variant="outline">
            {isVoided ? "Volver" : "Cancelar"}
          </Button>
        </Link>

        {/* New mode — dual buttons (Mode A) or credit-only button (Mode B) */}
        {isNew && !isCreditOnly && (
          <>
            <Button type="submit" variant="outline" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Borrador"
              )}
            </Button>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleCreateAndPost}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Contabilizar
            </Button>
          </>
        )}

        {/* Mode B — credit-only: single "Aplicar créditos" button */}
        {isNew && isCreditOnly && (
          <Button
            type="button"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleApplyCredits}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Aplicar créditos
          </Button>
        )}

        {/* Draft actions */}
        {isDraft && (
          <>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
            >
              Eliminar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handlePost}
              disabled={isPosting || !canSubmit}
            >
              {isPosting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Contabilizando...
                </>
              ) : (
                "Contabilizar"
              )}
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </>
        )}

        {/* LOCKED actions (admin/owner only) */}
        {isLocked && isAdminOrOwner && (
          <>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { setPendingAction("void"); setShowJustification(true); }}
              disabled={isJustificationLoading}
            >
              {isJustificationLoading && pendingAction === "void" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Anular
            </Button>
            <Button
              type="button"
              onClick={() => { setPendingAction("save"); setShowJustification(true); }}
              disabled={!canSubmit || isJustificationLoading}
            >
              {isJustificationLoading && pendingAction === "save" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </>
        )}

        {/* Posted actions */}
        {isPosted && (
          <>
            <Button
              type="button"
              variant="destructive"
              onClick={handleVoid}
              disabled={isVoiding || isJustificationLoading}
            >
              {isVoiding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Anulando...
                </>
              ) : (
                "Anular"
              )}
            </Button>
            <Button
              type="button"
              onClick={() => { setPendingAction("save"); setShowJustification(true); }}
              disabled={!canSubmit || isJustificationLoading}
            >
              {isJustificationLoading && pendingAction === "save" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Guardar
            </Button>
          </>
        )}
      </div>

      {/* Justification Modal */}
      <JustificationModal
        isOpen={showJustification}
        onClose={() => { setShowJustification(false); setPendingAction(null); }}
        onConfirm={async (justification: string) => {
          if (pendingAction === "save" && isLocked) await handleLockedSave(justification);
          else if (pendingAction === "save" && isPosted) await handlePostedSave(justification);
          else if (pendingAction === "void") await handleLockedVoid(justification);
          setShowJustification(false);
          setPendingAction(null);
        }}
        isLoading={isJustificationLoading}
      />
    </form>
  );
}
