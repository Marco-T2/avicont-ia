/**
 * Shape sentinel: poc-quick-cleanup — pricing relocation
 * 18α (9 POSITIVE-presence + 9 NEGATIVE-absence)
 * RED: all 18 FAIL (new home empty; old home still populated)
 * GREEN: all 18 PASS (new home populated; old home deleted)
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// α01–α03: POSITIVE — new home file existence
// ---------------------------------------------------------------------------

describe("POSITIVE-presence: new home files exist", () => {
  it("α01: features/ai-agent/pricing/pricing.service.ts exists", () => {
    expect(existsSync(join(ROOT, "features/ai-agent/pricing/pricing.service.ts"))).toBe(true);
  });

  it("α02: features/ai-agent/pricing/pricing.types.ts exists", () => {
    expect(existsSync(join(ROOT, "features/ai-agent/pricing/pricing.types.ts"))).toBe(true);
  });

  it("α03: features/ai-agent/pricing/server.ts exists", () => {
    expect(existsSync(join(ROOT, "features/ai-agent/pricing/server.ts"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// α04–α06: NEGATIVE-absence — old home file absence
// ---------------------------------------------------------------------------

describe("NEGATIVE-absence: old home files absent", () => {
  it("α04: features/pricing/pricing.service.ts absent", () => {
    expect(existsSync(join(ROOT, "features/pricing/pricing.service.ts"))).toBe(false);
  });

  it("α05: features/pricing/pricing.types.ts absent", () => {
    expect(existsSync(join(ROOT, "features/pricing/pricing.types.ts"))).toBe(false);
  });

  it("α06: features/pricing/server.ts absent", () => {
    expect(existsSync(join(ROOT, "features/pricing/server.ts"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α07–α08: agent.service.ts consumer import
// ---------------------------------------------------------------------------

describe("agent.service.ts consumer import", () => {
  it("α07: POSITIVE — agent.service.ts imports from @/features/ai-agent/pricing/server", () => {
    const src = read("features/ai-agent/agent.service.ts");
    expect(/^import.*@\/features\/ai-agent\/pricing\/server/m.test(src)).toBe(true);
  });

  it("α08: NEGATIVE — agent.service.ts does NOT import from @/features/pricing/server", () => {
    const src = read("features/ai-agent/agent.service.ts");
    expect(/^import.*@\/features\/pricing\/server/m.test(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α09–α10: modes/chat.ts type-import
// ---------------------------------------------------------------------------

describe("modes/chat.ts type-import", () => {
  it("α09: POSITIVE — modes/chat.ts imports from @/features/ai-agent/pricing/server", () => {
    const src = read("features/ai-agent/modes/chat.ts");
    expect(/^import.*@\/features\/ai-agent\/pricing\/server/m.test(src)).toBe(true);
  });

  it("α10: NEGATIVE — modes/chat.ts does NOT import from @/features/pricing/server", () => {
    const src = read("features/ai-agent/modes/chat.ts");
    expect(/^import.*@\/features\/pricing\/server/m.test(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// α11–α12: agent.service.error-propagation.test.ts vi.mock
// ---------------------------------------------------------------------------

describe("agent.service.error-propagation.test.ts vi.mock path", () => {
  it("α11: NEGATIVE — vi.mock NOT on old path @/features/pricing/server", () => {
    const src = read("features/ai-agent/__tests__/agent.service.error-propagation.test.ts");
    expect(/vi\.mock\("@\/features\/pricing\/server"/m.test(src)).toBe(false);
  });

  it("α12: POSITIVE — vi.mock on new path @/features/ai-agent/pricing/server", () => {
    const src = read("features/ai-agent/__tests__/agent.service.error-propagation.test.ts");
    expect(/vi\.mock\("@\/features\/ai-agent\/pricing\/server"/m.test(src)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// α13–α14: agent.service.analyze-balance.test.ts vi.mock
// ---------------------------------------------------------------------------

describe("agent.service.analyze-balance.test.ts vi.mock path", () => {
  it("α13: NEGATIVE — vi.mock NOT on old path @/features/pricing/server", () => {
    const src = read("features/ai-agent/__tests__/agent.service.analyze-balance.test.ts");
    expect(/vi\.mock\("@\/features\/pricing\/server"/m.test(src)).toBe(false);
  });

  it("α14: POSITIVE — vi.mock on new path @/features/ai-agent/pricing/server", () => {
    const src = read("features/ai-agent/__tests__/agent.service.analyze-balance.test.ts");
    expect(/vi\.mock\("@\/features\/ai-agent\/pricing\/server"/m.test(src)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// α15–α16: agent.service.analyze-income.test.ts vi.mock
// ---------------------------------------------------------------------------

describe("agent.service.analyze-income.test.ts vi.mock path", () => {
  it("α15: NEGATIVE — vi.mock NOT on old path @/features/pricing/server", () => {
    const src = read("features/ai-agent/__tests__/agent.service.analyze-income.test.ts");
    expect(/vi\.mock\("@\/features\/pricing\/server"/m.test(src)).toBe(false);
  });

  it("α16: POSITIVE — vi.mock on new path @/features/ai-agent/pricing/server", () => {
    const src = read("features/ai-agent/__tests__/agent.service.analyze-income.test.ts");
    expect(/vi\.mock\("@\/features\/ai-agent\/pricing\/server"/m.test(src)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// α17–α18: hotfix.poc-2-ai-tools-writing-granjas.test.ts vi.mock
// ---------------------------------------------------------------------------

describe("hotfix.poc-2-ai-tools-writing-granjas.test.ts vi.mock path", () => {
  it("α17: NEGATIVE — vi.mock NOT on old path @/features/pricing/server", () => {
    const src = read("features/ai-agent/__tests__/hotfix.poc-2-ai-tools-writing-granjas.test.ts");
    expect(/vi\.mock\("@\/features\/pricing\/server"/m.test(src)).toBe(false);
  });

  it("α18: POSITIVE — vi.mock on new path @/features/ai-agent/pricing/server", () => {
    const src = read("features/ai-agent/__tests__/hotfix.poc-2-ai-tools-writing-granjas.test.ts");
    expect(/vi\.mock\("@\/features\/ai-agent\/pricing\/server"/m.test(src)).toBe(true);
  });
});
