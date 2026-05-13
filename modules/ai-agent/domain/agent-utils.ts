import type { Role } from "@/modules/permissions/domain/permissions";

export type InvocationOutcome =
  | "ok"
  | "error"
  | "validation_failed"
  | "no_tools_for_role"
  | "no_tool_call"
  | "unexpected_tool"
  | "parse_failed";

export function normalizeRole(role: string): Role {
  const lower = role.toLowerCase();
  if (lower === "owner") return "owner";
  if (lower === "admin") return "admin";
  if (lower === "contador" || lower === "accountant") return "contador";
  return "member";
}
