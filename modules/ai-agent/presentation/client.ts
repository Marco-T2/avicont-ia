"use client";

import { useCallback, useState } from "react";
import type {
  AgentResponse,
  AgentSuggestion,
} from "../domain/types/agent.types";
import type { JournalEntryAiContextHints } from "../domain/prompts/journal-entry-ai.prompt";

/**
 * Presentation/client barrel for modules/ai-agent (POC ai-agent-hex C3).
 *
 * REQ-002: `"use client"` MUST be line 1 (positional). Per PRE-C3 Next.js
 * 16.2.1 lock (use-client.md L14): "add the 'use client' directive at the
 * top of the file, before any imports". The directive is a string literal
 * declaration; double quotes per codebase precedent (features/ai-agent/
 * client.ts L1 pre-migration).
 *
 * Boundary discipline (per PRE-C3 lock, server-and-client-components.md L569):
 * this module MUST NOT import from `../presentation/server` (would be a Next.js
 * build error). Communication crosses via HTTP (fetch) — preserved verbatim
 * from pre-migration `features/ai-agent/client.ts`.
 *
 * AXIS-DISTINCT (honest surface): this is the FIRST hex with a client barrel
 * — D5 dual-barrel convention lock. Type imports come from domain/ directly
 * (NOT through server.ts) so the boundary stays clean.
 */

// ── Types del payload del cliente ─────────────────────────────────────────

/**
 * Chat-mode contextHints — granjos lot/farm awareness page → modal → backend.
 * Discriminated union per-mode (chat vs journal-entry-ai) — shape distinct axis.
 */
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
// Cliente HTTP del agente para componentes React. Crosses the server boundary
// via fetch() — NEVER via direct import of the server barrel. Preserved from
// pre-migration features/ai-agent/client.ts (verbatim shape).

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
