import "server-only";

/**
 * Server-only barrel for annual-close. Mirror precedent EXACT
 * `modules/monthly-close/presentation/server.ts` (factory re-export + validation).
 *
 * Per design rev 2 §6: re-exports the zero-arg factory + the Zod validation
 * schema for the POST `/api/.../annual-close` route handler.
 *
 * `import "server-only"` (line 1) prevents bundling into client code per
 * Next.js 16 boundary patterns.
 */
export { makeAnnualCloseService } from "./composition-root";
export { AnnualCloseService } from "../application/annual-close.service";
export * from "./validation";
