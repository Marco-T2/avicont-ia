import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type {
  ChatMemoryPort,
  ChatMessage,
} from "../../domain/ports/chat-memory.port";

/**
 * PrismaChatMemoryRepository — implements ChatMemoryPort.
 * Renamed from features/ai-agent/memory.repository.ts ChatMemoryRepository.
 * Port methods (findRecent/append) translate to legacy method names internally.
 *
 * SECURITY: scoped by organizationId — see legacy comment preserved below.
 * sessionId is client-supplied (crypto.randomUUID()); without organizationId
 * scoping a user of org A could read org B's chat history.
 */
export class PrismaChatMemoryRepository extends BaseRepository implements ChatMemoryPort {
  /**
   * Get recent messages for a session, ordered chronologically.
   *
   * Port surface: findRecent(orgId, userId, sessionId, limit) → ChatMessage[]
   * The legacy method took (orgId, sessionId, limit) — userId is now in the
   * port signature for symmetry with append(), but is not used in the query
   * (org+session scoping is sufficient per legacy invariant).
   */
  async findRecent(
    orgId: string,
    _userId: string,
    sessionId: string,
    limit: number,
  ): Promise<ChatMessage[]> {
    const rows = await this.db.chatMessage.findMany({
      where: { sessionId, organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { role: true, content: true, createdAt: true },
    });
    return rows.reverse().map((r) => ({
      role: r.role === "user" ? "user" : "model",
      content: r.content,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Persist a single message to the session.
   * Port surface: append(orgId, userId, sessionId, message)
   */
  async append(
    orgId: string,
    userId: string,
    sessionId: string,
    message: ChatMessage,
  ): Promise<void> {
    const role = message.role === "user" ? "user" : "assistant";
    await this.db.chatMessage.create({
      data: {
        sessionId,
        organizationId: orgId,
        userId,
        role,
        content: message.content,
      },
    });
  }
}
