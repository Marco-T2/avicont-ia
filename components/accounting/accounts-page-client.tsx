"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Pencil,
  Ban,
  PlusCircle,
  Search,
  X,
} from "lucide-react";
import CreateAccountDialog from "./create-account-dialog";
import EditAccountDialog from "./edit-account-dialog";
import DeactivateAccountDialog from "./deactivate-account-dialog";
import { formatSubtypeLabel } from "@/features/accounting/account-subtype.utils";
import type { Account, AccountSubtype } from "@/generated/prisma/client";

const ACCOUNT_TYPE_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVO: { label: "Activo", className: "bg-info/10 text-info dark:bg-info/20" },
  PASIVO: { label: "Pasivo", className: "bg-destructive/10 text-destructive dark:bg-destructive/20" },
  PATRIMONIO: {
    label: "Patrimonio",
    className: "bg-primary/10 text-primary dark:bg-primary/20",
  },
  INGRESO: { label: "Ingreso", className: "bg-success/10 text-success dark:bg-success/20" },
  GASTO: { label: "Gasto", className: "bg-warning/10 text-warning dark:bg-warning/20" },
};

const TYPE_OPTIONS = ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "GASTO"] as const;

type StatusFilter = "active" | "inactive" | "all";
type ExpandLevel = 1 | 2 | 3 | 4 | "all";

const DEFAULT_EXPAND_LEVEL: ExpandLevel = 3;
const DEFAULT_STATUS_FILTER: StatusFilter = "active";

type AccountWithChildren = Account & { children: Account[] };

interface AccountsPageClientProps {
  orgSlug: string;
  tree: AccountWithChildren[];
  allAccounts: Account[];
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function filterAccount(
  account: AccountWithChildren,
  query: string,
  typeFilter: string,
  statusFilter: StatusFilter,
): AccountWithChildren | null {
  const filteredChildren = ((account.children ?? []) as AccountWithChildren[])
    .map((c) => filterAccount(c, query, typeFilter, statusFilter))
    .filter((c): c is AccountWithChildren => c !== null);

  const matchesType = typeFilter === "ALL" || account.type === typeFilter;
  const matchesStatus =
    statusFilter === "all" ||
    (statusFilter === "active" && account.isActive) ||
    (statusFilter === "inactive" && !account.isActive);
  const matchesQuery =
    !query ||
    normalize(account.code).includes(query) ||
    normalize(account.name).includes(query);

  const selfVisible = matchesType && matchesStatus && matchesQuery;

  if (selfVisible || filteredChildren.length > 0) {
    return { ...account, children: filteredChildren };
  }
  return null;
}

function countAccounts(accounts: AccountWithChildren[]): number {
  let total = 0;
  for (const a of accounts) {
    total += 1;
    total += countAccounts((a.children ?? []) as AccountWithChildren[]);
  }
  return total;
}

function computeBaseExpanded(
  accounts: AccountWithChildren[],
  level: ExpandLevel,
  hasQuery: boolean,
): Set<string> {
  const ids = new Set<string>();
  function walk(list: AccountWithChildren[]) {
    for (const a of list) {
      const children = (a.children ?? []) as AccountWithChildren[];
      if (children.length === 0) continue;
      const shouldExpand =
        hasQuery || level === "all" || a.level < level;
      if (shouldExpand) ids.add(a.id);
      walk(children);
    }
  }
  walk(accounts);
  return ids;
}

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const normalizedText = normalize(text);
  const idx = normalizedText.indexOf(query);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-warning/30 text-foreground rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
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

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATUS_FILTER);
  const [expandLevel, setExpandLevel] = useState<ExpandLevel>(DEFAULT_EXPAND_LEVEL);

  const normalizedQuery = normalize(searchQuery.trim());
  const hasQuery = normalizedQuery.length > 0;

  const filteredTree = useMemo(() => {
    return tree
      .map((root) => filterAccount(root, normalizedQuery, typeFilter, statusFilter))
      .filter((r): r is AccountWithChildren => r !== null);
  }, [tree, normalizedQuery, typeFilter, statusFilter]);

  const totalCount = useMemo(() => countAccounts(tree), [tree]);
  const visibleCount = useMemo(() => countAccounts(filteredTree), [filteredTree]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    computeBaseExpanded(tree, DEFAULT_EXPAND_LEVEL, false),
  );

  useEffect(() => {
    setExpandedIds(computeBaseExpanded(filteredTree, expandLevel, hasQuery));
  }, [filteredTree, expandLevel, hasQuery]);

  const hasFilters =
    hasQuery ||
    typeFilter !== "ALL" ||
    statusFilter !== DEFAULT_STATUS_FILTER ||
    expandLevel !== DEFAULT_EXPAND_LEVEL;

  function handleClearFilters() {
    setSearchQuery("");
    setTypeFilter("ALL");
    setStatusFilter(DEFAULT_STATUS_FILTER);
    setExpandLevel(DEFAULT_EXPAND_LEVEL);
  }

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
      className: "bg-muted text-muted-foreground",
    };
    const canAddChild = account.isActive && account.level < 4;
    const canDeactivate = account.isActive && account.level > 2;

    const levelStyles = [
      "font-bold text-[15px] text-foreground bg-muted/50",
      "font-semibold text-sm text-foreground/90",
      "font-medium text-sm text-foreground/80",
      "text-sm text-muted-foreground",
    ];
    const rowStyle = levelStyles[level] ?? levelStyles[3];

    return (
      <div key={account.id}>
        <div
          className={`group flex items-center py-3 px-4 border-b hover:bg-accent/50 transition-colors ${rowStyle} ${
            !account.isActive ? "opacity-50" : ""
          }`}
          style={{ paddingLeft: `${level * 32 + 16}px` }}
        >
          {/* Tree connector line */}
          {level > 0 && (
            <span className="mr-2 text-muted-foreground/40 select-none" aria-hidden>
              {"└"}
            </span>
          )}

          {/* Expand/Collapse */}
          <div className="w-6 mr-2">
            {hasChildren && (
              <button
                onClick={() => toggleExpand(account.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={isExpanded ? "Colapsar" : "Expandir"}
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
          <span className="font-mono text-sm text-muted-foreground w-28 shrink-0">
            {highlight(account.code, normalizedQuery)}
          </span>

          {/* Name — inherits font weight from levelStyles */}
          <span className="flex-1">
            {highlight(account.name, normalizedQuery)}
          </span>

          {/* Type Badge */}
          <Badge className={`${typeConfig.className} mr-1`}>
            {typeConfig.label}
          </Badge>

          {/* Subtype Badge — solo visible para cuentas con subtipo asignado */}
          {account.subtype && (
            <Badge variant="secondary" className="mr-3 text-xs font-normal">
              {formatSubtypeLabel(account.subtype as AccountSubtype)}
            </Badge>
          )}

          {/* Status */}
          {!account.isActive && (
            <Badge variant="outline" className="text-muted-foreground mr-3">
              Inactiva
            </Badge>
          )}

          {/* Action buttons — visible on hover */}
          {account.isActive && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canAddChild && (
                <button
                  onClick={() => handleAddChild(account.id)}
                  className="p-1.5 rounded hover:bg-info/10 text-muted-foreground hover:text-info"
                  title="Agregar cuenta hija"
                >
                  <PlusCircle className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setEditAccount(account)}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {canDeactivate && (
                <button
                  onClick={() => setDeactivateAccount(account)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 sm:w-72"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tipos</SelectItem>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {ACCOUNT_TYPE_CONFIG[t]?.label ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="inactive">Inactivas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(expandLevel)}
            onValueChange={(v) =>
              setExpandLevel(v === "all" ? "all" : (Number(v) as ExpandLevel))
            }
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Expandir hasta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Nivel 1</SelectItem>
              <SelectItem value="2">Nivel 2</SelectItem>
              <SelectItem value="3">Nivel 3</SelectItem>
              <SelectItem value="4">Nivel 4</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Limpiar
            </Button>
          )}
        </div>

        <Button onClick={handleCreateRoot}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cuenta
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        {hasFilters ? (
          <>
            Mostrando <span className="font-medium text-foreground">{visibleCount}</span> de{" "}
            <span className="font-medium text-foreground">{totalCount}</span> cuentas
          </>
        ) : (
          <>
            <span className="font-medium text-foreground">{totalCount}</span> cuentas
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="flex items-center py-3 px-4 border-b bg-muted text-sm font-medium text-muted-foreground">
            <div className="w-6 mr-2" />
            <span className="w-24 shrink-0">Codigo</span>
            <span className="flex-1">Nombre</span>
            <span className="w-24 text-center">Tipo</span>
            <span className="w-20 text-center">Estado</span>
            <span className="w-24" />
          </div>

          {filteredTree.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              {hasFilters ? (
                <>
                  <p className="text-muted-foreground">Sin resultados</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Probá ajustar los filtros o limpiarlos
                  </p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">No hay cuentas registradas</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Cree la primera cuenta para comenzar
                  </p>
                </>
              )}
            </div>
          ) : (
            filteredTree.map((account) => renderAccount(account, 0))
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
