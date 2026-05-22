import { auth, verifyToken } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { UnauthorizedError } from "@/modules/shared/domain/errors";

export { handleError } from "./http-error-serializer";

/**
 * Identidad resuelta de una request. Normalizada para servir tanto al flujo web
 * (sesión por cookie de Clerk) como a clientes externos (app móvil) que mandan
 * el session token por `Authorization: Bearer`. Solo expone lo que consumen los
 * llamadores: `userId` y `orgId` (la org activa, si la hay).
 */
export interface AuthContext {
  userId: string;
  /** Org activa de la sesión. `null` para Bearer sin org (caso F2: org por slug). */
  orgId: string | null;
  /** `true` si la identidad vino por header Bearer (cliente externo, p.ej. el celu). */
  viaBearer: boolean;
}

export async function requireAuth(): Promise<AuthContext> {
  // Camino web: sesión por cookie. clerkMiddleware ya la cargó.
  const session = await auth();
  if (session.userId) {
    return { userId: session.userId, orgId: session.orgId ?? null, viaBearer: false };
  }

  // Fallback para clientes externos (app móvil Expo): el session token de Clerk
  // viaja en `Authorization: Bearer <jwt>`. Se verifica con la MISMA instancia
  // (CLERK_SECRET_KEY) que ya usa la web — mismo issuer, mismo JWKS.
  const authorization = (await headers()).get("authorization");
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new UnauthorizedError();

  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return {
      userId: claims.sub,
      orgId: claims.org_id ?? null,
      viaBearer: true,
    };
  } catch {
    // Token ausente del set válido, expirado o firma inválida → 401.
    throw new UnauthorizedError();
  }
}
