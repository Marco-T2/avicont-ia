import { z } from "zod";

/**
 * Validates raw URLSearchParams (string-valued) into the PaginationOptions
 * shape. Coerces page/pageSize from strings, applies defaults (page 1,
 * pageSize 25) and bounds (pageSize ≤ 100). HTTP boundary translation —
 * §13 NEW shared/presentation/ carve-out 1ra evidencia matures.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
