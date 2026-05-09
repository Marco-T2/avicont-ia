/**
 * Pagination contract types — DTO-style shape, NO behavioral methods.
 *
 * Diverges intentionally from Money/MonetaryAmount (class privada + static
 * factory + non-generic): pagination params and paginated payloads are
 * transport contracts for paginated reads, not behavioral invariants. Shape
 * over behavior.
 *
 * Constraints (enforced by the zod schema in `presentation/pagination.schema.ts`,
 * not by the types):
 *   - page is 1-indexed (page 1 = first page)
 *   - pageSize default 25, max 100
 *   - sortBy / sortOrder optional (server-side sort opt-in per route)
 */

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
