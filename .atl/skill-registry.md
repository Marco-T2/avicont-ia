# Skill Registry — avicont-ia

Generated: 2026-04-02

## User Skills

| Name | Trigger | Path |
|------|---------|------|
| go-testing | When writing Go tests, using teatest, or adding test coverage | `~/.claude/skills/go-testing/SKILL.md` |
| sdd-apply | When the orchestrator launches you to implement tasks from a change | `~/.claude/skills/sdd-apply/SKILL.md` |
| sdd-archive | When the orchestrator launches you to archive a change | `~/.claude/skills/sdd-archive/SKILL.md` |
| sdd-design | When the orchestrator launches you to write technical design | `~/.claude/skills/sdd-design/SKILL.md` |
| sdd-explore | When the orchestrator launches you to investigate the codebase | `~/.claude/skills/sdd-explore/SKILL.md` |
| sdd-init | When user wants to initialize SDD in a project | `~/.claude/skills/sdd-init/SKILL.md` |
| sdd-propose | When the orchestrator launches you to create a proposal | `~/.claude/skills/sdd-propose/SKILL.md` |
| sdd-spec | When the orchestrator launches you to write specs | `~/.claude/skills/sdd-spec/SKILL.md` |
| sdd-tasks | When the orchestrator launches you to create task breakdown | `~/.claude/skills/sdd-tasks/SKILL.md` |
| sdd-verify | When the orchestrator launches you to verify implementation | `~/.claude/skills/sdd-verify/SKILL.md` |
| skill-creator | When user asks to create a new skill | `~/.claude/skills/skill-creator/SKILL.md` |

## Project Convention Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Next.js 16.x breaking changes — always read `node_modules/next/dist/docs/` before writing any code |
| `CLAUDE.md` | References `@AGENTS.md` |

## Project-Level Skills

None detected.

## Notes

- All SDD skills are at `~/.claude/skills/sdd-*/SKILL.md`
- This project uses **Next.js 16** with breaking API changes — sub-agents MUST read `node_modules/next/dist/docs/` before writing Next.js code
- No Go code in this project — `go-testing` skill not applicable
