# KAFO Architecture Decision Register — 2026-11-22

Status: agreed design choices; implementation requires repository audit and validation. Choices follow the discussion order. In particular, ADR-13 reflects the later correction: graduated autonomy **C** is preferred; fully autonomous **B** only for isolated experiments.

- **ADR-01 — Engine independent of Hermes/other agents.**
- **ADR-02 — Full authorised discovery; passive events plus active read-only investigations.**
- **ADR-03 — Hierarchical global state and on-demand deep inspection.**
- **ADR-04 — Hybrid state + temporal graph + event log + BRI.**
- **ADR-05 — Distributed observers with central logical model.**
- **ADR-06 — Hierarchical working/long-term/permanent evidence-aware memory.**
- **ADR-07 — Hybrid importance: deterministic rules, statistics, AI.**
- **ADR-08 — Evidence-grounded fact/hypothesis/prediction/unknown distinctions.**
- **ADR-09 — Predict consequences; isolated tests where feasible.**
- **ADR-10 — Proactive bounded curiosity.**
- **ADR-11 — Cross-agent knowledge sharing with agent-specific expertise.**
- **ADR-12 — Evolve observation, memory, investigation and prediction policies.**
- **ADR-13 — Graduated autonomy C in production; autonomous B experiments isolated.**
- **ADR-14 — Experiment with specialist multi-agent roles against unified baseline.**
- **ADR-15 — Pub/Sub plus direct delegation and shared state.**
- **ADR-16 — Relevant push + detailed pull context.**
- **ADR-17 — Shared relevance model conditioned on task.**
- **ADR-18 — Explicit + implicit + verified relevance feedback.**
- **ADR-19 — Adaptive context assembly per token budget.**
- **ADR-20 — Fast online and periodic offline condensation.**
- **ADR-21 — Intelligent selective forgetting and archival.**
- **ADR-22 — Metacognition with independent calibration.**
- **ADR-23 — Evolving causal hypotheses tested by interventions.**
- **ADR-24 — Historical reconstruction and sandbox counterfactuals.**
- **ADR-25 — Goal-directed resource attention.**
- **ADR-26 — Structured episodic memory.**
- **ADR-27 — Hierarchical shared/specialised temporal LSTM experiments.**
- **ADR-28 — Continuous inference, controlled incremental learning, offline retraining.**
- **ADR-29 — Temporal graph + experimental GNN.**
- **ADR-30 — Multimodal logs, code, visual and behavioural evidence.**
- **ADR-31 — Default read-only B diagnostics; adaptive sandbox C escalation.**
- **ADR-32 — Federated project world models with governed sharing.**
- **ADR-33 — Evidence-based conflicting observation reconciliation.**
- **ADR-34 — Bitemporal valid and knowledge time.**
- **ADR-35 — ABAC project/task/agent/operation permissions.**
- **ADR-36 — Hybrid open-source components plus bespoke KAFO intelligence.**
- **ADR-37 — Distributed lightweight observers and central intelligence.**
- **ADR-38 — Complete vertical slices before advanced components.**

## Decision policy
Changes to these design decisions require a new dated ADR explaining alternatives, security implications, cost and measurable acceptance criteria. Do not confuse architecture approval with production readiness.
