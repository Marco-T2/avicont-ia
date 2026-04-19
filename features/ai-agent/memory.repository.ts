import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";

interface ChatMessageRecord {
  role: string;
  content: string;
  createdAt: Date;
}

export class ChatMemoryRepository extends BaseRepository {
  /** Get recent messages for a session, ordered chronologically. */
  async getRecentMessages(
    sessionId: string,
    limit = 10,
  ): Promise<ChatMessageRecord[]> {
    return this.db.chatMessage.findMany({
      where: { sessionId },
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

  /** Clear all messages for a session. */
  async clearSession(sessionId: string): Promise<void> {
    await this.db.chatMessage.deleteMany({
      where: { sessionId },
    });
  }
}
