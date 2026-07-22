import "server-only";
import { UsersService } from "../application/users.service";
import { UsersRepository } from "../infrastructure/users.repository";

// composition-root.ts is the ONE legitimate exception to R4 (presentation/
// MUST NOT import infrastructure/): it wires the concrete Prisma-backed
// repository into the application service.
export function makeUsersService(): UsersService {
  return new UsersService(new UsersRepository());
}
