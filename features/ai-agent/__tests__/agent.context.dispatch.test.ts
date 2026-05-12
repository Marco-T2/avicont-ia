/**
 * Unit tests for the role-based dispatch inside buildAgentContext /
 * buildSocioContext. Validates the wiring between role → memberId resolution
 * → repository filter, without hitting the database (the actual filter
 * behavior is covered by agent-context.repository.test.ts).
 *
 * Specifically guards three invariants:
 *   1. role="member" → findMemberIdByUserId is called and its result is
 *      forwarded to findFarmsWithActiveLots / findRecentExpenses.
 *   2. role="admin"/"owner" → findMemberIdByUserId is NOT called and the
 *      repo methods receive `undefined` (no filter, see all org farms).
 *   3. role="member" with no active membership → the sentinel "__no_member__"
 *      is forwarded so the repo returns nothing (fail-closed).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindMemberIdByUserId,
  mockFindFarms,
  mockFindRecentExpenses,
  mockCountJournalEntries,
  mockRagSearch,
} = vi.hoisted(() => ({
  mockFindMemberIdByUserId: vi.fn(),
  mockFindFarms: vi.fn(),
  mockFindRecentExpenses: vi.fn(),
  mockCountJournalEntries: vi.fn(),
  mockRagSearch: vi.fn(),
}));

vi.mock("../agent-context.repository", () => ({
  AgentContextRepository: class {
    findMemberIdByUserId = mockFindMemberIdByUserId;
    findFarmsWithActiveLots = mockFindFarms;
    findRecentExpenses = mockFindRecentExpenses;
    countJournalEntries = mockCountJournalEntries;
  },
}));

vi.mock("@/features/documents/rag/server", () => ({
  RagService: class {
    search = mockRagSearch;
  },
}));

import { buildAgentContext } from "../agent.context";

const ORG = "org_1";
const USER = "user_1";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFarms.mockResolvedValue([]);
  mockFindRecentExpenses.mockResolvedValue([]);
  mockCountJournalEntries.mockResolvedValue(0);
});

describe("buildAgentContext — role-based memberId dispatch", () => {
  it("role=member: resolves memberId and forwards it to both repo methods", async () => {
    mockFindMemberIdByUserId.mockResolvedValue("member_42");

    await buildAgentContext(ORG, USER, "member");

    expect(mockFindMemberIdByUserId).toHaveBeenCalledTimes(1);
    expect(mockFindMemberIdByUserId).toHaveBeenCalledWith(ORG, USER);

    expect(mockFindFarms).toHaveBeenCalledWith(ORG, "member_42");
    expect(mockFindRecentExpenses).toHaveBeenCalledWith(ORG, 5, "member_42");
  });

  it("role=admin: skips the resolver and passes undefined as memberId", async () => {
    await buildAgentContext(ORG, USER, "admin");

    expect(mockFindMemberIdByUserId).not.toHaveBeenCalled();
    expect(mockFindFarms).toHaveBeenCalledWith(ORG, undefined);
    expect(mockFindRecentExpenses).toHaveBeenCalledWith(ORG, 5, undefined);
  });

  it("role=owner: also skips the resolver (sees all farms in the org)", async () => {
    await buildAgentContext(ORG, USER, "owner");

    expect(mockFindMemberIdByUserId).not.toHaveBeenCalled();
    expect(mockFindFarms).toHaveBeenCalledWith(ORG, undefined);
  });

  it("role=member with no active membership: forwards sentinel that matches nothing", async () => {
    mockFindMemberIdByUserId.mockResolvedValue(null);

    await buildAgentContext(ORG, USER, "member");

    expect(mockFindFarms).toHaveBeenCalledWith(ORG, "__no_member__");
    expect(mockFindRecentExpenses).toHaveBeenCalledWith(
      ORG,
      5,
      "__no_member__",
    );
  });

  it("role=contador: does NOT trigger socio dispatch at all", async () => {
    await buildAgentContext(ORG, USER, "contador");

    expect(mockFindMemberIdByUserId).not.toHaveBeenCalled();
    expect(mockFindFarms).not.toHaveBeenCalled();
    expect(mockFindRecentExpenses).not.toHaveBeenCalled();
    expect(mockCountJournalEntries).toHaveBeenCalledWith(ORG);
  });
});
