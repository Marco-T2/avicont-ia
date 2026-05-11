"use client";

import { useCallback, useState } from "react";
import type { AgentResponse, AgentSuggestion } from "./agent.types";
import type { JournalEntryAiContextHints } from "./journal-entry-ai.prompt";

// ── Types del payload del cliente ─────────────────────────────────────────

// Chat-mode contextHints — granjos lot/farm awareness page → modal → backend.
// Discriminated union per-mode (chat vs journal-entry-ai) — shape distinct axis.
export interface ChatContextHints {
  lotId?: string;
  farmId?: string;
  lotName?: string;
  farmName?: string;
}

export interface AgentQueryParams {
  prompt: string;
  mode?: "chat" | "journal-entry-ai";
  contextHints?: JournalEntryAiContextHints | ChatContextHints;
  /** session_id se omite en mode='journal-entry-ai' (stateless por diseño v1) */
  sessionId?: string;
}

export interface AgentConfirmResponse {
  message: string;
  data: Record<string, unknown> & { displayNumber?: string };
}

// ── Hook ──────────────────────────────────────────────────────────────────
//
// Cliente HTTP del agente para componentes React. Reemplaza el fetch directo
// que vivía dentro de agent-chat.tsx (no migrado en este PR — coexisten). El
// modal de captura asistida lo usa para query (parse) + confirm (crear draft)
// + reportAbandoned (telemetría one-shot al cierre sin confirmar).

export function useAgentQuery(orgSlug: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const query = useCallback(
    async (params: AgentQueryParams): Promise<AgentResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/organizations/${orgSlug}/agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: params.prompt,
            mode: params.mode ?? "chat",
            ...(params.contextHints && { contextHints: params.contextHints }),
            ...(params.sessionId && { session_id: params.sessionId }),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as AgentResponse;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [orgSlug],
  );

  const confirm = useCallback(
    async (suggestion: AgentSuggestion): Promise<AgentConfirmResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/organizations/${orgSlug}/agent?action=confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ suggestion }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as AgentConfirmResponse;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [orgSlug],
  );

  // Telemetría fire-and-forget. NO setea isLoading/error — el cierre del
  // modal no debe bloquear ni mostrar errores al usuario por un evento de
  // observabilidad. Si falla, swallow silencioso (logueado en consola dev).
  const reportEvent = useCallback(
    (event: "journal_ai_abandoned"): void => {
      void fetch(`/api/organizations/${orgSlug}/agent?action=telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
        keepalive: true,
      }).catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`Telemetry event '${event}' failed:`, err);
        }
      });
    },
    [orgSlug],
  );

  return { query, confirm, reportEvent, isLoading, error };
}
