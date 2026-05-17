/**
 * Chat-mode loop constants (REQ-23).
 *
 * `MAX_CHAT_TURNS` bounds the multi-turn LLM loop in `executeChatMode`.
 * The default 5 = up to 4 tool rounds + 1 final text turn. Past empirical
 * tuning may raise the default, but the absolute ceiling is `HARD_CAP`.
 *
 * The module-load assertion (`MAX_CHAT_TURNS <= HARD_CAP`) makes it
 * impossible to ship a build where the cap is exceeded — fail-fast at
 * import time so the loop never spins on an unsafe configuration.
 *
 * `MAX_TURN_FALLBACK_MESSAGE` is the Spanish string returned to the user
 * when the cap fires. EXACT text locked per [[textual_rule_verification]] —
 * any change requires a new SDD with a RED test mirroring the new string.
 */

export const HARD_CAP = 10 as const;

export const MAX_CHAT_TURNS = 5;

if (MAX_CHAT_TURNS > HARD_CAP) {
  throw new Error(
    `MAX_CHAT_TURNS (${MAX_CHAT_TURNS}) exceeds HARD_CAP (${HARD_CAP}). ` +
      "Lower the constant or raise the cap with explicit SDD justification.",
  );
}

export const MAX_TURN_FALLBACK_MESSAGE =
  "No pude completar la consulta. Intentá ser más específico.";
