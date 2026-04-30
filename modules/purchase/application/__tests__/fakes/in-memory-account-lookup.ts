import type {
  AccountLookupPort,
  AccountReference,
} from "@/modules/org-settings/domain/ports/account-lookup.port";

/**
 * In-memory `AccountLookupPort` fake para purchase-hex application tests.
 * Espejo simétrico al fake sale-hex. `findManyByCodes` paridad simétrica
 * para edits POSTED (purchase-hex C5).
 */
export class InMemoryAccountLookup implements AccountLookupPort {
  private readonly byId = new Map<string, AccountReference>();
  private readonly byCode = new Map<string, AccountReference>();
  callsByIds: { organizationId: string; ids: string[] }[] = [];
  callsByCodes: { organizationId: string; codes: string[] }[] = [];

  preload(...accounts: AccountReference[]): void {
    for (const a of accounts) {
      this.byId.set(a.id, a);
      this.byCode.set(a.code, a);
    }
  }

  async findManyByIds(
    organizationId: string,
    ids: string[],
  ): Promise<AccountReference[]> {
    this.callsByIds.push({ organizationId, ids: [...ids] });
    return ids.flatMap((id) => {
      const acc = this.byId.get(id);
      return acc ? [acc] : [];
    });
  }

  async findManyByCodes(
    organizationId: string,
    codes: string[],
  ): Promise<AccountReference[]> {
    this.callsByCodes.push({ organizationId, codes: [...codes] });
    return codes.flatMap((code) => {
      const acc = this.byCode.get(code);
      return acc ? [acc] : [];
    });
  }
}
