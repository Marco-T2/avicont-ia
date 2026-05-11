## 15. Lo que NO está en este documento (todavía)

- Estrategia de testing detallada por capa
- Composition root completo (DI)
- ~~Cómo manejar transacciones que cruzan módulos~~ — cerrado en §17.
- ~~Migración de la audit-context a port~~ — cerrado en POC #9 (§4.3).

Esos quedan abiertos para iterar **después** del POC en `mortality`. Si los definimos ahora, los definimos mal — la POC nos va a mostrar qué falta de verdad.

---

## 21. Bugs latentes documentados defer POC futuro

Bugs estructurales detectados durante POC nuevo A3 doc-only post-mortem cumulative que NO bloquean POC entrega y se difieren a POC futuro dedicado. Documentation aquí preserva auditabilidad cross-feature paired pre-fix — auditable cualquier sub-fase futura via grep `§21.N`.

### 21.1. D5 PATCH/POST mismatch sale + purchase paired (defer POC futuro paridad fix)

Routes `/status` y client mutation handlers desacoplados — bug latente paired ambos features sale + purchase:

| Endpoint / Caller | Path | Línea | Método HTTP |
|---|---|---|---|
| Route handler sale | `app/api/organizations/[orgSlug]/sales/[saleId]/status/route.ts` | 10 | `POST` |
| Route handler purchase | `app/api/organizations/[orgSlug]/purchases/[purchaseId]/status/route.ts` | 15 | `POST` |
| Client caller sale `handlePost` | `components/sales/sale-form.tsx` | 344 | `PATCH` |
| Client caller sale `handleVoid` | `components/sales/sale-form.tsx` | 454 | `PATCH` |
| Client caller purchase `handlePost` | `components/purchases/purchase-form.tsx` | 564 | `PATCH` |
| Client caller purchase `handleVoid` | `components/purchases/purchase-form.tsx` | 590 | `PATCH` |

**Ground truth REST**: status transition (POSTED/VOIDED) es state mutation parcial — `PATCH` es semánticamente correcto cliente-side. Routes deben migrar a `export async function PATCH` (o aceptar ambos métodos si retro-compat necesaria).

**Cobertura runtime ZERO**: directorios `[saleId]/status/` y `[purchaseId]/status/` NO contienen `__tests__/` sibling — bug latente sin runtime test que detecte.

**Cross-ref**: §20.5 (mention parcial originada A3-D1) + engram `poc-futuro/d5-patch-post-mismatch-paridad-fix` (POC futuro candidate fix paridad ambos features sale + purchase paired — out-of-scope POC nuevo A3 entrega).

### 21.2. Payment routes WithCorrelation envelope passthrough (defer POC futuro paridad fix payment routes raw entity preservation)

Routes payment retornan WithCorrelation envelope from Adapter via `Response.json(payment)` directly — pattern indirect leak emergent §20.8 sub-finding NEW surface D1 PROACTIVE verify retroactivo pre-cementación. **PRE-EXISTING behavior NOT introduced por POC payment cycles** — Adapter C4-α preserves legacy shim contract WithCorrelation EXACT (legacy `features/payment/payment.service.ts` también retornaba WithCorrelation envelopes preserved cumulative); POC payment C1 GREEN solo SWAP IMPORT path, NO Response.json behavior changed cycles:

| Endpoint / Service method | Path | Línea | Service return shape |
|---|---|---|---|
| Route handler POST `paymentService.create` / `createAndPost` | `app/api/organizations/[orgSlug]/payments/route.ts` | 61 | `WithCorrelation<PaymentWithRelations>` |
| Route handler PATCH `paymentService.update` | `app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts` | 43 | `WithCorrelation<PaymentWithRelations>` |
| Route handler PATCH `paymentService.post` / `void` | `app/api/organizations/[orgSlug]/payments/[paymentId]/status/route.ts` | 40 | `WithCorrelation<PaymentWithRelations>` |
| Route handler PUT `paymentService.updateAllocations` | `app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts` | 37 | `WithCorrelation<PaymentWithRelations>` |

**Ground truth**: WithCorrelation envelope `{ ...row, correlationId }` es internal audit telemetry shape (`correlationId` es identificador correlation tracking entre transacción + audit log per §20). Body `Response.json(payment)` shape leakea `correlationId` indirect via envelope passthrough — strict spirit §20 (correlationId es telemetría interna del backend, NO parte del contrato API público) incluye envelope passthrough mismo concern semantic. Resolution: routes deben destructure `const { correlationId, ...rest } = await paymentService.X(...)` + `Response.json(rest)` — mirror precedent A3 sale + paired payable EXACT raw entity preservation.

**§20.1 EXACT regex pattern NO match**: literal spread `Response.json({ ...x, correlationId })` regex detection scope detecta direct leak en route handler line, NO indirect passthrough. POC payment cycles preserved legacy contract — §20.1 regex grep returned 0 hits cumple verify retroactivo §20.8.

**Cobertura runtime**: payment routes integration tests cumulative POC payment cycles existen (commits cumulative C1+C2+C3+C4-α+C4-β shape tests — body shape regression covered runtime + REQ-FMB.5 0 violations preserved console/logger leaks separate concern).

**Cross-ref**: §20.8 (sub-finding NEW emergente surface D1 verify retroactivo + lección REFINED `feedback/§20-strict-spirit-vs-regex-literal` NEW canonical home) + engram `poc-futuro/payment-routes-correlationid-unwrap-paridad-fix` (POC futuro candidate fix paridad payment routes raw entity preservation simétrico al precedent A3 sale + paired payable EXACT — out-of-scope POC nuevo payment D1 doc-only entrega + NO RED+GREEN cycle mid-D1).

### 21.3. Farm + Lot find-all legacy vs hex factory dual-method cleanup pending (defer POC futuro)

POC paired farms+lots C4 routes API cutover Marco lock D1 Opt C ADDITIVE NEW método paralelo strategy preserved legacy `findAll` + hex factory `makeFarmService()`/`makeLotService()` dual-method transitional period — paired sister precedent EXACT mirror dual-method ADDITIVE pattern heredado pagination-sale pilot canonical. Cleanup pending POC futuro trigger condition cumulative cross-POC paired sister `feedback/sale-find-all-legacy-vs-find-paginated-dual-method-cleanup-pending` 4to cumulative paired sister 3 heredados — drop legacy `findAll` method post wholesale delete features/{farms,lots}/* cumulative cross-feature consumer migration completed cross-POC verified.

**Cross-ref**: engram `feedback/farm-lot-find-all-legacy-vs-hex-factory-dual-method-cleanup-pending` 12mo cumulative cross-POC paired sister 11 heredados — POC futuro candidate fix paridad farm + lot routes dual-method drop legacy `findAll` cumulative cross-feature consumer migration completed.

### 21.4. Farm + Lot routes auth pattern legacy preserve vs canonical requirePermission cleanup pending (defer POC futuro)

POC paired farms+lots C4 routes API cutover paired hex factory `makeFarmService`/`makeLotService` Marco lock D2 Opt B preserve legacy auth pattern (RBAC-EXCEPTION cross-module auth-only NO resource frozen Resource union — Decision rbac-legacy-auth-chain-migration 2026-04-19 preserved) vs canonical `requirePermission(...)` pattern paired sister sale+purchase EXACT mirror — asimétrico pattern preserva legacy paired sister hotfix-correctivo-contacts §19.12 ADDENDUM precedent EXACT mirror cumulative cross-POC. Cleanup pending POC futuro trigger condition: expand frozen Resource union add `farms` + `lots` resources cumulative cross-POC RBAC system migration completed.

**Cross-ref**: §13 NEW canonical home `arch/§13/asymmetric-auth-pattern-legacy-preserve-vs-canonical-require-permission` 1ra evidencia POC paired farms+lots C4 + engram `feedback/farm-lot-routes-auth-pattern-legacy-vs-canonical-require-permission-cleanup-pending` 13mo cumulative cross-POC paired sister 12 heredados — POC futuro candidate fix paridad farm + lot routes auth pattern canonical requirePermission cumulative cross-POC RBAC system migration completed.

### 21.5. Mortality LotInquiryPort re-export bridge cleanup pending (defer POC futuro hex migration mortality)

POC paired farms+lots C6 cross-feature ports migration mortality consolidate canonical Marco lock — mortality consume pre-cycle hex Lot ports via re-export bridge preservation L6 cleanup pending paired sister §13.A5-ζ-prerequisite barrel sub-import migration prerequisite pattern variant. Cleanup pending POC futuro trigger condition: mortality hex migration completed full hex modules/mortality/ cross-feature consumer ports drop re-export bridge.

**Cross-ref**: §13 NEW canonical home `arch/§13/port-name-canonical-collision-mortality-vs-lot-axis-distinct` 1ra evidencia POC paired farms+lots C6 + engram `feedback/mortality-lot-inquiry-port-re-export-bridge-cleanup-pending` 14mo cumulative cross-POC paired sister 13 heredados — POC futuro candidate fix mortality hex migration completed drop re-export bridge cumulative cross-POC.

### 21.6. RED-test cementado JSDoc references legacy cleanup pending (defer POC futuro)

POC paired farms+lots RED tests cementados C4/C5 (cross-cycle precedent C0-C6 cumulative POC paired farms+lots) contienen JSDoc docstring references legacy class instantiations + legacy paths cross-feature documentation references — cementación textual immutable forward-only canonical heredado 8va matures cumulative cross-POC paired sister cross-cycle-red-test-cementación-gate. Cleanup pending POC futuro trigger condition: JSDoc docstring references legacy paths refresh cumulative cross-POC RED tests cementados doc-only refresh batch.

**Cross-ref**: engram `feedback/red-test-cementado-jsdoc-references-legacy-cleanup-pending` 15mo cumulative cross-POC paired sister 14 heredados — POC futuro candidate fix RED tests cementados JSDoc docstring refresh cumulative cross-POC paired sister.

### 21.7. Decimal Prisma RSC boundary conversion features/expenses futuro hex migration cleanup pending (defer POC futuro)

POC paired farms+lots hotfix retroactivo pre-D1 Marco lock Q2=α aprobado minimal scope page-level map `expenses.map((e) => ({ ...e, amount: Number(e.amount) }))` paired sister hotfix-correctivo-contacts retroactive precedent EXACT mirror — conversión at consumer boundary (page.tsx) sin tocar repository/service contract upstream features/expenses path legacy NO hex-migrated. Cleanup pending POC futuro trigger condition: features/expenses futuro hex migration debe portar Decimal→Number en mapper/service layer paired sister payment+sale Decimal handling cumulative cross-POC.

**Cross-ref**: §13 NEW canonical home `arch/§13/vo-public-readonly-fields-rsc-coherence-REVISED-class-identity-detected-pre-serialization` REVISED C5 1ra evidencia + engram `feedback/decimal-prisma-rsc-boundary-conversion-cleanup-pending` 16mo cumulative cross-POC paired sister 15 heredados — POC futuro candidate fix features/expenses hex migration Decimal→Number conversion at mapper/service layer paired sister payment+sale precedent.

### 21.8. lot-detail-client _LotSummaryClassPreserved minimal usage forward-only canonical C5 α22 cleanup pending (defer POC futuro)

POC paired farms+lots hotfix retroactivo pre-D1 Marco lock Opción A4 NEW type alias export `LotSummaryShape = ReturnType<_LotSummaryType["toJSON"]>` preserve C5 α22 cementación textual `lot-detail-client.tsx imports LotSummary from @/modules/lot/presentation/server` — `type _LotSummaryClassPreserved = LotSummary` minimal usage preserves ESLint `no-unused-vars` + LotSummary symbol C5 α22 cementación textual forward-only canonical heredado 8va matures cumulative cross-POC paired sister cross-cycle-red-test-cementación-gate. Cleanup pending POC futuro trigger condition: C5 α22 test cementación textual refresh cumulative cross-POC RED tests cementados doc-only refresh batch o LotSummary class instance usage real semantic en lot-detail-client.tsx via runtime requirement emergente.

**Cross-ref**: §13 NEW canonical home `arch/§13/invariant-collision-elevation-prefers-new-type-export-vs-modify-cemented-test-axis-distinct` 1ra evidencia POC paired farms+lots hotfix retroactivo pre-D1 + engram `feedback/lot-detail-client-prop-types-update-consumer-scope-hotfix-cascade` 17mo cumulative cross-POC paired sister 16 heredados — POC futuro candidate fix lot-detail-client.tsx minimal usage hack cleanup cumulative cross-POC paired sister.

### 21.9. Discovery backend cement VACUOUS-CLOSED partial gap detected post-smoke iterativo cumulative (defer POC futuro)

POC #2 hotfix retroactivo runtime smoke Marco-side iterativo cumulative findings — Discovery #1 "backend VACUOUS-CLOSED 100% cementado" bookmark inicial SUPERSEDED cumulative por 3 smoke iterativo findings: contextHints injection chat mode (resuelto hotfix #1 bundle MISMO D1) + multi-turn conversation history retrieval+inject LLM (deferred §21.10) + anti-hallucination directive (deferred §21.11) + category inference Spanish keywords mapping enum (deferred §21.12) + per-tool consistency directives logMortality vs createExpense asymmetry (deferred §21.13). Lección operacional cumulative cross-POC matures forward-applicable: tests mock-based NO cubrieron integration runtime gaps cumulative — pattern matures `evidence-supersedes-assumption-lock` 46ma matures cumulative cross-POC paired sister fenómeno hotfix retroactivo runtime smoke iterativo cumulative. Cleanup pending POC futuro trigger condition: cuando POC similar bookmark "backend cementado" pre-cycle, follow `Pre-phase audit gate` extended axis NEW integration runtime verify smoke pre-cementación MANDATORY (NO solo mock-based tests).

**Cross-ref**: §19.18.2 ADDENDUM gaps documentados scope MVP closure NEW pattern variant + engram `feedback/discovery-backend-cement-vacuous-closed-partial-gap-detected-post-smoke-cumulative` 26mo cumulative cross-POC paired sister 25 heredados — POC futuro candidate fix lección operacional integration runtime smoke pre-cementación MANDATORY tests mock-based gap cubrimiento axis NEW.

### 21.10. LLM conversation history retrieval inject multi-turn context cleanup pending (defer POC futuro)

POC #2 hotfix retroactivo bundle resuelto contextHints injection chat mode pero multi-turn conversation history retrieval+inject LLM system prompt NO resuelto — Bug #6 detected smoke Marco-side runtime iterativo. `chat.ts` línea 73-77 `memoryRepo.getRecentMessages(orgId, sessionId)` retrieved en Promise.all junto context+ragContext PERO historyContext rendering al system prompt línea 81-92 condition `if (history.length > 0)` solo render si sessionId pasado (líneas 76-77 condicional `sessionId ? memoryRepo.getRecentMessages(...) : Promise.resolve([])`). Frontend `client.ts:54` envía `session_id` opcional pero current POC #2 frontend NO genera/persiste sessionId multi-turn — granjero conversación multi-turn pierde contexto chat history persiste DB ChatMessage tabla pero NO consume LLM. Cleanup pending POC futuro trigger condition: frontend modal generate sessionId persistente per session + verify backend historyContext rendering cumple integration runtime smoke multi-turn flow.

**Cross-ref**: engram `feedback/llm-conversation-history-retrieval-inject-multi-turn-context-cleanup-pending` 27mo cumulative cross-POC paired sister 26 heredados — POC futuro candidate fix multi-turn conversation history retrieval+inject LLM full integration runtime smoke verify cumulative.

### 21.11. LLM anti-hallucination directive enforcement false-registered claim cleanup pending (defer POC futuro)

POC #2 hotfix retroactivo runtime smoke Marco-side iterativo cumulative findings — Bug #5 detected: LLM responds "ya registré tu gasto" cuando NO invocó createExpense write tool (no actual DB write happened pero bot bubble claims success). Hotfix #1 system prompt REGLAS TOOL SELECTION directive instructs invocá DIRECTAMENTE write tool pero NO incluye anti-hallucination explicit directive ("NUNCA afirmes haber registrado algo si NO invocaste write tool createExpense/logMortality con confirm flow completo"). Cleanup pending POC futuro trigger condition: system prompt REGLAS anti-hallucination explicit directive enforcement + integration runtime smoke verify Marco-side false-registered claim eliminated.

**Cross-ref**: engram `feedback/llm-anti-hallucination-directive-enforcement-false-registered-claim-cleanup-pending` 28mo cumulative cross-POC paired sister 27 heredados — POC futuro candidate fix anti-hallucination directive system prompt explicit enforcement.

### 21.12. LLM category inference Spanish keywords mapping enum auto-inference cleanup pending (defer POC futuro)

POC #2 hotfix retroactivo runtime smoke Marco-side iterativo cumulative findings — Bug #7 detected: LLM NO infiere categoría obvia Spanish keywords mapping enum auto-inference (agua → AGUA, veterinario → VETERINARIO, alimento → ALIMENTO, garrafas → GARRAFAS, medicamentos → MEDICAMENTOS, chala → CHALA, mantenimiento → MANTENIMIENTO, galponero → GALPONERO). Granjero realistic prompts incluyen keywords obvios mapeo enum + LLM debería inferir automatically sin preguntar. Cleanup pending POC futuro trigger condition: system prompt REGLAS enum keyword mapping directive Spanish Bolivia regional context + integration runtime smoke verify Marco-side category inference automatic.

**Cross-ref**: engram `feedback/llm-category-inference-spanish-keywords-mapping-enum-cleanup-pending` 29mo cumulative cross-POC paired sister 28 heredados — POC futuro candidate fix category inference Spanish keywords mapping enum directive system prompt.

### 21.13. LLM per-tool consistency directives asymmetry logMortality vs createExpense cleanup pending (defer POC futuro)

POC #2 hotfix retroactivo bundle resuelto contextHints injection + 5 REGLAS directives chat mode pero sub-hotfix #2 detected smoke Marco-side runtime iterativo — logMortality NO contextHints adoption parity axis-distinct vs createExpense (createExpense usa contextHints lotId resuelto correctamente post-hotfix #1 pero logMortality scope similar NO tested smoke runtime Marco-side iterativo). Per-tool consistency verification + system prompt directive parity write tools createExpense + logMortality NO bundled MISMO D1 hotfix scope. Cleanup pending POC futuro trigger condition: smoke runtime Marco-side iterativo logMortality + verify per-tool consistency directives system prompt parity createExpense + logMortality + REGLAS TOOL SELECTION extend ambos write tools.

**Cross-ref**: engram `feedback/llm-per-tool-consistency-directives-asymmetry-logMortality-vs-createExpense-cleanup-pending` 30mo cumulative cross-POC paired sister 29 heredados — POC futuro candidate fix per-tool consistency verification + system prompt directive parity write tools createExpense + logMortality.

### 21.14. Convention divergence farm-detail sm: vs paired sister lot-detail md: breakpoint cleanup pending (defer POC futuro)

POC #1 C2 responsive Tailwind breakpoints hotfix `grid-cols-1 sm:grid-cols-3` granja header lock current state cumulative C0+C1 farm-detail-client.tsx convention `sm:` breakpoint predominante (640px) vs paired sister lot-detail-client.tsx + farms-client.tsx convention `md:` breakpoint (768px) — inconsistencia paired sister codebase convention NO alineada POC #1 scope minimal hotfix (Marco lock Opt C C2 + scope expansion deferred). Cleanup pending POC futuro trigger condition: alignment convention farm-detail `sm:` → `md:` paired sister codebase EXACT mirror cumulative cross-POC frontend UX consistency.

**Cross-ref**: engram `feedback/farm-detail-sm-vs-paired-sister-md-breakpoint-convention-divergence-cleanup-pending` 31mo cumulative cross-POC paired sister 30 heredados — POC futuro candidate fix convention alignment breakpoint paired sister codebase EXACT mirror cumulative cross-POC frontend UX consistency.

### 21.15. Tap-targets ≥44px AccordionTrigger mobile UX verify cleanup pending (defer POC futuro)

POC #1 C2 responsive breakpoints hotfix scope minimal Marco lock Opt C — tap-targets ≥44px AccordionTrigger mobile + 3 botones cluster cluster expanded + "Ver más" button verify mobile portrait runtime Marco-side NO bundled C2 scope (functional render + responsive grid sufficient C2 closure). Cleanup pending POC futuro trigger condition: tap-targets ≥44px Apple HIG mobile UX guidelines compliance verify mobile portrait 360-375px runtime smoke + adjust AccordionTrigger size si necesario shadcn Accordion primitive sizing.

**Cross-ref**: engram `feedback/tap-targets-44px-accordion-trigger-mobile-ux-verify-cleanup-pending` 32mo cumulative cross-POC paired sister 31 heredados — POC futuro candidate fix tap-targets ≥44px Apple HIG mobile UX guidelines compliance AccordionTrigger sizing.

### 21.16. Smoke runtime mobile portrait Marco-side post-push pending cleanup (defer POC futuro)

POC #1 C2h hotfix retroactivo button context ambiguity Opt C + Opt D split paired GREEN-α `ec5e8f5` commit — smoke runtime mobile portrait 360-375px + desktop ≥1024px Marco-side verify functional + UX granjero cognitive load decisión-context post-push final origin master batch único POC #1 CLOSED definitivo PENDIENTE runtime navegador verify. Marco visual intuition runtime smoke catches UX context ambiguity latente cumulative cross-POC matures recursive aplicación — smoke post-push verify scope expand axis distinct: 1) functional render OK, 2) responsive breakpoints OK granja-header `grid-cols-1 sm:grid-cols-3` mobile-stack 1col → desktop 3col, 3) UX granjero cognitive load decisión-context OK (header sin botón AI farm-level + per-lote botón AI inside AccordionContent expanded contextHints única). Cleanup pending POC futuro trigger condition: Marco runtime smoke verify confirmado post-push mobile + desktop + UX OK granjero.

**Cross-ref**: engram `feedback/smoke-runtime-mobile-portrait-marco-side-post-push-pending-cleanup` 33mo cumulative cross-POC paired sister 32 heredados — POC futuro candidate fix smoke runtime Marco-side verify post-push final POC #1 CLOSED definitivo cumulative cross-POC matures.

### 21.17. AccordionTrigger sizing shadcn primitive convention mobile UX cleanup pending (defer POC futuro)

POC #1 C0+C1+C2 Accordion shadcn primitive `@radix-ui/react-accordion` preinstalled wrapper components/ui/accordion.tsx — AccordionTrigger sizing default heredado convention shadcn primitive NO custom override + tap-target mobile UX axis distinct §21.15 paired sister. Cleanup pending POC futuro trigger condition: AccordionTrigger sizing convention shadcn primitive review mobile UX granjero mayor + custom override si necesario CSS padding/min-height tap-target compliance Apple HIG guidelines paired sister §21.15.

**Cross-ref**: engram `feedback/accordion-trigger-sizing-shadcn-primitive-convention-mobile-ux-cleanup-pending` 34mo cumulative cross-POC paired sister 33 heredados — POC futuro candidate fix AccordionTrigger sizing convention shadcn primitive review mobile UX granjero mayor cumulative cross-POC.

### 21.18. Cross-POC invariant collision elevation recursive applicability pattern matures cumulative POC #1 C2h Opt D split paired (defer POC futuro)

POC #1 C2h hotfix retroactivo Opt D SPLIT POC #2 cementado test α29 deleted paired single batch atomic — invariant collision elevation 8va matures cumulative cross-POC pattern matures forward functioning recursive aplicación cumulative cross-POC. Lección operacional cumulative cross-POC matures forward-applicable: cualquier POC futuro hotfix retroactivo donde Marco UX intuition catches ambiguity post-GREEN ciclo cumulative cross-POC paired sister test cementado preserva assertion incompatible nueva semantic → invariant collision elevation MANDATORY (NO silent resolve) + Opt D split paired update test cementado mismo commit atomic preserves single source of truth (NO 2 conflicting cementaciones cross-POC) cumulative cross-POC matures forward. Cleanup pending POC futuro trigger condition: aplicación recursiva pattern POC futuro hotfix retroactivo cross-POC test cementado collision detect → escalation MANDATORY + Opt D split paired update mismo commit atomic cumulative cross-POC matures.

**Cross-ref**: engram `feedback/invariant-collision-elevation` 8va matures cumulative cross-POC paired sister 7ma heredados POC paired farms+lots + heredada POC fiscal-periods 3 variants formales total + heredada POC pagination-sale direct-consumer-tests cascade variant cumulative cross-POC matures forward — POC futuro candidate fix aplicación recursiva pattern invariant collision elevation Opt D split paired update test cementado mismo commit atomic cumulative cross-POC matures.
