"use client";

import { useEffect, useState } from "react";
import type { CatalogAccount, CatalogBundle } from "./types";

interface CatalogResponse {
  accounts: CatalogAccount[];
  configRequired: boolean;
  message?: string;
}

interface PrefetchState {
  catalog: CatalogBundle | null;
  isLoading: boolean;
  error: string | null;
  /** Mensaje del backend cuando configRequired=true en algún propósito */
  configWarnings: string[];
}

// Pre-fetch eager del catálogo (cuentas de banco, caja y gasto) cuando el
// modal se abre. Decisión: eager > lazy. El usuario abre el modal sabiendo
// qué quiere registrar; el costo de las 3 llamadas es trivial frente al
// costo de Gemini que viene después y la latencia percibida importa.
//
// Si la métrica journal_ai_abandoned muestra alta tasa de abrir-y-cerrar
// sin escribir, re-evaluamos a lazy en una iteración futura.
export function useCatalogPrefetch(orgSlug: string, open: boolean): PrefetchState {
  const [state, setState] = useState<PrefetchState>({
    catalog: null,
    isLoading: false,
    error: null,
    configWarnings: [],
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const [bankRes, cashRes, expenseRes] = await Promise.all([
          fetchPurpose(orgSlug, "bank"),
          fetchPurpose(orgSlug, "cash"),
          fetchPurpose(orgSlug, "expense"),
        ]);
        if (cancelled) return;

        const warnings: string[] = [];
        for (const r of [bankRes, cashRes, expenseRes]) {
          if (r.configRequired && r.message) warnings.push(r.message);
        }

        const byId = new Map<string, CatalogAccount>();
        for (const a of [...bankRes.accounts, ...cashRes.accounts, ...expenseRes.accounts]) {
          byId.set(a.id, a);
        }

        setState({
          catalog: {
            bank: bankRes.accounts,
            cash: cashRes.accounts,
            expense: expenseRes.accounts,
            byId,
          },
          isLoading: false,
          error: null,
          configWarnings: warnings,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          catalog: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "Error al cargar catálogo",
          configWarnings: [],
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, open]);

  return state;
}

async function fetchPurpose(
  orgSlug: string,
  purpose: "bank" | "cash" | "expense",
): Promise<CatalogResponse> {
  const res = await fetch(
    `/api/organizations/${orgSlug}/accounts?purpose=${purpose}`,
  );
  if (!res.ok) throw new Error(`Error al cargar cuentas de ${purpose}`);
  return res.json();
}
