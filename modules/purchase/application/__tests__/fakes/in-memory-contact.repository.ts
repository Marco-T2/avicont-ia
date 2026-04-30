import type { Contact } from "@/modules/contacts/domain/contact.entity";
import type { ContactRepository } from "@/modules/contacts/domain/contact.repository";

/**
 * In-memory `ContactRepository` fake para purchase-hex application tests.
 * Espejo simétrico a sale-hex `InMemoryContactRepository`. Sólo `findById`
 * implementado — purchase-hex use cases nunca llaman `findAll` / `findByNit`
 * / `save` / `update` (esos pertenecen a contacts module's own service tests).
 * Stubs throw para surface accidental cross-module use.
 */
export class InMemoryContactRepository implements ContactRepository {
  private readonly store = new Map<string, Contact>();

  reset(): void {
    this.store.clear();
  }

  preload(...contacts: Contact[]): void {
    for (const c of contacts) this.store.set(c.id, c);
  }

  async findById(organizationId: string, id: string): Promise<Contact | null> {
    const c = this.store.get(id);
    return c && c.organizationId === organizationId ? c : null;
  }

  async findAll(): Promise<Contact[]> {
    throw new Error(
      "InMemoryContactRepository.findAll not implemented (purchase-hex does not consume)",
    );
  }

  async findByNit(): Promise<Contact | null> {
    throw new Error("InMemoryContactRepository.findByNit not implemented");
  }

  async save(): Promise<void> {
    throw new Error("InMemoryContactRepository.save not implemented");
  }

  async update(): Promise<void> {
    throw new Error("InMemoryContactRepository.update not implemented");
  }
}
