# Skill Registry — multi-tenant-document-analysis

Generated: 2026-03-29

## User Skills

| Name | Trigger | Path |
|------|---------|------|
| go-testing | When writing Go tests, using teatest, or adding test coverage | `~/.config/opencode/skills/go-testing/SKILL.md` |
| sdd-apply | When the orchestrator launches you to implement one or more tasks from a change | `~/.config/opencode/skills/sdd-apply/SKILL.md` |
| sdd-archive | When the orchestrator launches you to archive a change after implementation and verification | `~/.config/opencode/skills/sdd-archive/SKILL.md` |
| sdd-design | When the orchestrator launches you to write or update the technical design for a change | `~/.config/opencode/skills/sdd-design/SKILL.md` |
| sdd-explore | When the orchestrator launches you to think through a feature, investigate the codebase, or clarify requirements | `~/.config/opencode/skills/sdd-explore/SKILL.md` |
| sdd-init | When user wants to initialize SDD in a project | `~/.config/opencode/skills/sdd-init/SKILL.md` |
| sdd-propose | When the orchestrator launches you to create or update a proposal for a change | `~/.config/opencode/skills/sdd-propose/SKILL.md` |
| sdd-spec | When the orchestrator launches you to write or update specs for a change | `~/.config/opencode/skills/sdd-spec/SKILL.md` |
| sdd-tasks | When the orchestrator launches you to create or update the task breakdown for a change | `~/.config/opencode/skills/sdd-tasks/SKILL.md` |
| sdd-verify | When the orchestrator launches you to verify a completed (or partially completed) change | `~/.config/opencode/skills/sdd-verify/SKILL.md` |
| skill-creator | When user asks to create a new skill, add agent instructions, or document patterns for AI | `~/.config/opencode/skills/skill-creator/SKILL.md` |
| skill-registry | When user says "update skills", "skill registry", or after installing/removing skills | `~/.config/opencode/skills/skill-registry/SKILL.md` |

## Project Convention Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Agent rules: Next.js 16.x breaking changes — always read `node_modules/next/dist/docs/` before writing any code |
| `CLAUDE.md` | References `@AGENTS.md` |

## Project-Level Skills

None detected.

## Notes

- All SDD skills are at `~/.config/opencode/skills/sdd-*/SKILL.md`
- This project uses **Next.js 16** with breaking API changes — sub-agents MUST read `node_modules/next/dist/docs/` before writing Next.js code
- No Go code in this project — `go-testing` skill not applicable
