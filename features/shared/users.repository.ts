import { BaseRepository } from "./base.repository";
import { NotFoundError } from "./errors";
import type { User } from "@/generated/prisma/client";

export class UsersRepository extends BaseRepository {
  async findByClerkUserId(clerkUserId: string): Promise<User> {
    const user = await this.db.user.findUnique({ where: { clerkUserId } });
    if (!user) throw new NotFoundError("Usuario");
    return user;
  }
}
