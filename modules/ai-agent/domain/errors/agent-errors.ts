/**
 * Narrow re-export of error types and constructors used by the ai-agent domain.
 * Domain layer: no server-only, no Prisma runtime, no SDK deps.
 */
export {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ACCOUNT_NOT_POSTABLE,
  CONTACT_REQUIRED_FOR_ACCOUNT,
  JOURNAL_AI_ACCOUNT_NOT_FOUND,
  JOURNAL_AI_CONTACT_NOT_FOUND,
} from "@/features/shared/errors";
