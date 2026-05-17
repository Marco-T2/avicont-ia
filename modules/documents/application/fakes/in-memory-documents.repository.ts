import type {
  CreateDocumentInput,
  DocumentWithRelations,
} from "@/modules/documents/domain/documents.types";
import type { DocumentsRepositoryPort } from "@/modules/documents/application/documents.service";

/**
 * Minimal in-memory implementation of DocumentsRepositoryPort for testing.
 * Not exhaustive — covers the shape needed by upload/list/delete/getById paths.
 */
export class InMemoryDocumentsRepository implements DocumentsRepositoryPort {
  public docs: DocumentWithRelations[] = [];
  public orgs: Array<{ id: string; name: string; clerkOrgId: string }> = [];
  public users: Array<{
    clerkUserId: string;
    id: string;
    memberships: Array<{ role: string; organizationId: string }>;
  }> = [];

  async findAll(organizationId: string): Promise<DocumentWithRelations[]> {
    return this.docs.filter((d) => d.organizationId === organizationId);
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<DocumentWithRelations | null> {
    return (
      this.docs.find((d) => d.id === id && d.organizationId === organizationId) ?? null
    );
  }

  async findByIdWithMembers(id: string, _clerkUserId: string): Promise<unknown> {
    return this.docs.find((d) => d.id === id) ?? null;
  }

  async create(input: CreateDocumentInput): Promise<DocumentWithRelations> {
    const doc = {
      id: `doc_${this.docs.length + 1}`,
      name: input.name,
      content: input.content ?? null,
      fileUrl: input.fileUrl ?? null,
      fileSize: input.fileSize ?? null,
      fileType: input.fileType ?? null,
      scope: input.scope ?? "ORGANIZATION",
      organizationId: input.organizationId,
      userId: input.userId,
      aiSummary: null,
      createdAt: new Date(),
      user: { name: "test-user", email: "u@test" },
      organization: { name: "test-org", clerkOrgId: "clerk_test" },
    } as DocumentWithRelations;
    this.docs.push(doc);
    return doc;
  }

  async delete(id: string, organizationId: string): Promise<void> {
    this.docs = this.docs.filter(
      (d) => !(d.id === id && d.organizationId === organizationId),
    );
  }

  async findOrgByClerkId(clerkOrgId: string) {
    return this.orgs.find((o) => o.clerkOrgId === clerkOrgId) ?? null;
  }

  async findUserWithMembership(clerkUserId: string, organizationId: string) {
    const user = this.users.find((u) => u.clerkUserId === clerkUserId);
    if (!user) return null;
    return {
      id: user.id,
      memberships: user.memberships.filter((m) => m.organizationId === organizationId),
    };
  }

  async findForAnalysis(documentId: string, _clerkUserId: string): Promise<unknown> {
    return this.docs.find((d) => d.id === documentId) ?? null;
  }

  async updateAnalysis(
    _organizationId: string,
    documentId: string,
    data: { aiSummary: string },
  ): Promise<unknown> {
    const doc = this.docs.find((d) => d.id === documentId);
    if (doc) Object.assign(doc, data);
    return doc;
  }
}
