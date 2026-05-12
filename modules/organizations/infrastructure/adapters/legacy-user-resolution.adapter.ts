import "server-only";
import { UsersService } from "@/features/users/server";
import type { UserResolutionPort, ResolvedUser } from "../../domain/ports/user-resolution.port";

/**
 * Legacy adapter: wraps features/users UsersService for user identity resolution.
 */
export class LegacyUserResolutionAdapter implements UserResolutionPort {
  private readonly service: UsersService;

  constructor() {
    this.service = new UsersService();
  }

  async findByEmail(email: string): Promise<ResolvedUser | null> {
    const user = await this.service.findByEmail(email);
    if (!user) return null;
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
    };
  }

  async findOrCreate(data: {
    clerkUserId: string;
    email: string;
    name: string;
  }): Promise<ResolvedUser> {
    const user = await this.service.findOrCreate(data);
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
    };
  }

  async create(data: {
    clerkUserId: string;
    email: string;
    name: string;
  }): Promise<ResolvedUser> {
    const user = await this.service.create(data);
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
    };
  }
}
