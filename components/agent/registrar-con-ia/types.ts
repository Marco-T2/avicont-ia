import type { AgentSuggestion } from "@/features/ai-agent/server";

export type Message =
  | { role: "user"; content: string }
  | { role: "bot"; content: string }
  | { role: "confirm-card"; content: string; suggestion: AgentSuggestion };

export type ContextHints = {
  lotId?: string;
  farmId?: string;
};

export type ModalStatus = "idle" | "thinking" | "confirming" | "done" | "error";

export type RegistrarConIAState = {
  messages: Message[];
  status: ModalStatus;
};

export type { AgentSuggestion } from "@/features/ai-agent/server";
