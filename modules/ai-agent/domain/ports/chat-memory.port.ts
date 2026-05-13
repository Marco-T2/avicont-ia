/**
 * Outbound port for chat memory persistence.
 * Domain layer: no server-only, no Prisma runtime, no SDK deps.
 */

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  createdAt?: Date;
}

/**
 * ChatMemoryPort — read/write session messages.
 */
export interface ChatMemoryPort {
  findRecent(
    orgId: string,
    userId: string,
    sessionId: string,
    limit: number,
  ): Promise<ChatMessage[]>;
  append(
    orgId: string,
    userId: string,
    sessionId: string,
    message: ChatMessage,
  ): Promise<void>;
}
