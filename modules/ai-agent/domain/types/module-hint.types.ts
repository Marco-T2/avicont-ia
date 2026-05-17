/**
 * MODULE_HINTS — contextual hints that nudge the chat-mode agent toward tools
 * relevant to the user's current dashboard module. Does NOT narrow the available
 * tool set (that is `Surface`'s job — see modules/ai-agent/domain/tools/surfaces).
 *
 * Wire shape: optional, nullable. Absent or null = no hint (status-quo behavior).
 */
export const MODULE_HINTS = ["accounting", "farm"] as const;
export type ModuleHint = (typeof MODULE_HINTS)[number];

/**
 * Explicit-null alias used in service signatures and telemetry payloads.
 * `null` is a domain value meaning "no current module" (e.g. sidebar on a
 * non-mapped route like /settings); distinct from `undefined` (legacy callers).
 */
export type ModuleHintValue = ModuleHint | null;
