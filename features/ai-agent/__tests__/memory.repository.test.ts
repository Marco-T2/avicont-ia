/**
 * Cross-tenant isolation tests for ChatMemoryRepository.
 *
 * Regression guard for commit ba70077 — prior to that fix, getRecentMessages
 * and clearSession filtered only by sessionId, ignoring the required
 * organizationId column on ChatMessage. A user in org A who obtained a
 * sessionId from org B could read or wipe B's chat history.
 *
 * Strategy: real DB, two organizations sharing a sessionId, assert that
 * each org only sees its own messages on reads, and clearing one org's
 * session leaves the other's history untouched.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ChatMemoryRepository } from "../memory.repository";

const repo = new ChatMemoryRepository();

let orgAId: string;
let orgBId: string;
let userId: string;
const SHARED_SESSION_ID = `shared-session-${Date.now()}`;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-user-chat-memory-${Date.now()}`,
      email: `chat-memory-${Date.now()}@test.com`,
      name: "Chat Memory Test User",
    },
  });
  userId = user.id;

  const orgA = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-chat-a-${Date.now()}`,
      name: "Chat Memory Org A",
      slug: `test-org-chat-a-${Date.now()}`,
    },
  });
  orgAId = orgA.id;

  const orgB = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-chat-b-${Date.now()}`,
      name: "Chat Memory Org B",
      slug: `test-org-chat-b-${Date.now()}`,
    },
  });
  orgBId = orgB.id;
});

afterAll(async () => {
  await prisma.chatMessage.deleteMany({
    where: { sessionId: SHARED_SESSION_ID },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [orgAId, orgBId] } },
  });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("ChatMemoryRepository — cross-tenant isolation", () => {
  it("getRecentMessages only returns messages for the caller's organization", async () => {
    await repo.saveMessage(SHARED_SESSION_ID, orgAId, userId, "user", "prompt from A");
    await repo.saveMessage(SHARED_SESSION_ID, orgAId, userId, "assistant", "reply to A");
    await repo.saveMessage(SHARED_SESSION_ID, orgBId, userId, "user", "prompt from B");

    const messagesA = await repo.getRecentMessages(orgAId, SHARED_SESSION_ID);
    const messagesB = await repo.getRecentMessages(orgBId, SHARED_SESSION_ID);

    expect(messagesA).toHaveLength(2);
    expect(messagesA.map((m) => m.content)).toEqual(["prompt from A", "reply to A"]);

    expect(messagesB).toHaveLength(1);
    expect(messagesB[0].content).toBe("prompt from B");
  });

  it("clearSession only deletes messages for the caller's organization", async () => {
    // Clearing org A's session must not touch org B's messages
    await repo.clearSession(orgAId, SHARED_SESSION_ID);

    const messagesA = await repo.getRecentMessages(orgAId, SHARED_SESSION_ID);
    const messagesB = await repo.getRecentMessages(orgBId, SHARED_SESSION_ID);

    expect(messagesA).toHaveLength(0);
    expect(messagesB).toHaveLength(1);
    expect(messagesB[0].content).toBe("prompt from B");
  });

  it("getRecentMessages returns empty when the session belongs to a different org", async () => {
    // A fresh sessionId used only by org B; org A must see nothing.
    const bOnlySession = `b-only-${Date.now()}`;
    await repo.saveMessage(bOnlySession, orgBId, userId, "user", "only-in-b");

    const messagesFromA = await repo.getRecentMessages(orgAId, bOnlySession);
    expect(messagesFromA).toHaveLength(0);

    // Cleanup this extra row directly (not covered by afterAll's SHARED_SESSION_ID filter)
    await prisma.chatMessage.deleteMany({ where: { sessionId: bOnlySession } });
  });
});
