"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TrendingUp,
  FileText,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  CheckCircle,
  XCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { SaleWithDetails } from "@/features/sale";
import { formatDateBO } from "@/lib/date-utils";

// ── Helpers ──

function formatCurrency(amount: number): string {
  return `Bs. ${amount.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-800" },
  POSTED: { label: "Contabilizado", className: "bg-green-100 text-green-800" },
  LOCKED: { label: "Bloqueado", className: "bg-blue-100 text-blue-800 border-blue-300" },
  VOIDED: { label: "Anulado", className: "bg-red-100 text-red-700" },
};

// ── Props ──

interface SaleListProps {
  orgSlug: string;
  initialSales: SaleWithDetails[];
}

export default function SaleList({ orgSlug, initialSales }: SaleListProps) {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = initialSales.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  async function handlePost(saleId: string) {
    if (!window.confirm("¿Contabilizar esta venta? Esta acción generará el asiento contable y la cuenta por cobrar.")) return;
    setActioningId(saleId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/sales/${saleId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "POSTED" }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al contabilizar");
      }
      toast.success("Venta contabilizada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setActioningId(null);
    }
  }

  async function handleVoid(saleId: string) {
    if (!window.confirm("¿Anular esta venta? Se revertirá el asiento contable y la cuenta por cobrar.")) return;
    setActioningId(saleId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/sales/${saleId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VOIDED" }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al anular");
      }
      toast.success("Venta anulada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(saleId: string) {
    if (!window.confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;
    setActioningId(saleId);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/sales/${saleId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Error al eliminar");
      }
      toast.success("Borrador eliminado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <>
      {/* Tarjeta de acceso rápido — nueva venta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-sm">Venta General</CardTitle>
                <CardDescription className="text-xs">Registro de ventas</CardDescription>
              </div>
            </div>
            <CardAction>
              <Link href={`/${orgSlug}/sales/new`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nueva
                </Button>
              </Link>
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="POSTED">Contabilizado</SelectItem>
                  <SelectItem value="LOCKED">Bloqueado</SelectItem>
                  <SelectItem value="VOIDED">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de ventas */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Nro</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                  <th className="w-12 py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">No hay ventas registradas</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {statusFilter !== "all"
                          ? "Ninguna venta coincide con los filtros aplicados"
                          : "Cree la primera venta para comenzar"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((sale) => {
                    const statusBadge = STATUS_BADGE[sale.status] ?? {
                      label: sale.status,
                      className: "bg-gray-100 text-gray-800",
                    };
                    const isLoading = actioningId === sale.id;

                    return (
                      <tr
                        key={sale.id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/${orgSlug}/sales/${sale.id}`)}
                      >
                        <td className="py-3 px-4 font-mono text-blue-600 font-medium">
                          {sale.displayCode}
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {sale.contact?.name ?? "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatDateBO(sale.date)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {sale.status === "DRAFT" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/${orgSlug}/sales/${sale.id}`)}
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handlePost(sale.id)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Contabilizar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(sale.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {sale.status === "POSTED" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/${orgSlug}/sales/${sale.id}`)}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Ver / Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleVoid(sale.id)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Anular
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(sale.status === "LOCKED" || sale.status === "VOIDED") && (
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/${orgSlug}/sales/${sale.id}`)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
