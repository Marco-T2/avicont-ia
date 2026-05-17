"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Loader2, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { deriveModuleHint } from "./derive-module-hint";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  orgSlug: string;
}

export function AgentChat({ isOpen, onClose, orgSlug }: AgentChatProps) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const lastPromptRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");

  // Generate session ID on mount
  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID();
    setHasSession(true);
  }, []);

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      lastPromptRef.current = prompt;
      setError(null);

      const userMessage: ChatMessage = { role: "user", content: prompt };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const moduleHint = deriveModuleHint(pathname ?? "");
        const res = await fetch(`/api/organizations/${orgSlug}/agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            session_id: sessionIdRef.current,
            surface: "sidebar-qa",
            module_hint: moduleHint,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Error al comunicarse con el agente");
        }

        const data = await res.json();
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message || data.response || JSON.stringify(data),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error desconocido"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [orgSlug, pathname]
  );

  const handleRetry = useCallback(() => {
    if (lastPromptRef.current) {
      setMessages((prev) => prev.slice(0, -1));
      sendMessage(lastPromptRef.current);
    }
  }, [sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l bg-white shadow-lg sm:w-96",
        "animate-in slide-in-from-right duration-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold">Agente IA</h3>
          {hasSession && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Sesión activa
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 overflow-hidden p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bot className="h-10 w-10" />
            <p className="text-sm">Preguntale algo al agente</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] min-w-0 rounded-lg px-3 py-2 text-sm [overflow-wrap:anywhere]",
                msg.role === "user"
                  ? "ml-auto whitespace-pre-wrap bg-blue-600 text-white"
                  : "mr-auto bg-muted"
              )}
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    code: ({ children }) => (
                      <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs">{children}</code>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          ))}
          {isLoading && (
            <div className="mr-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pensando...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="ghost" size="icon-sm" onClick={handleRetry}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
