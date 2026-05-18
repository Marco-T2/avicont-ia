import { describe, it, expect } from "vitest";

/**
 * C2 RED — Infrastructure layer shape tests for POC dispatch-hex migration.
 * Validates mapper, Prisma repository, and legacy adapters exist and export.
 */

import {
  PrismaDispatchRepository,
} from "../infrastructure/prisma-dispatch.repository";

import {
  LegacyJournalEntryFactoryAdapter,
} from "../infrastructure/legacy-journal-entry-factory.adapter";

import {
  LegacyAccountBalancesAdapter,
} from "../infrastructure/legacy-account-balances.adapter";

import {
  LegacyOrgSettingsReaderAdapter,
} from "../infrastructure/legacy-org-settings-reader.adapter";

import {
  LegacyContactsAdapter,
} from "../infrastructure/legacy-contacts.adapter";

import {
  LegacyFiscalPeriodsAdapter,
} from "../infrastructure/legacy-fiscal-periods.adapter";

import {
  LegacyReceivablesAdapter,
} from "../infrastructure/legacy-receivables.adapter";

// getDisplayCode import retired (REQ-DISPLAY-2 derivative T4.4a): infra
// helper file deleted wholesale per [[retirement_reinventory_gate]]
// SHAPE-LOCK classification.

describe("POC dispatch-hex C2 — infrastructure layer shape", () => {
  it("PrismaDispatchRepository class exists", () => {
    expect(PrismaDispatchRepository).toBeDefined();
    expect(typeof PrismaDispatchRepository).toBe("function");
  });

  it("LegacyJournalEntryFactoryAdapter class exists", () => {
    expect(LegacyJournalEntryFactoryAdapter).toBeDefined();
    expect(typeof LegacyJournalEntryFactoryAdapter).toBe("function");
  });

  it("LegacyAccountBalancesAdapter class exists", () => {
    expect(LegacyAccountBalancesAdapter).toBeDefined();
    expect(typeof LegacyAccountBalancesAdapter).toBe("function");
  });

  it("LegacyOrgSettingsReaderAdapter class exists", () => {
    expect(LegacyOrgSettingsReaderAdapter).toBeDefined();
    expect(typeof LegacyOrgSettingsReaderAdapter).toBe("function");
  });

  it("LegacyContactsAdapter class exists", () => {
    expect(LegacyContactsAdapter).toBeDefined();
    expect(typeof LegacyContactsAdapter).toBe("function");
  });

  it("LegacyFiscalPeriodsAdapter class exists", () => {
    expect(LegacyFiscalPeriodsAdapter).toBeDefined();
    expect(typeof LegacyFiscalPeriodsAdapter).toBe("function");
  });

  it("LegacyReceivablesAdapter class exists", () => {
    expect(LegacyReceivablesAdapter).toBeDefined();
    expect(typeof LegacyReceivablesAdapter).toBe("function");
  });

  // getDisplayCode SHAPE-LOCK assertion retired (REQ-DISPLAY-2 derivative
  // T4.4a): infra helper file `dispatch-display-code.ts` deleted wholesale.
  // Other 7 SHAPE-LOCK assertions above remain VALID (legacy adapters +
  // Prisma repo).
});
