import { describe, it, expect, vi } from "vitest";
import { ContactsService } from "../contacts.service";
import type { ContactRepository } from "../../domain/contact.repository";
import { Contact } from "../../domain/contact.entity";
import {
  ContactInactiveOrMissing,
  ContactNitDuplicate,
  ContactNotFound,
} from "../../domain/errors/contact-errors";

const ORG = "org-1";

const fakeRepo = (
  overrides: Partial<ContactRepository> = {},
): ContactRepository => ({
  findAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
  findByNit: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const baseContact = (overrides: Partial<Parameters<typeof Contact.create>[0]> = {}) =>
  Contact.create({
    organizationId: ORG,
    type: "CLIENTE",
    name: "Acme",
    ...overrides,
  });

describe("ContactsService.list", () => {
  it("delegates to repo.findAll with filters", async () => {
    const repo = fakeRepo();
    await new ContactsService(repo).list(ORG, { type: "CLIENTE" });
    expect(repo.findAll).toHaveBeenCalledWith(ORG, { type: "CLIENTE" });
  });

  it("delegates to repo.findAll without filters", async () => {
    const repo = fakeRepo();
    await new ContactsService(repo).list(ORG);
    expect(repo.findAll).toHaveBeenCalledWith(ORG, undefined);
  });
});

describe("ContactsService.getById", () => {
  it("returns the entity when found", async () => {
    const c = baseContact();
    const service = new ContactsService(
      fakeRepo({ findById: vi.fn().mockResolvedValue(c) }),
    );
    expect(await service.getById(ORG, c.id)).toBe(c);
  });

  it("throws ContactNotFound when missing", async () => {
    const service = new ContactsService(fakeRepo());
    await expect(service.getById(ORG, "nope")).rejects.toThrow(ContactNotFound);
  });
});

describe("ContactsService.getActiveById", () => {
  it("returns the entity when active and found", async () => {
    const c = baseContact();
    const service = new ContactsService(
      fakeRepo({ findById: vi.fn().mockResolvedValue(c) }),
    );
    expect(await service.getActiveById(ORG, c.id)).toBe(c);
  });

  it("throws ContactInactiveOrMissing when missing", async () => {
    const service = new ContactsService(fakeRepo());
    await expect(service.getActiveById(ORG, "nope")).rejects.toThrow(
      ContactInactiveOrMissing,
    );
  });

  it("throws ContactInactiveOrMissing when inactive", async () => {
    const inactive = baseContact().deactivate();
    const service = new ContactsService(
      fakeRepo({ findById: vi.fn().mockResolvedValue(inactive) }),
    );
    await expect(service.getActiveById(ORG, inactive.id)).rejects.toThrow(
      ContactInactiveOrMissing,
    );
  });
});

describe("ContactsService.create", () => {
  it("persists a contact without NIT", async () => {
    const repo = fakeRepo();
    const service = new ContactsService(repo);
    const c = await service.create(ORG, { type: "CLIENTE", name: "Acme" });
    expect(c.organizationId).toBe(ORG);
    expect(c.name).toBe("Acme");
    expect(repo.findByNit).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(c);
  });

  it("checks NIT uniqueness when NIT is provided", async () => {
    const repo = fakeRepo();
    await new ContactsService(repo).create(ORG, {
      type: "CLIENTE",
      name: "X",
      nit: "12345",
    });
    expect(repo.findByNit).toHaveBeenCalledWith(ORG, "12345");
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it("rejects duplicate NIT in same org with ContactNitDuplicate", async () => {
    const existing = baseContact({ nit: "12345" });
    const repo = fakeRepo({ findByNit: vi.fn().mockResolvedValue(existing) });
    const service = new ContactsService(repo);
    await expect(
      service.create(ORG, { type: "CLIENTE", name: "X", nit: "12345" }),
    ).rejects.toThrow(ContactNitDuplicate);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("allows same NIT in a different org (per-org uniqueness)", async () => {
    const repo = fakeRepo();
    const c = await new ContactsService(repo).create("org-B", {
      type: "CLIENTE",
      name: "X",
      nit: "12345",
    });
    expect(c.organizationId).toBe("org-B");
    expect(repo.findByNit).toHaveBeenCalledWith("org-B", "12345");
    expect(repo.save).toHaveBeenCalledWith(c);
  });
});

describe("ContactsService.update", () => {
  it("throws ContactNotFound when entity missing", async () => {
    const service = new ContactsService(fakeRepo());
    await expect(service.update(ORG, "nope", { name: "X" })).rejects.toThrow(
      ContactNotFound,
    );
  });

  it("renames and persists", async () => {
    const c = baseContact();
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(c) });
    const result = await new ContactsService(repo).update(ORG, c.id, {
      name: "Renamed",
    });
    expect(result.name).toBe("Renamed");
    expect(repo.update).toHaveBeenCalledWith(result);
  });

  it("rejects NIT change colliding with another contact", async () => {
    const c = baseContact({ nit: "100" });
    const other = baseContact({ nit: "200" });
    const repo = fakeRepo({
      findById: vi.fn().mockResolvedValue(c),
      findByNit: vi.fn().mockResolvedValue(other),
    });
    const service = new ContactsService(repo);
    await expect(service.update(ORG, c.id, { nit: "200" })).rejects.toThrow(
      ContactNitDuplicate,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("allows updating the same contact's own NIT (idempotent)", async () => {
    const c = baseContact({ nit: "100" });
    const repo = fakeRepo({
      findById: vi.fn().mockResolvedValue(c),
      findByNit: vi.fn().mockResolvedValue(c),
    });
    const result = await new ContactsService(repo).update(ORG, c.id, {
      nit: "100",
    });
    expect(result.nit).toBe("100");
    expect(repo.update).toHaveBeenCalledWith(result);
  });

  it("does not call findByNit when NIT is unchanged", async () => {
    const c = baseContact({ nit: "100" });
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(c) });
    await new ContactsService(repo).update(ORG, c.id, { name: "Other" });
    expect(repo.findByNit).not.toHaveBeenCalled();
  });

  it("clears the NIT when null is passed", async () => {
    const c = baseContact({ nit: "100" });
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(c) });
    const result = await new ContactsService(repo).update(ORG, c.id, {
      nit: null,
    });
    expect(result.nit).toBeNull();
  });
});

describe("ContactsService.deactivate", () => {
  it("throws ContactNotFound when entity missing", async () => {
    const service = new ContactsService(fakeRepo());
    await expect(service.deactivate(ORG, "nope")).rejects.toThrow(ContactNotFound);
  });

  it("flips isActive and persists", async () => {
    const c = baseContact();
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(c) });
    const result = await new ContactsService(repo).deactivate(ORG, c.id);
    expect(result.isActive).toBe(false);
    expect(repo.update).toHaveBeenCalledWith(result);
  });
});
