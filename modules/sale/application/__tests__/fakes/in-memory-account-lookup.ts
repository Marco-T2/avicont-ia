import type {
  AccountLookupPort,
  AccountReference,
} from "@/modules/org-settings/domain/ports/account-lookup.port";

export class InMemoryAccountLookup implements AccountLookupPort {
  private readonly store = new Map<string, AccountReference>();
  calls: { organizationId: string; ids: string[] }[] = [];

  preload(...accounts: AccountReference[]): void {
    for (const a of accounts) this.store.set(a.id, a);
  }

  async findManyByIds(
    organizationId: string,
    ids: string[],
  ): Promise<AccountReference[]> {
    this.calls.push({ organizationId, ids: [...ids] });
    return ids.flatMap((id) => {
      const acc = this.store.get(id);
      return acc ? [acc] : [];
    });
  }

  async findManyByCodes(
    _organizationId: string,
    codes: string[],
  ): Promise<AccountReference[]> {
    return codes.flatMap((code) => {
      const acc = [...this.store.values()].find((a) => a.code === code);
      return acc ? [acc] : [];
    });
  }
}
