import { redirect, notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { JournalService } from "@/features/accounting";

interface EntryDetailPageProps {
  params: Promise<{ orgSlug: string; entryId: string }>;
}

const VOUCHER_LABELS: Record<string, { label: string; className: string }> = {
  INGRESO: { label: "Ingreso", className: "bg-green-100 text-green-800" },
  EGRESO: { label: "Egreso", className: "bg-red-100 text-red-800" },
  TRASPASO: { label: "Traspaso", className: "bg-blue-100 text-blue-800" },
  DIARIO: { label: "Diario", className: "bg-gray-100 text-gray-800" },
};

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function EntryDetailPage({
  params,
}: EntryDetailPageProps) {
  const { orgSlug, entryId } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  const service = new JournalService();
  let entry;
  try {
    entry = await service.getById(orgId, entryId);
  } catch {
    notFound();
  }

  const voucher = VOUCHER_LABELS[entry.voucherType] ?? {
    label: entry.voucherType,
    className: "bg-gray-100 text-gray-800",
  };

  const totalDebit = entry.lines.reduce(
    (sum, line) => sum + Number(line.debit),
    0,
  );
  const totalCredit = entry.lines.reduce(
    (sum, line) => sum + Number(line.credit),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href={`/${orgSlug}/accounting/journal`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver al Libro Diario
        </Button>
      </Link>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                Asiento #{entry.number}
              </CardTitle>
              <p className="text-gray-500 mt-1">{entry.description}</p>
            </div>
            <Badge className={voucher.className}>{voucher.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Fecha: {formatDate(entry.date)}
          </p>
        </CardContent>
      </Card>

      {/* Lines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle del Asiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Codigo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Cuenta
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Descripcion
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Debe
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Haber
                  </th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={line.id} className="border-b">
                    <td className="py-3 px-4 font-mono text-gray-600">
                      {line.account.code}
                    </td>
                    <td className="py-3 px-4">{line.account.name}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {line.description ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {Number(line.debit) > 0
                        ? formatCurrency(Number(line.debit))
                        : ""}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {Number(line.credit) > 0
                        ? formatCurrency(Number(line.credit))
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <td colSpan={3} className="py-3 px-4 text-right">
                    Totales
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {Math.round(totalDebit * 100) === Math.round(totalCredit * 100) ? (
            <p className="mt-4 text-sm text-green-600 font-medium">
              El asiento esta balanceado correctamente.
            </p>
          ) : (
            <p className="mt-4 text-sm text-red-600 font-medium">
              Advertencia: El asiento NO esta balanceado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
