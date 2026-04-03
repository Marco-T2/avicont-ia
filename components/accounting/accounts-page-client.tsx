"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, ChevronRight, ChevronDown } from "lucide-react";
import CreateAccountDialog from "./create-account-dialog";
import type { Account } from "@/generated/prisma/client";

const ACCOUNT_TYPE_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVO: { label: "Activo", className: "bg-blue-100 text-blue-800" },
  PASIVO: { label: "Pasivo", className: "bg-red-100 text-red-800" },
  PATRIMONIO: {
    label: "Patrimonio",
    className: "bg-purple-100 text-purple-800",
  },
  INGRESO: { label: "Ingreso", className: "bg-green-100 text-green-800" },
  GASTO: { label: "Gasto", className: "bg-orange-100 text-orange-800" },
};

type AccountWithChildren = Account & { children: Account[] };

interface AccountsPageClientProps {
  orgSlug: string;
  tree: AccountWithChildren[];
  allAccounts: Account[];
}

export default function AccountsPageClient({
  orgSlug,
  tree,
  allAccounts,
}: AccountsPageClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function renderAccount(account: AccountWithChildren, level: number) {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const typeConfig = ACCOUNT_TYPE_CONFIG[account.type] ?? {
      label: account.type,
      className: "bg-gray-100 text-gray-800",
    };

    return (
      <div key={account.id}>
        <div
          className={`flex items-center py-3 px-4 border-b hover:bg-gray-50 transition-colors ${
            !account.isActive ? "opacity-50" : ""
          }`}
          style={{ paddingLeft: `${level * 24 + 16}px` }}
        >
          {/* Expand/Collapse */}
          <div className="w-6 mr-2">
            {hasChildren && (
              <button
                onClick={() => toggleExpand(account.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Code */}
          <span className="font-mono text-sm text-gray-600 w-24 shrink-0">
            {account.code}
          </span>

          {/* Name */}
          <span className={`flex-1 ${level === 0 ? "font-semibold" : ""}`}>
            {account.name}
          </span>

          {/* Type Badge */}
          <Badge className={`${typeConfig.className} mr-3`}>
            {typeConfig.label}
          </Badge>

          {/* Status */}
          {!account.isActive && (
            <Badge variant="outline" className="text-gray-400">
              Inactiva
            </Badge>
          )}
        </div>

        {/* Render children if expanded */}
        {hasChildren &&
          isExpanded &&
          (account.children as AccountWithChildren[]).map((child) =>
            renderAccount(child, level + 1),
          )}
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cuenta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="flex items-center py-3 px-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
            <div className="w-6 mr-2" />
            <span className="w-24 shrink-0">Codigo</span>
            <span className="flex-1">Nombre</span>
            <span className="w-24 text-center">Tipo</span>
            <span className="w-20 text-center">Estado</span>
          </div>

          {tree.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No hay cuentas registradas</p>
              <p className="text-sm text-gray-400 mt-1">
                Cree la primera cuenta para comenzar
              </p>
            </div>
          ) : (
            tree.map((account) => renderAccount(account, 0))
          )}
        </CardContent>
      </Card>

      <CreateAccountDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        orgSlug={orgSlug}
        allAccounts={allAccounts}
        onCreated={() => {
          setShowCreate(false);
          router.refresh();
        }}
      />
    </>
  );
}
