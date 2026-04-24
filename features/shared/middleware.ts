import { auth } from "@clerk/nextjs/server";
import { UnauthorizedError } from "./errors";

export { handleError } from "./http-error-serializer";

export async function requireAuth() {
  const session = await auth();
  if (!session.userId) throw new UnauthorizedError();
  return session;
}
