import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";

interface ChatMessageRecord {
  role: string;
  content: string;
  createdAt: Date;
}

export class ChatMemoryRepository extends BaseRepository {
  /**
   * Get recent messages for a session, ordered chronologically.
   *
   * SECURITY: sessionId is client-supplied (see components/agent/agent-chat.tsx
   * where it is generated with crypto.randomUUID()). Scoping by organizationId
   * is mandatory — without it, a user of org A who obtains a sessionId from
   * org B (replay, devtools, leaked logs) could read B's chat history.
   */
  async getRecentMessages(
    organizationId: string,
    sessionId: string,
    limit = 10,
  ): Promise<ChatMessageRecord[]> {
    return this.db.chatMessage.findMany({
      where: { sessionId, organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { role: true, content: true, createdAt: true },
    }).then((msgs) => msgs.reverse());
  }

  /** Save a single message to the session. */
  async saveMessage(
    sessionId: string,
    organizationId: string,
    userId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<void> {
    await this.db.chatMessage.create({
      data: { sessionId, organizationId, userId, role, content },
    });
  }

  /**
   * Clear all messages for a (org, session) pair.
   *
   * SECURITY: scoped by organizationId for the same reason as getRecentMessages —
   * without it, a known sessionId from another tenant could be wiped.
   */
  async clearSession(organizationId: string, sessionId: string): Promise<void> {
    await this.db.chatMessage.deleteMany({
      where: { sessionId, organizationId },
    });
  }
}
