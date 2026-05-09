import type { PaginationOptions } from "../domain/value-objects/pagination";
import { paginationQuerySchema } from "./pagination.schema";

/**
 * Narrows raw URLSearchParams into a validated PaginationOptions VO via
 * paginationQuerySchema (defaults applied, bounds enforced). Throws ZodError
 * on out-of-bound page/pageSize or non-numeric coercion failure.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
): PaginationOptions {
  return paginationQuerySchema.parse(Object.fromEntries(searchParams));
}
