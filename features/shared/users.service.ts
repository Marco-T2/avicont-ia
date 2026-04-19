import "server-only";
import { NotFoundError } from "./errors";
import { UsersRepository, type CreateUserInput } from "./users.repository";
import type { User } from "@/generated/prisma/client";

export class UsersService {
  private readonly repo: UsersRepository;

  constructor(repo?: UsersRepository) {
    this.repo = repo ?? new UsersRepository();
  }

  /** Resolve a Clerk user to a DB user. Throws NotFoundError if not found. */
  async resolveByClerkId(clerkUserId: string): Promise<User> {
    const user = await this.repo.findByClerkUserId(clerkUserId);
    if (!user) throw new NotFoundError("Usuario");
    return user;
  }

  /** Find a user by email. Returns null if not found. */
  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  /** Find a user by clerkUserId or email. Creates one if not found. */
  async findOrCreate(data: CreateUserInput): Promise<User> {
    const existing =
      (await this.repo.findByClerkUserId(data.clerkUserId)) ??
      (await this.repo.findByEmail(data.email));

    return existing ?? (await this.repo.create(data));
  }

  /** Create a user from Clerk data. */
  async create(data: CreateUserInput): Promise<User> {
    return this.repo.create(data);
  }

  /** Update a user's mutable fields. */
  async update(id: string, data: { email?: string; name?: string | null }): Promise<User> {
    return this.repo.update(id, data);
  }
}
