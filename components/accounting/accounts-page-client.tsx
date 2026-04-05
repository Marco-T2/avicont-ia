"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Pencil,
  Ban,
  PlusCircle,
} from "lucide-react";
import CreateAccountDialog from "./create-account-dialog";
import EditAccountDialog from "./edit-account-dialog";
import DeactivateAccountDialog from "./deactivate-account-dialog";
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
  const [createParentId, setCreateParentId] = useState<string | undefined>();
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deactivateAccount, setDeactivateAccount] = useState<Account | null>(null);
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

  function handleAddChild(parentId: string) {
    setCreateParentId(parentId);
    setShowCreate(true);
  }

  function handleCreateRoot() {
    setCreateParentId(undefined);
    setShowCreate(true);
  }

  function handleCreated() {
    setShowCreate(false);
    setCreateParentId(undefined);
    router.refresh();
  }

  function renderAccount(account: AccountWithChildren, level: number) {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const typeConfig = ACCOUNT_TYPE_CONFIG[account.type] ?? {
      label: account.type,
      className: "bg-gray-100 text-gray-800",
    };
    const canAddChild = account.isActive && account.level < 4;
    const canDeactivate = account.isActive && account.level > 2;

    const levelStyles = [
      "font-bold text-[15px] text-gray-900 bg-gray-50/80",
      "font-semibold text-sm text-gray-800",
      "font-medium text-sm text-gray-700",
      "text-sm text-gray-600",
    ];
    const rowStyle = levelStyles[level] ?? levelStyles[3];

    return (
      <div key={account.id}>
        <div
          className={`group flex items-center py-3 px-4 border-b hover:bg-gray-50 transition-colors ${rowStyle} ${
            !account.isActive ? "opacity-50" : ""
          }`}
          style={{ paddingLeft: `${level * 32 + 16}px` }}
        >
          {/* Tree connector line */}
          {level > 0 && (
            <span className="mr-2 text-gray-300 select-none" aria-hidden>
              {"└"}
            </span>
          )}

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
          <span className="font-mono text-sm text-gray-500 w-28 shrink-0">
            {account.code}
          </span>

          {/* Name — inherits font weight from levelStyles */}
          <span className="flex-1">
            {account.name}
          </span>

          {/* Type Badge */}
          <Badge className={`${typeConfig.className} mr-3`}>
            {typeConfig.label}
          </Badge>

          {/* Status */}
          {!account.isActive && (
            <Badge variant="outline" className="text-gray-400 mr-3">
              Inactiva
            </Badge>
          )}

          {/* Action buttons — visible on hover */}
          {account.isActive && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canAddChild && (
                <button
                  onClick={() => handleAddChild(account.id)}
                  className="p-1.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600"
                  title="Agregar cuenta hija"
                >
                  <PlusCircle className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setEditAccount(account)}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {canDeactivate && (
                <button
                  onClick={() => setDeactivateAccount(account)}
                  className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
                  title="Desactivar"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </div>
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
        <Button onClick={handleCreateRoot}>
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
            <span className="w-24" />
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
        onCreated={handleCreated}
        preselectedParentId={createParentId}
      />

      <EditAccountDialog
        account={editAccount}
        onOpenChange={() => setEditAccount(null)}
        orgSlug={orgSlug}
        onUpdated={() => {
          setEditAccount(null);
          router.refresh();
        }}
      />

      <DeactivateAccountDialog
        account={deactivateAccount}
        onOpenChange={() => setDeactivateAccount(null)}
        orgSlug={orgSlug}
        onDeactivated={() => {
          setDeactivateAccount(null);
          router.refresh();
        }}
      />
    </>
  );
}
