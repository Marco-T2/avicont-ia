# 05. Engrams Lessons — Cumulative Cross-POC Matures Cementadas

> **Cementación**: POC docs-refactor — feedback memory extracted cumulative cross-POC matures heredado.
> **Source**: `~/.claude/projects/.../memory/MEMORY.md` (auto-memory feedback entries).

## Lecciones operacionales workflow

| Engram | Aplicación | Matures |
|---|---|---|
| SDD model choice | Upgrade sdd-apply sonnet→opus cuando batch toca invariants, money math, merge points | - |
| RED acceptance failure mode | RED task specs deben declarar expected failure mode; nunca silent accept "FAILS cumple" | - |
| Mock hygiene commit scope | Mock default fixes nombrados en commit message o preceding commit separate, nunca buried wiring diffs | - |
| Retirement re-inventory gate | SDD retirement requires fresh PROJECT-scope grep inventory + classify RESIDUAL/TEST/CONSUMER/DEAD-IMPORT pre-deletion | - |
| Low-cost verification asymmetry | Always run low-cost verify pre-irreversible (archive/canonicalize/merge), incluso expected-negative | - |
| Aspirational mocks signal unimplemented contracts | F-03 + W-01 pattern: mock encodes "how X should behave" → verify real producer honors contract or label aspirational | - |
| Canonical rule application commit body | Tasks citing named SDD Rule require commit body con cite + rationale + cross-ref + optional why-now | Dual: inject sdd-tasks + gate sdd-apply |
| Commit body calibration | Default ~10-15 líneas captura non-obvious + session decisions; verbose solo si lock new conventions | Coexists canonical-rule-application (WHAT vs HOW MUCH) |
| Invariant collision elevation | Escalate (not silently resolve) when proposal collides con enum/schema/`// by design`/named convention | **8va matures cumulative cross-POC** |
| Check-in reports mandatory | Phase boundaries sdd-apply requiren check-in reports mandatorios regardless checklist outcome | Dual: inject sub-agent + orchestrator gate pre-continuation |
| Git workflow preference for SDDs | Este repo: commit + push directly to master, NO feature branch + PR flow | - |
| Sub-phase start coherence gate | POC sub-phase resume runs step 0 (bookmark↔repo coherence) BEFORE preparatory recon + TDD plan | - |
| Sub-phase closure bookmark shape | Closure bookmarks deben include Step 0 checklist file+assumption pairs (NO bare file lists) | Forward-only from C2-D-b |
| JSDoc adapter calibration | JSDoc adapter ≈ 1-2 líneas para wrap-thin/pass-through | Coexists commit-body-calibration |
| JSDoc adapter framing | QUÉ HACE primero (verbo activo: narrow/hydrate), QUÉ NO HACE segundo | "Pass-through con narrow" contradictorio |
| Pre-phase audit gate | Pre-arrancar fase pesada (adapters reales, integration tests, composition root) → audit retroactivo fase recién cerrada | Cost-benefit asimétrico |
| Textual rule verification before lock | Pre-confirm lock citing named rule (§N, R-N) → verify texto literal del doc; sin verify = "tentativo" | **27ma matures cumulative cross-POC** |
| Engram textual rule verification at save | Engram catálogos citing §N/R-N/named rules requieren verify textual contra doc canónico al guardarse, NO solo al aplicarse | C2 recursive aplicación |
| Engram lock redundancy when textual JSDoc exists | NO persistir engram lock observations para decisiones ya documentadas JSDoc/codebase. Grep textual pre-save | Coexists textual_rule_verification |
| JSDoc atomic revoke on signature change | When JSDoc lock contradicts new signature → revoke atomically same edit; never defer post-GREEN refactor | Surface honest if bundled |
| Runtime path coverage RED scope | Cutover RED scope debe include runtime path coverage (status enums + null branches), NO solo __tests__ paths | Lección #12 PROACTIVE > RETROACTIVE |
| Diagnostic stash gate pattern | Suite-full post-GREEN failure overlap modification domain → stash + isolated re-run distinguishes cascade-NEW vs baseline pre-existing | Sibling low-cost verification |
| Enumerated baseline failure ledger | Closure bookmarks MUST lock per-test FAIL/PASS ledger enumerated explicit (NO solo count) | Cumulative invariant arithmetic NO suficiente |
| RED regex discipline | RED test regex must mirror precedent EXACT conventions (^...m anchor + `\?\?` for TYPE optional). Post-GREEN bug fix atomic same commit | - |
| Cross-cycle RED test cementación gate | Step 0 pre-RED future cycles grep current-cycle RED tests against future-cycle target paths/imports/return-shapes; surface overlapping pre-RED | - |
| Response terseness — al grano | Marco prefers terse high-density. Tablas/bullets/numbered options, NO prose. NO repetir locks heredados cada turno | - |
| Git commit hooks habilitados default | `git commit` canonical con pre-commit hooks. NO `--no-verify` default. Bypass legítimo requires Marco lock explícito pre-commit | - |

## Meta-observación

| Engram | Aplicación |
|---|---|
| Rule infrastructure threshold | Plan numbering/search/conflict-resolution rules cuando count hits ~7-10. NOT urgent N≈5 |
| Pre-phase audit gate | Cost-benefit asimétrico pre-fase pesada justifica check retroactivo |

## Cross-reference catálogos

- Per-POC detail closed → [pocs/](pocs/) folder
- §13 canonical homes → [04-sigma-13-canonical-homes.md](04-sigma-13-canonical-homes.md)
- Cleanup pending residual → [06-cleanup-pending.md](06-cleanup-pending.md)
- Hard rules R1-R9 → [03-rules-hard-rules.md](03-rules-hard-rules.md)
