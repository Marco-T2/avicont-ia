"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentQuery } from "@/modules/ai-agent/presentation/client";
import { formatDateBO } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type {
  AgentSuggestion,
  ContextHints,
  Message,
  ModalStatus,
} from "./types";

interface RegistrarConIAModalProps {
  orgSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextHints: ContextHints;
}

const GREETING: Message = {
  role: "bot",
  content: "Hola, ¿qué querés registrar?",
};

const CHIP_SEEDS = {
  expense: "Quiero registrar un gasto: ",
  mortality: "Quiero registrar mortalidad: ",
  other: "",
} as const;

const CANCEL_CONTINUATION = "¿Querés reformular o registrar otra cosa?";

export default function RegistrarConIAModal({
  orgSlug,
  open,
  onOpenChange,
  contextHints,
}: RegistrarConIAModalProps) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [status, setStatus] = useState<ModalStatus>("idle");
  const [input, setInput] = useState("");
  const [pendingSuggestion, setPendingSuggestion] =
    useState<AgentSuggestion | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>("");
  const { query, confirm, isLoading } = useAgentQuery(orgSlug);

  // Early return paired sister precedent agent-chat.tsx:89 — guard portal mount
  // jsdom-safe (Radix Dialog open=false content render edge cases).
  if (!open) return null;

  const handleChipClick = (seed: string) => {
    setInput(seed);
  };

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt) return;
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setInput("");
    setLastPrompt(prompt);
    setStatus("thinking");
    setPendingSuggestion(null);
    try {
      const res = await query({
        prompt,
        mode: "chat",
        contextHints: {
          lotId: contextHints.lotId,
          farmId: contextHints.farmId,
        },
      });
      if (res.suggestion && res.requiresConfirmation) {
        const suggestion = res.suggestion;
        setPendingSuggestion(suggestion);
        setMessages((prev) => [
          ...prev,
          { role: "confirm-card", content: res.message, suggestion },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", content: res.message }]);
      }
      setStatus("idle");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al consultar al agente";
      setMessages((prev) => [...prev, { role: "bot", content: message }]);
      setStatus("error");
    }
  };

  const handleConfirm = async () => {
    if (!pendingSuggestion) return;
    setStatus("confirming");
    try {
      const res = await confirm(pendingSuggestion);
      setPendingSuggestion(null);
      setMessages((prev) => [...prev, { role: "bot", content: res.message }]);
      setStatus("idle");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al confirmar";
      setMessages((prev) => [...prev, { role: "bot", content: message }]);
      setStatus("error");
    }
  };

  const handleCancel = () => {
    setPendingSuggestion(null);
    setMessages((prev) => [
      ...prev,
      { role: "bot", content: CANCEL_CONTINUATION },
    ]);
    setStatus("idle");
  };

  // DRY violation accepted trade-off — handleSend+handleRetry duplicate query+
  // response+catch block per RED regex discipline canonical heredado matures
  // cumulative cross-POC (regex /handleSend = async ... await query(/ requires
  // literal await query inside handleSend body, NOT in helper). Cleanup pending
  // engram 24mo: feedback/handle-send-handle-retry-dry-violation-25-loc-duplicate.
  const handleRetry = async () => {
    if (!lastPrompt) return;
    setStatus("thinking");
    setPendingSuggestion(null);
    try {
      const res = await query({
        prompt: lastPrompt,
        mode: "chat",
        contextHints: {
          lotId: contextHints.lotId,
          farmId: contextHints.farmId,
        },
      });
      if (res.suggestion && res.requiresConfirmation) {
        const suggestion = res.suggestion;
        setPendingSuggestion(suggestion);
        setMessages((prev) => [
          ...prev,
          { role: "confirm-card", content: res.message, suggestion },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", content: res.message }]);
      }
      setStatus("idle");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al consultar al agente";
      setMessages((prev) => [...prev, { role: "bot", content: message }]);
      setStatus("error");
    }
  };

  const renderConfirmCardFields = (suggestion: AgentSuggestion) => {
    const lotIdRaw =
      "lotId" in suggestion.data
        ? (suggestion.data.lotId as string)
        : "";
    const lotLabel = contextHints.lotName ?? lotIdRaw;
    if (suggestion.action === "createExpense") {
      const { amount, category, description, date } = suggestion.data;
      return (
        <>
          <div>Bs. {Number(amount).toFixed(2)}</div>
          <div>{category}</div>
          {description && <div>{description}</div>}
          <div>{formatDateBO(date)}</div>
          <div>{lotLabel}</div>
        </>
      );
    }
    if (suggestion.action === "logMortality") {
      const { count, cause, date } = suggestion.data;
      return (
        <>
          <div>{count}</div>
          {cause && <div>{cause}</div>}
          <div>{formatDateBO(date)}</div>
          <div>{lotLabel}</div>
        </>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🤖 Registrar con IA</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-2">
          {messages.map((msg, i) => {
            if (msg.role === "confirm-card") {
              const isLatest =
                i === messages.length - 1 && pendingSuggestion !== null;
              return (
                <div
                  key={i}
                  className="mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <div className="mb-2 text-xs text-muted-foreground">
                    {msg.content}
                  </div>
                  <div className="space-y-1">
                    {renderConfirmCardFields(msg.suggestion)}
                  </div>
                  {isLatest && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={handleConfirm}
                        disabled={status !== "idle" || isLoading}
                        size="default"
                      >
                        Confirmar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={status !== "idle" || isLoading}
                        size="default"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : "mr-auto bg-muted",
                )}
              >
                {msg.content}
              </div>
            );
          })}
          {status === "error" && lastPrompt && (
            <div className="mr-auto">
              <Button variant="outline" size="sm" onClick={handleRetry}>
                🔄 Reintentar
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleChipClick(CHIP_SEEDS.expense)}
          >
            💰 Gasto
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleChipClick(CHIP_SEEDS.mortality)}
          >
            💀 Mortalidad
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleChipClick(CHIP_SEEDS.other)}
          >
            ✏️ Otro
          </Button>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribí qué pasó..."
            rows={2}
            className="flex-1"
            disabled={
              status === "thinking" || status === "confirming" || isLoading
            }
          />
          <Button
            onClick={handleSend}
            disabled={
              !input.trim() ||
              status === "thinking" ||
              status === "confirming" ||
              isLoading
            }
          >
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
