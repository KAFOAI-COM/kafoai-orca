# KAFO Computational Intelligence — Multi-Sprint Delivery Plan
Version 1.0 | 2026-11-22 | Companion: [Architecture](ARCHITECTURE-v1.md) · [Decision Register](DECISIONS.md)

## Planning conditions
This is a proposed execution backlog, **not** a statement that any sprint has been built. Audit the actual running KAFO repositories, agent runtime, data stores, event buses, authentication boundaries and CI conventions before implementation. This GitHub repository currently presents as an Orchestrator.inc-based codebase; do not assume it contains the entire GrowthOS/KAFO runtime. Preserve existing application functionality. Build on a feature branch with small PRs. CI, security and human approval gates remain in place. Existing GEPA/KAFO-EVO-001 findings are inputs, not a validated deployment of these capabilities.

## Common Definition of Done — every sprint
- Architecture/interface docs and threat model current; clear owner and scope.
- Versioned schemas, migrations and backwards-compatible APIs with retries and idempotency.
- Unit, integration, security and failure-injection tests; real QA traces saved with redaction.
- Telemetry (health, throughput, lag, costs, errors), rollout toggle and rollback method.
- Evidence of measurable acceptance criteria (no self-assessed completion).
- No unauthorised secrets ingestion, no direct production mutations from self-modifying agents.
- Explicit stop/go checkpoint, costs and follow-on blockers in sprint report.

## Phase 0: Repository discovery and baseline

### KAFO-CI-000 — Reality audit and architecture alignment
**Dependencies:** none. **Goal:** establish the actual implementation topology before writing code.
**Tasks:** inventory repo(s), service boundaries, environment, Orchestrator extension interfaces, database/migrations, CI, existing GA/GEPA artefacts, GitHub and runner integrations, current telemetry and security controls; establish deployment target and cost envelope; confirm branch protection. Record observed vs planned capabilities. Establish a reproducible Hermes CI-failure diagnostic baseline and task/eval dataset with disjoint train/dev/fresh test splits. Create 3 ADRs covering event bus, storage and observer runtime after alternatives are tested.
**Deliverables:** current-state topology, component gap map, threat model, initial test harness, interface contracts, scope/permissions, cost budget.
**Acceptance:** a reviewer can reproduce baseline task scores; all planned dependencies traced to real repos/config; no invented endpoints.
**Exit:** design reviewed, implementation path confirmed.

## Phase 1: End-to-end vertical slice

### KAFO-CI-001 — Living Context MVP
**Dependencies:** CI-000. **Goal:** one complete closed loop for Hermes + one repository + one CI runner.
**Tasks:** scoped initial inventory, local collector or bridge, GitHub webhook/CI failure capture, signed/validated event ingest, immutable evidence pointers, Postgres entities and current-state projections, basic dependency relations, read-only investigation tools, `/v1/context/assemble` with source references, thin Orchestrator adapter and operator-facing trace.
**Deliverables:** Observer v0, API v0, state/evidence schema, CI diagnostic demonstration, runbooks.
**Acceptance:** detect new CI incident, link repository/commit/job/test evidence, ask Hermes for diagnosis, log its actions and record independent verdict. Replay an event without duplicates; prevent cross-project and unauthorised reads. Compare paired Hermes-alone vs Hermes+context on a preregistered sample.
**Non-goals:** Graphiti backend, BRI, LSTM/GNN, autonomous experiments, production-changing actions.
**Exit:** working vertical slice and measurable comparison.

### KAFO-CI-002 — Durable distributed observation
**Dependencies:** CI-001. **Tasks:** NATS JetStream evaluation or equivalent existing bus, local encrypted queue, backpressure, durable subscriptions, replay, GitHub/CI + second host source, source sequence, idempotency and checksum, outage reconciliation, schema evolution and telemetry.
**Acceptance:** force offline reconnect, duplicate and reorder delivery; state converges to verified snapshot; report delay and loss metrics; replay produces deterministic projections.

### KAFO-CI-003 — Bitemporal and federated World Model
**Dependencies:** CI-001, CI-002. **Tasks:** bitemporal validity/knowledge schema, clock uncertainty, typed graph relations and source provenance, conflict handling, project isolation, cross-project sharing policy, historical as-of queries, audit and data expiry.
**Acceptance:** reproduce what was true at T versus known at T; late-arriving contradictory evidence does not delete history; ABAC isolation tests pass.

## Phase 2: Task-aware memory and retrieval

### KAFO-CI-004 — Hybrid memory and episodic learning
**Dependencies:** CI-003. **Tasks:** episode schema, evidence linkage, lexical retrieval, pgvector pilot, optional Graphiti spike with backend/cost review; compare BRI BoW index with BM25 and embeddings, build retrieval evaluation set from real incidents; avoid unsourced lessons.
**Acceptance:** per-case retrieval and grounded-answer metrics improve on baseline at acceptable p95 latency and CPU/RAM; choose indexes based on results, not novelty.

### KAFO-CI-005 — Relevance, attention and adaptive context
**Dependencies:** CI-004. **Tasks:** shared task-conditioned relevance scoring (risk, dependencies, novelty, uncertainty, freshness, resource cost), separate store-vs-interrupt thresholds, critical-event rules, push alerts + pull detail, token-aware context assembly, per-agent ACL, controlled relevance feedback.
**Acceptance:** low false-interruption rate without missing defined critical events; measurable task win over static context retrieval; no unauthorised cross-project context.

### KAFO-CI-006 — Consolidation, forgetting and knowledge quality
**Dependencies:** CI-004, CI-005. **Tasks:** online dedup and delta compression, offline episode consolidation, confidence/freshness and contradictions, retention tier jobs, source pinning, optional LLMLingua evaluation, A-MEM/LightMem design study.
**Acceptance:** archived/expired data excluded appropriately; summaries preserve critical evidence references; compression does not degrade downstream task correctness beyond agreed threshold; deletion policies verified.

## Phase 3: Investigative intelligence

### KAFO-CI-007 — Bounded active investigation and metacognition
**Dependencies:** CI-003, CI-005. **Tasks:** knowledge-gap detector, hypothesis registry, read-only diagnostic tool catalogue, tool permissions and query budgets, investigator lifecycle, correlation IDs, plan/observe/verify traces, confidence calibration and independent checker.
**Acceptance:** resolve reproducible CI incidents with fewer unsupported claims than Hermes-alone; permission, time and token exhaustion terminate safely; source contradiction stays unresolved until evidence is sufficient.

### KAFO-CI-008 — Adaptive experiments and causal evidence
**Dependencies:** CI-007. **Tasks:** B->C escalation policy; ephemeral isolated sandbox, experiment hypothesis/expected-result/outcome schema, historical state replay and safe counterfactual trials, cost/CPU/concurrency ceilings, signed audit and human gates for sensitive operations.
**Acceptance:** identical sandbox experiment can be reproduced; causal claims require intervention or are explicitly labelled unverified; emergency stop and rollback demonstrated.

## Phase 4: Prediction, multimodal and sharing

### KAFO-CI-009 — Temporal and graph prediction research
**Dependencies:** CI-003, CI-004, CI-007. **Tasks:** build clean sequence and graph datasets without test leakage; simple statistical baselines; global + specialised LSTM; GNN benchmark and graph heuristic baseline; calibration, drift and ablations; online inference with controlled retraining, model registry and rollback.
**Acceptance:** only promote models with reproducible lift over simple baselines and constrained latency/compute; otherwise retain heuristics. Report confidence intervals and negative findings.

### KAFO-CI-010 — Multimodal and cross-project knowledge
**Dependencies:** CI-003, CI-005, CI-006. **Tasks:** visual UI evidence pointers (access-controlled), screenshots/tests/runtime trace correlation, evidence preservation, sanitized shared procedures, federated search under ABAC, conflict reconciliation.
**Acceptance:** solve visual-only failure examples with code/trace support; no unapproved leakage across namespaces; content classified and retained according to policy.

## Phase 5: Evolution and autonomy

### KAFO-CI-011 — Evaluated self-evolution pipeline
**Dependencies:** CI-004, CI-007, CI-008. **Tasks:** capture verified learning episodes, bound skill mutations, integrate DSPy/GEPA as *optional optimiser*, freeze protected core instructions, independent development and fresh locked-test gates, capability retention checks, canary rollout, checkpoints and rollback. Reuse lessons from KAFO-EVO-001 (small hand-written datasets, ambiguous labels, memorisation, lost GitHub guidance, evolve_skill fix).
**Acceptance:** independently demonstrated real-task improvement with no critical regression; run cost and tool call trace reported; candidate failing gate cannot promote; rollback tested.

### KAFO-CI-012 — Operator UX and production hardening
**Dependencies:** CI-001 through CI-011 as relevant. **Tasks:** HQ World Model explorer, event timelines with dual time axes, episode browser, context-debug view, uncertainty and source drill-down, policy/budget console, notifications, SLOs, backups, security red-team tests, migration/recovery and on-call playbooks.
**Acceptance:** operator can explain a diagnosis down to original evidence, inspect what KAFO knew at a past time, disable investigation/evolution safely, and restore from backup with verifiable state.

## Dependency chain
```text
000 -> 001 -> 002 -> 003 -> 004 -> 005 -> 006
                  |       |       |
                  +-------+------>007 -> 008 -> 011
                          |       |
                          +------>009
                          +----->010
001 --------------------------------->012 (progressively)
```
Do not gate all UI/observability work until the end; expand it incrementally. CI-009 and CI-010 can run as research/workstreams after prerequisites but should not block a functional v1.

## Independent gates and verification
**Gate G0:** real codebase/integration topology established.
**G1:** cold start + first event + read-only diagnosis end-to-end.
**G2:** offline/reorder/replay/scope tests.
**G3:** bitemporal + federated evidence queries.
**G4:** retrieval gains on blind real incidents.
**G5:** correct attention/context under token budget.
**G6:** audited condensation and retention.
**G7:** independent useful diagnostics, bounded execution.
**G8:** reproducible controlled sandbox experiments.
**G9:** optional ML beats baselines; otherwise defer.
**G10:** self-evolution demonstrates protected capability retention and held-out improvement.
**G11:** operational controls, recovery and security sign-off.

## Initial priority queue — do not parallelise prematurely
1. Audit actual Orchestrator/KAFO code and service boundaries.
2. Make reproducible 'Hermes with vs without Context Engine' CI diagnosis harness.
3. Build the smallest immutable event + current-state + evidence-ref pipeline.
4. Add context retrieval and read-only investigator.
5. Establish a measurable first win before adding graph backends, BRI, LSTM or GNN.

## Risks and mitigations
- **Overengineering:** feature gates and ablations; keep optional services out of MVP.
- **Information leakage:** ABAC at ingestion, storage, retrieval and tools; exclude secrets.
- **Event drift/ordering:** idempotency, timestamps, reconciliation, snapshots.
- **False confidence and causal hallucination:** explicit epistemic status, evidence links and interventions.
- **Self-evolution overfitting:** diverse real tasks, fresh independent test, protected capabilities.
- **Compute/LLM runaway:** budgets and rate limits, B diagnostics before C sandbox.
- **Wrong repository/duplicate platform:** CI-000 audit and design integration approvals.
- **Data retention:** approved policies with true delete/archive semantics and audit exceptions.

## Proposed planning format per sprint
Each sprint should create scoped issues with: goal; baseline; actors/components; files/services affected; typed event/API contracts; dependencies; threat model; tests; benchmark cases; budget; acceptance evidence; rollback; release decision. No claim of success without checks.
