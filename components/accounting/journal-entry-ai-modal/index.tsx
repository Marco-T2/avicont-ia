"use client";

import { useCallback, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAgentQuery } from "@/features/ai-agent/client";
import type { JournalEntryAiContextHints } from "@/features/ai-agent/server";
import { ParsedForm } from "./parsed-form";
import { useCatalogPrefetch } from "./use-catalog-prefetch";
import { journalEntryAiReducer, initialState } from "./fsm";
import type { SuggestionData } from "./types";

interface JournalEntryAiModalProps {
  orgSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── FSM ──────────────────────────────────────────────────────────────────
// Transiciones explícitas. journal_ai_abandoned se emite cuando el usuario
// cancela o cierra el modal después de READY (ya hubo parse exitoso) sin
// confirmar. NO se emite en "Limpiar y reescribir" — eso es iteración, no
// abandono.
//
//   IDLE → PARSING (click Interpretar)
//   PARSING → READY (parse OK con suggestion)
//   PARSING → ERROR (parse falló o sin suggestion)
//   PARSING → IDLE (parse devolvió mensaje sin suggestion: pidiendo aclaración)
//   READY → PARSING (corrección NL en lenguaje natural)
//   READY → CONFIRMING (click "Confirmar y crear")
//   READY → IDLE (Limpiar y reescribir; NO emite abandoned)
//   CONFIRMING → DONE → cierre + toast + highlight
//   CONFIRMING → ERROR (falló confirm)
//   ERROR → READY (volver al form si hay snapshot previo)
//   ERROR → IDLE (volver al inicio)
//
// El cierre por X / ESC / click fuera dispara onOpenChange(false). Si el
// estado es READY, emitimos journal_ai_abandoned antes de cerrar.

export default function JournalEntryAiModal({
  orgSlug,
  open,
  onOpenChange,
}: JournalEntryAiModalProps) {
  const router = useRouter();
  const { query, confirm, reportEvent, isLoading } = useAgentQuery(orgSlug);
  const prefetch = useCatalogPrefetch(orgSlug, open);

  // FSM extraído a reducer puro en ./fsm.ts. Cada cambio de estado pasa por
  // dispatch — facilita testing aislado del flow de transiciones (ver
  // __tests__/fsm.test.ts).
  const [state, dispatch] = useReducer(journalEntryAiReducer, initialState);
  const [prompt, setPrompt] = useState("");
  const [correction, setCorrection] = useState("");
  // Texto original de la PRIMERA interpretación — se mantiene a lo largo de
  // las correcciones NL para audit (no se "actualiza" con cada round-trip;
  // siempre representa lo que el usuario pidió originalmente).
  const originalTextRef = useRef<string>("");

  // ── Acciones ────────────────────────────────────────────────────────

  const handleInterpret = useCallback(async () => {
    if (!prompt.trim()) return;
    originalTextRef.current = prompt.trim();
    dispatch({ type: "INTERPRET_START" });
    try {
      const hints: JournalEntryAiContextHints = prefetch.catalog
        ? {
            catalog: {
              bank: prefetch.catalog.bank,
              cash: prefetch.catalog.cash,
              expense: prefetch.catalog.expense,
            },
          }
        : {};
      const res = await query({
        prompt: prompt.trim(),
        mode: "journal-entry-ai",
        contextHints: hints,
      });
      if (res.suggestion?.action === "createJournalEntry") {
        dispatch({
          type: "INTERPRET_SUCCESS",
          data: res.suggestion.data,
          message: res.message,
        });
      } else {
        dispatch({ type: "INTERPRET_NO_SUGGESTION" });
        toast(res.message);
      }
    } catch (err) {
      dispatch({
        type: "INTERPRET_ERROR",
        message: err instanceof Error ? err.message : "Error al interpretar",
      });
    }
  }, [prompt, query, prefetch.catalog]);

  const handleCorrection = useCallback(async () => {
    if (state.phase !== "ready" || !correction.trim()) return;
    const previous = state.data;
    dispatch({ type: "CORRECTION_START", previous });
    try {
      const hints: JournalEntryAiContextHints = {
        ...(prefetch.catalog && {
          catalog: {
            bank: prefetch.catalog.bank,
            cash: prefetch.catalog.cash,
            expense: prefetch.catalog.expense,
          },
        }),
        formState: previous as unknown as Record<string, unknown>,
      };
      const res = await query({
        prompt: correction.trim(),
        mode: "journal-entry-ai",
        contextHints: hints,
      });
      if (res.suggestion?.action === "createJournalEntry") {
        dispatch({
          type: "CORRECTION_SUCCESS",
          data: res.suggestion.data,
          message: res.message,
        });
        setCorrection("");
      } else {
        // LLM respondió sin nuevo shape — preservamos el form anterior y
        // mostramos el mensaje del agente. Reusamos CORRECTION_SUCCESS con
        // el previous para volver a READY sin cambios.
        dispatch({
          type: "CORRECTION_SUCCESS",
          data: previous,
          message: res.message,
        });
        toast(res.message);
      }
    } catch (err) {
      dispatch({
        type: "CORRECTION_ERROR",
        message: err instanceof Error ? err.message : "Error en la corrección",
        previous,
      });
    }
  }, [state, correction, query, prefetch.catalog]);

  const resetAll = useCallback(() => {
    dispatch({ type: "RESET" });
    setPrompt("");
    setCorrection("");
    originalTextRef.current = "";
  }, []);

  const handleConfirm = useCallback(async () => {
    if (state.phase !== "ready") return;
    const dataToSubmit = state.data;
    dispatch({ type: "CONFIRM_START", data: dataToSubmit });
    try {
      const result = await confirm({
        action: "createJournalEntry",
        data: dataToSubmit,
      });
      const newId = (result.data?.id as string | undefined) ?? null;
      toast.success(result.message);
      resetAll();
      onOpenChange(false);
      if (newId) {
        router.push(`/${orgSlug}/accounting/journal?highlightId=${newId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      dispatch({
        type: "CONFIRM_ERROR",
        message: err instanceof Error ? err.message : "Error al confirmar",
        previous: dataToSubmit,
      });
    }
  }, [state, confirm, onOpenChange, router, orgSlug, resetAll]);

  const handleResetAndRewrite = useCallback(() => {
    // NO emite journal_ai_abandoned — es iteración, no abandono.
    resetAll();
  }, [resetAll]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && state.phase === "ready") {
        // Cierre por X / ESC / click fuera con parse exitoso sin confirmar.
        reportEvent("journal_ai_abandoned");
      }
      if (!next) resetAll();
      onOpenChange(next);
    },
    [state.phase, reportEvent, resetAll, onOpenChange],
  );

  const handleCancel = useCallback(() => {
    // Botón "Cancelar" en footer del READY — semánticamente equivalente
    // al cierre por X.
    if (state.phase === "ready") {
      reportEvent("journal_ai_abandoned");
    }
    resetAll();
    onOpenChange(false);
  }, [state.phase, reportEvent, resetAll, onOpenChange]);

  // ── Render ──────────────────────────────────────────────────────────

  const showForm = state.phase === "ready" || state.phase === "confirming";
  const formData = showForm ? state.data : null;
  const formDisabled = state.phase === "confirming" || isLoading;
  const canConfirm =
    state.phase === "ready" &&
    state.data.amount > 0 &&
    state.data.description.trim().length >= 3 &&
    state.data.lines.every((l) => l.accountId !== "") &&
    isContactValid(state.data);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Crear Asiento con IA
          </DialogTitle>
          <DialogDescription>
            Describí la operación en lenguaje natural y la IA propone un asiento en borrador. Revisalo y confirmalo para crearlo.
          </DialogDescription>
        </DialogHeader>

        {prefetch.error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {prefetch.error}
          </div>
        )}

        {prefetch.configWarnings.length > 0 && (
          <div className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
            {prefetch.configWarnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}

        {/* Banner del texto original (visible en READY/ERROR para audit) */}
        {(state.phase === "ready" || state.phase === "confirming" || state.phase === "error") &&
          originalTextRef.current && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Vos pediste: </span>
              <span className="italic">«{originalTextRef.current}»</span>
            </div>
          )}

        {/* Mensaje del agente cuando viene (ej. "Asumí fecha 2026-04-22 (lunes)…") */}
        {state.phase === "ready" && state.message && (
          <div className="rounded-md bg-info/10 px-3 py-2 text-sm text-info-foreground">
            {state.message}
          </div>
        )}

        {state.phase === "error" && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </div>
        )}

        {/* IDLE: textarea + botón Interpretar */}
        {(state.phase === "idle" || state.phase === "parsing") && !showForm && (
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">¿Qué operación querés registrar?</Label>
            <Textarea
              id="ai-prompt"
              placeholder="Ej: compra de alimento balanceado por Bs. 5000 al banco BCP a Granos del Sur"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={state.phase === "parsing" || prefetch.isLoading}
              autoFocus
            />
          </div>
        )}

        {/* READY/CONFIRMING: form pre-llenado */}
        {showForm && formData && (
          <ParsedForm
            orgSlug={orgSlug}
            data={formData}
            catalog={prefetch.catalog}
            onChange={(next) => dispatch({ type: "PATCH_FORM", data: next })}
            disabled={formDisabled}
          />
        )}

        {/* Correction input (solo en READY) */}
        {state.phase === "ready" && (
          <div className="space-y-1 border-t pt-3">
            <Label htmlFor="ai-correction" className="text-xs text-muted-foreground">
              ¿Algo está mal? Escribilo en lenguaje natural y la IA actualiza el formulario.
            </Label>
            <div className="flex gap-2">
              <Textarea
                id="ai-correction"
                placeholder="Ej: el monto era 4500 / cambialo al banco Mercantil"
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
                rows={1}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && correction.trim()) {
                    e.preventDefault();
                    handleCorrection();
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCorrection}
                disabled={!correction.trim() || isLoading}
              >
                Aplicar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {(state.phase === "idle" || state.phase === "parsing") && (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={state.phase === "parsing"}>
                Cancelar
              </Button>
              <Button
                onClick={handleInterpret}
                disabled={!prompt.trim() || state.phase === "parsing" || prefetch.isLoading}
              >
                {state.phase === "parsing" && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Interpretar
              </Button>
            </>
          )}

          {showForm && (
            <>
              <Button variant="ghost" onClick={handleResetAndRewrite} disabled={formDisabled}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar y reescribir
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={handleCancel} disabled={formDisabled}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={!canConfirm || formDisabled}>
                {state.phase === "confirming" && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Confirmar y crear borrador
              </Button>
            </>
          )}

          {state.phase === "error" && (
            <>
              <Button variant="outline" onClick={resetAll}>
                Reescribir
              </Button>
              {state.previous && (
                <Button onClick={() => dispatch({ type: "BACK_TO_FORM" })}>
                  Volver al formulario
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isContactValid(data: SuggestionData): boolean {
  if (data.template === "bank_deposit") return true;
  const expId = data.lines.find((l) => l.debit > 0)?.accountId ?? "";
  const expInfo = data.resolvedAccounts[expId];
  if (!expInfo?.requiresContact) return true;
  return !!data.contactId;
}
