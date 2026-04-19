import "server-only";
import { BaseRepository } from "./base.repository";
import type { User } from "@/generated/prisma/client";

export interface CreateUserInput {
  clerkUserId: string;
  email: string;
  name?: string | null;
}

export class UsersRepository extends BaseRepository {
  async findByClerkUserId(clerkUserId: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { clerkUserId } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findFirst({ where: { email } });
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.db.user.create({
      data: {
        clerkUserId: data.clerkUserId,
        email: data.email,
        name: data.name ?? null,
      },
    });
  }

  async update(
    id: string,
    data: { email?: string; name?: string | null },
  ): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }
}
