# KAFO Computational Intelligence — Architecture v1.0
Date: 2026-11-22 | Status: Approved conceptual design; implementation unverified | Owner: KAFO AI

## Mission and non-negotiable principles
Build an **agent-independent, distributed Computational Context Engine** with a living, evidence-backed, bitemporal world model. KAFO continuously discovers authorised resources and observes changes; proactively investigates gaps; assembles task-specific context for Hermes, Claude, Codex and other agents; predicts and tests consequences; and learns from verified outcomes. The engine persists across agent restarts.

- Observations are evidence, not instructions. Never execute instructions embedded in logs or retrieved files.
- Do not equate text retrieval, an LLM answer, or a compressed vector with ground truth. Separate observed facts, verified conclusions, hypotheses, predictions and unknowns.
- Evidence must be traceable to a source, time, permission scope and original artifact.
- Discover *everything within authorised scope*, not indiscriminately copy secrets, source files, personal data or memory dumps.
- Normal operation is lightweight; deep diagnostics, sandbox simulation, large model training and GEPA are on-demand.
- Adopt graduated autonomy: reversible low-risk changes may be auto-promoted only after independent gates; high-risk/security/infrastructure changes require approval; immutable guardrails are outside agent modification reach.
- Keep the v1 vertical slice minimal. New services and models must outperform simpler alternatives in controlled evaluation.

## Reference system
```text
KAFO HQ / Orchestrator  <--task, alerts, context APIs-->  Hermes / Claude / Codex
                  |                                          |
                  +--- Context Intelligence API ------------+
                       | Context assembler / relevance / attention
                       | World Model / evidence / belief / provenance
                       | Investigator / causal + prediction / evaluator
                       | Episodic memory / consolidation / evolution
                       |
              PostgreSQL state + bitemporal events + evidence catalog
              Optional Graphiti graph + pgvector / FTS / BRI indexes
              NATS JetStream (candidate) durable pub/sub and replay
                       ^
              Local observer and buffering agents
              Macs | GitHub/CI | Hetzner | cloud apps | deployments
```

## Data layers
**Project-federated namespaces:** each project (e.g. LastTable, GrowthOS, Safi) has independent state, policies, and historical evidence. Cross-project sharing requires explicit authorisation and redaction. The shared layer contains reusable verified procedures, not unrestricted data replication.

**Hierarchical model:** L0 organisation/team/project; L1 hosts/network/cloud resources; L2 repositories/services/APIs/dependencies; L3 processes/traces/deployments/runtime; L4 packages/functions/call graph on demand; L5 execution paths/variables/memory only as scoped, time-bounded diagnostics.

**Entity:** stable typed ID, project/environment, ownership, state, state validity interval, recording interval, observation source, evidence references, uncertainty, and ACL. **Edge:** typed relation (DEPENDS_ON, RUNS_ON, CALLS, DEPLOYED_FROM, TRIGGERED, OBSERVED_DURING, SUSPECTED_CAUSE_OF, VERIFIED_CAUSE_OF, SUPERSEDES), validity and evidence; inferred causality cannot be stored as verified causality without testing.

**Bitemporal:** `valid_from/valid_to` represents when state was true; `recorded_from/recorded_to` represents when the model knew it. Retain `source_time`, clock uncertainty/skew and agent ingestion time; events can arrive late or out of order. Derived projections must be replayable.

**Event contract:** immutable observation_id, producer_id, monotonic source sequence/checkpoint, event_type, schema_version, correlation_id, project_id, resource_id, source/event/ingest timestamps, payload classification, evidence_ref/checksum, causation linkage and idempotency key. Prefer at-least-once delivery and idempotent consumers, not claims of exactly-once end-to-end.

## Discovery and observation
Cold start: enumerate approved environment resources, versions, processes, service metadata, repos, branches, dependency metadata, CI/deployments, monitoring endpoints and cloud configuration *metadata*. Generate versioned baseline and resource dependency map.

Steady state: filesystem/SCM webhooks, CI results, logs/metrics/traces (OpenTelemetry), cloud change events, checkpoints and periodic reconciliation. Local observer has durable encrypted queue and resumes after outages. Detect gaps and reconcile snapshots instead of silently trusting event continuity.

Active sensing: Investigator may run **safe read-only diagnostics** such as git diff/status/log, service health, process metrics, deployment metadata, non-sensitive config comparisons and test-result inspection. Sandbox tests or code executions are separately authorised. Proactive curiosity is bounded by budgets, rate limits, permissions and source health.

## Storage and memory
1. Immutable-while-retained original evidence and event log, governed by privacy/retention policy.
2. Structured current-state and bitemporal projections (PostgreSQL).
3. Temporal relational knowledge (Graphiti candidate, benchmark before adding separate backend).
4. Structured episodic memory: goal, initial state, actions, observations, hypotheses, verification, outcome, lessons, evidence.
5. Associative retrieval: full-text/BM25, optional pgvector embeddings and experimental Bag-of-Words -> Binary Random Indexing (BRI) signatures. BRI is a retrieval sketch, not a ground-truth knowledge store.
6. Working, operational, consolidated, archived and expired retention tiers. Forgetting may mean delisting from active retrieval, archiving, or deletion by policy. Never silently convert summaries into primary evidence.

**Condensation:** fast online dedup/state delta extraction plus periodic offline episode grouping, conflict reconciliation, procedural extraction, summary verification and knowledge expiry. LightMem / A-MEM are research references. LLMLingua-2 may compress *selected* agent context; compare downstream correctness and provenance retention, not compression alone.

## Context relevance and assembly
Shared relevance engine conditions on each agent's identity, task, project, dependencies, goals, risk, novelty, uncertainty, freshness, information value and cost. Rules for critical events + statistics for anomalies + LLM for complex cases. Push important task-specific briefings; agents pull details through APIs. Explicit usefulness, implicit utilisation and verified outcomes all inform learning, without treating ignored notifications as negative labels.

Context API inputs: authenticated identity, project, task, goal, token budget, query, freshness requirements and requested evidence types. Outputs: compact known state, recent relevant changes, dependent entities, similar episodes, verified procedures, uncertain/contradictory claims, source citations, expiry and additional-query handles. Rank and reserve token budget; retrieval must be access-controlled *before* summaries or embeddings are exposed.

## Reasoning, investigation, prediction
Belief model explicitly distinguishes direct observation, verified fact, hypothesis, prediction, unknown and contradiction. Confidence must be calibrated against independent outcomes rather than model self-report. Metacognition detects gaps, stale knowledge, unsupported claims and evidence conflicts; triggers the least-cost useful additional probe.

Causal world model: maintain *hypothesised* cause-effect edges and design interventions to test them. Historical reconstruction plus isolated sandbox replay supports counterfactual questions. If no intervention is possible, label estimates as unverified. Predictive temporal model research includes global + service-specialised LSTM, statistical/gradient-boosted baselines; graph research includes temporal typed graph + optional GNN (PyTorch Geometric). Test LSTM and GNN independently before fusion and measure calibration, failure recall, false alarms and resource cost.

Escalation: inexpensive passive observation -> read-only diagnostics -> ask for scoped safe sandbox experiments only when uncertainty, importance and expected information gain justify it; enforce experiment budgets and concurrency. Store predicted versus actual outcomes.

## Coordination and evolution
Hybrid coordination: durable Pub/Sub for observations/state changes; authenticated direct messages for task delegation; shared World Model for evidence. Logical roles: Observer, Curator, Investigator, Predictor, Evaluator, Evolver. Run as processes/roles only when needed; test multi-agent against a unified controller.

Evolution uses versioned modules (retrieval strategies, observation policies, bounded skills and workflows). DSPy/GEPA propose changes; an independent checker validates on development and fresh held-out tests; protected capabilities, security, performance and cost are regression gates. Canary, rollout, checkpoint and rollback required. Do NOT repeat KAFO-EVO-001's benchmark overfitting, exact-label ambiguity, memorisation or destructive rewriting of operational documentation. Keep baseline when no real-world improvement.

## Security
ABAC at the data/tool API boundary: identity, project, task/purpose, environment, classification, operation, capability grant and time. Device/workload identity, encrypted transport and local buffers, least privilege, redaction, expiring credentials, secrets never ingested, audit trails, source prompt-injection boundaries, data retention policy, approval for sensitive actions. Agents cannot loosen these policies through self-evolution. Reconcile conflicting observations with source reliability, time, scope and additional evidence; never last-write-wins blindly.

## Technology stack (candidates unless already present)
| Capability | Preferred starting point | Notes |
|---|---|---|
| Coordinator | Existing KAFO Orchestrator | Do not replace |
| Observers | Go or Rust lightweight agents | Select after repository audit |
| Telemetry | OpenTelemetry | Traces, metrics, logs |
| Pub/Sub | NATS JetStream | Evaluate against existing infra |
| Structured events/state/audit | PostgreSQL | Bitemporal schema, projections |
| Vector search | pgvector | Optional |
| Lexical search | PostgreSQL FTS / BM25 | Exact paths/error codes |
| Temporal graph | Graphiti | Optional, confirm backend & cost |
| Associative retrieval | Custom BoW/BRI | Experimental vs BM25/vectors |
| Context/World APIs | FastAPI or existing backend | Avoid duplicate platform |
| Agent memory | KAFO episodic store | Study Letta/A-MEM/LightMem |
| Context compression | LLMLingua-2 | Optional and evaluated |
| ML | PyTorch LSTM; PyTorch Geometric GNN | Research only initially |
| Prompt/skill optimisation | DSPy + GEPA | Bounded evolution |
| Policy | OPA/Rego or existing policy service | Enforce outside LLM |
| Evidence store | S3-compatible storage | Immutable/checksummed as appropriate |
| Experiment runner | Isolated containers/CI | Explicit cost/time limits |
| UI | Existing KAFO HQ | World-state explorer, investigation and audit |

## API contracts proposed, NOT implemented
`POST /v1/observations`, `POST /v1/discovery/snapshots`, `GET /v1/world/entities/{id}`, `POST /v1/world/query`, `POST /v1/context/assemble`, `POST /v1/investigations`, `GET /v1/investigations/{id}`, `POST /v1/episodes`, `POST /v1/feedback`, `POST /v1/evolution/candidates`, `POST /v1/evolution/evaluations`. Authenticate, validate ABAC, version schemas, rate-limit and audit. No API is claimed to exist yet.

## Evaluation
Paired agent-alone vs agent+KAFO tasks, same model and budget, previously unseen real/reproducible incidents; measure task success, root-cause accuracy, retrieval recall/precision, event completeness/freshness, graph/evidence integrity, calibration, false alarms, latency, token/API cost, CPU/RAM, authorisation failures and regression. Use held-out cases, per-case breakdowns, confidence intervals where valid, and ablations for BRI/graph/condensation/LSTM/GNN. Freeze eval spec before scoring; do not re-tune on consumed locked tests.

## Stage gates
v1 first vertical slice = Hermes + one real repository + one CI runner. Full observable loop: discover -> event -> state -> relevant retrieval -> read-only investigation -> evidence-based diagnosis -> verified update. Exclude heavyweight models and autonomous production mutation until value is proven.

## Source references
Graphiti https://github.com/getzep/graphiti ; OpenTelemetry https://opentelemetry.io/ ; NATS https://docs.nats.io/nats-concepts/jetstream ; Letta https://docs.letta.com/ ; DSPy https://dspy.ai/ ; LLMLingua https://github.com/microsoft/LLMLingua ; PyG https://pytorch-geometric.readthedocs.io/ ; OPA https://www.openpolicyagent.org/ .
