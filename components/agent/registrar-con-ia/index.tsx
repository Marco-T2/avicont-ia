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
import { useAgentQuery } from "@/features/ai-agent/client";
import { cn } from "@/lib/utils";
import type { ContextHints, Message, ModalStatus } from "./types";

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

export default function RegistrarConIAModal({
  orgSlug,
  open,
  onOpenChange,
  contextHints,
}: RegistrarConIAModalProps) {
  // contextHints: prop drilling lotId/farmId desde page → modal → backend
  // contextHints injection. C1 paired wire-up integration backend confirm endpoint.
  void contextHints;

  const [messages] = useState<Message[]>([GREETING]);
  const [status] = useState<ModalStatus>("idle");
  const [input, setInput] = useState("");
  // useAgentQuery wired-up DEFER C1 — IDLE skeleton-only este ciclo per Marco lock
  // D-GREEN-C0-IDLE-SCOPE. isLoading consumido para disabled state mientras llega C1.
  const { isLoading } = useAgentQuery(orgSlug);

  // Early return paired sister precedent agent-chat.tsx:89 — guard portal mount
  // jsdom-safe (Radix Dialog open=false content render edge cases).
  if (!open) return null;

  const handleChipClick = (seed: string) => {
    setInput(seed);
  };

  const handleSend = () => {
    // C1 paired wire-up backend integration — query + dispatch THINKING.
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🤖 Registrar con IA</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-2">
          {messages.map((msg, i) => (
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
          ))}
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
            disabled={status === "thinking" || isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || status === "thinking" || isLoading}
          >
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
