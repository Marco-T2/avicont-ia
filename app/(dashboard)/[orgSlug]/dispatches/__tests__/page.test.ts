/**
 * /dispatches page — RETIREMENT shim tests.
 *
 * Post poc-dispatch-retirement-into-sales C3 GREEN: /dispatches is a 308
 * permanentRedirect to /${orgSlug}/sales. NO data fetch. NO RBAC gate (the
 * redirect target handles auth). Detail + create routes preserved.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPermanentRedirect } = vi.hoisted(() => ({
  mockPermanentRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  permanentRedirect: mockPermanentRedirect,
}));

import DispatchesPage from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/dispatches — RETIREMENT redirect shim", () => {
  it("calls permanentRedirect with /${orgSlug}/sales (308)", async () => {
    await DispatchesPage({ params: makeParams() });

    expect(mockPermanentRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}/sales`);
    expect(mockPermanentRedirect).toHaveBeenCalledTimes(1);
  });
});
