# Magpii harness execution plan — Mandate

How to build Mandate **inside this harness**, not as a chat-driven rewrite of Rogo.

## 1. Correct starting skill

**Start in Inception_Product, not the delivery pipeline.**

| Wrong start | Why it fails |
|---|---|
| `saas-lifecycle-pipeline` step 1 (`product-platform-evaluator`) | Evaluator compares a **built** product to a signed spec. There is no app codebase yet. |
| `lead-architect` / `entity-architect` | Planning chain requires product intent. Entity modelling without a discovery brief invents a Bloomberg clone. |
| `ai-feature-engineer` first | AI contract has no tenant entities, no workflows, no UX disclosure surfaces. |

**Correct start**

```text
product-discovery  →  discovery-brief.json
lead-product-architect / spec-analyst  →  spec-contract.json (unsigned → signed)
[NEW sibling app repo]
lead-architect tech-stack council  →  docs/TECH_STACK_RESOLUTION.md
saas-lifecycle-pipeline step 01 as greenfield baseline (`evaluationMode: release-candidate`)
```

This PR completes discovery + draft spec. Sign-off is a human gate.

## 2. Pipeline: required vs optional for this product

Mandate is AI-heavy, confidential, internal (not billed SaaS). Lifecycle map: `lifecycle-map.json` + `Technology_Council/saas-lifecycle-pipeline/workflow-manifest.json`.

### Inception (this pack)

| Step | Skill | Required? | Output |
|---|---|---|---|
| Discovery | `Inception_Council/product-discovery` | **Yes** | `discovery-brief.json` |
| Vision | vision-mission-writer | **Yes** | `PLATFORM_VISION.md` |
| Structure | epic-decomposer | **Yes** | `PRODUCT_ROADMAP.md`, epic files |
| Specify | feature-requirements-writer | **Yes** | feature files, `spec-contract.json` |
| Validate | `npm run validate:spec` | **Yes** | schema-valid contract |
| Handoff | lead-product-architect | **Yes, after human sign-off** | `signedOff: true` |

### Delivery (sibling app repo, after sign-off)

| # | Skill | Required for Mandate? | Notes |
|---|---|---|---|
| 1 | product-platform-evaluator | Baseline only | No `greenfield` enum — use `evaluationMode: "release-candidate"`, empty/stub codebase, `conditional_pass`, no blockers on spec quality |
| 2 | ux-flow-designer | **Yes** | Cited Q&A, matrix table, memo review |
| 3 | prototype-reviewer | Optional | Skip until Figma/Claude Design URL exists |
| 4 | entity-architect | **Yes** | `AiAgent` class already in entity schema |
| 5 | workflow-architect | **Yes** | Ingest → index → run → review → export |
| 6 | accessibility-specialist | **Yes** | WCAG on table + document review UI |
| 7 | billing-subscription-engineer | **Skip** | Internal tool; `optionalWhen: Product not monetised` |
| 8 | test-strategist | **Yes** | Include citation + numeric eval cases |
| 9 | feature-implementer | **Yes** | Implementation contract |
| 10 | ai-feature-engineer | **Required (not optional)** | RAG, tools, guardrails, eval suite |
| 11 | pr-code-reviewer | **Yes** | Four-eye via `llm-routing.json` |
| 12 | dependency-security-scanner | **Yes** | LLM SDKs, parsers, Office generators |
| 13 | refactoring-specialist | Optional | Only if debt remediation is in scope |
| 14 | observability-architect | **Yes** | Token cost, retrieval miss, citation coverage |
| 15 | ci-cd-engineer | **Yes** | Eval suite as a merge gate |
| 16 | migration-engineer | **Yes after v0 schema** | Postgres + vector index |
| 17 | release-manager | **Yes** | Internal staged rollout |
| 18 | deployed-app-reviewer | Optional until staging URL | |
| 19 | tenant-provisioning | **Treat as required** | Client/mandate isolation even for a single firm |
| 20 | load-test-engineer | Optional until multi-user ingest | |
| 21 | sre-on-call | Optional until production | |
| 22 | debugger | Ad hoc | |
| 23 | technical-writer | **Yes** | Limitation disclosures, MNPI handling |

**Always-on architects** (lead-architect intake): API, Security, plus Entity, Data, Workflow, Backend, Frontend, Cloud, Application. **`api-architect` is required after entity + workflow** even though it is not one of the 23 pipeline steps. Mobile: skip for MVP.

## 3. Artifact chain (filename, schema, validation, gate)

Validate from Magpii-Skill-harness root unless noted.

| Artifact | Schema | Validate | Gate |
|---|---|---|---|
| `discovery-brief.json` | `schemas/discovery-brief.schema.json` | `node scripts/validate-artifacts.mjs --file=<file> --schema=discovery-brief.schema.json` | Problem names persona + outcome; buyer+user; anti-goals; `signedOff` human |
| `spec-contract.json` | `Inception_Product/schemas/spec-contract.schema.json` | `cd Inception_Product && npm run validate:spec -- --file=products/mandate/spec-contract.json` | `signedOff: true` + `signedOffAt` before delivery |
| `product-evaluation-report.json` | `schemas/product-evaluation-report.schema.json` | `npm run validate:artifacts` | Baseline for greenfield |
| `ux-flow-contract.json` | `schemas/ux-flow-contract.schema.json` | same | Primary journeys signed |
| `entity-contract.json` | `schemas/entity-contract.schema.json` | `node scripts/validate-contract.mjs entity-contract.json --type=entity` | Registry includes `AiAgent`; tenancy boundaries |
| `workflow-contract.json` | `schemas/workflow-contract.schema.json` | `--type=workflow` | HITL on export |
| `ai-feature-contract.json` | `schemas/ai-feature-contract.schema.json` | `validate-artifacts` | Guardrails + evalSuite thresholds; tenant-scoped RAG |
| `implementation-contract.json` | `schemas/implementation-contract.schema.json` | same | Traces to FEAT-IDs |
| `test-strategy-contract.json` | `schemas/test-strategy-contract.schema.json` | same | Citation + numeric evals |
| `observability-contract.json` | `schemas/observability-contract.schema.json` | same | Cost + quality SLOs |
| `pipeline-contract.json` | `schemas/pipeline-contract.schema.json` | same | Eval job in CI |
| `release-contract.json` | `schemas/release-contract.schema.json` | same | Internal GA |
| `documentation-contract.json` | `schemas/documentation-contract.schema.json` | same | AI limitation copy |

Planning chain lock (TECH_STACK_RESOLUTION Q8): **entity → workflow → api**. Do not design OpenAPI before those contracts are signed.

## 4. Schema gotchas

- `discovery-brief` persona `type` enum is `buyer | user | admin | partner` — **no `champion`**. Encode champion as a user persona in JSON; keep champion language in markdown.
- `discovery-brief` and `spec-contract` both require `signedOff` (boolean). **Leave `false` until a human approves.** Do not set `signedOffAt` until true.
- `spec-contract` `additionalProperties: false` on epics. Extra keys fail validate:spec.
- `entity-contract` `entityClass` enum includes `AiAgent`, `ExternalApi`, `PlatformData` — use them for AgentRun, vendor connectors, and the citation index. `signedOff` is optional in schema but **required by the workflow gate**.
- `ux-flow-contract` requires **`usabilityCriteria` minItems: 5**.
- `product-evaluation-report` `evaluationMode` is `brownfield | release-candidate | post-implementation` — **no greenfield**.
- `ai-feature-contract` guardrail `type` enum is only `input | output | tool | tenant | pii`. Encode MNPI / wall-cross as `tenant` or `input` rules, not a custom type.
- Eval suite `threshold` is **0–1**, not milliseconds. Name metrics explicitly (`cite_prec`, `num_exact`); do not overload `p95_ms` as a 0–1 score.
- `dependency-audit` `ecosystem` should be **`multi`** for JS + Python.
- `observability-contract` requires `layers`, `telemetry`, `slos`, and `costBudget`.
- `release-contract` requires `rollbackPlan`.
- Default stack is locked: **JS frontend+backend, Python for data/ML, PostgreSQL, AWS-first multi-cloud**. Change only via Tech Stack Council + `TECH_STACK_RESOLUTION.md` in the **app** repo.

## 5. Recommended repo layout

**Do not implement the app inside Magpii-Skill-harness.** This repo is the skill pack. After sign-off:

```text
workspace/
├── Magpii-Skill-harness/          # this repo (skills, schemas)
├── Inception_Product/             # spec pack (already nested here as a scaffold)
└── mandate-app/                  # NEW — Node/Python app
    ├── product/
    │   ├── spec-contract.json     # signed copy
    │   ├── discovery-brief.json
    │   └── TECH_STACK_RESOLUTION.md
    ├── apps/web                   # JS UI
    ├── apps/api                   # JS API-first
    ├── services/research          # Python ingest, embed, agents
    └── docs/
```

Install harness into the app: `npm run install:cursor -- --project=/path/to/mandate-app`.

Until that repo exists, keep inception artifacts in `Inception_Product/products/mandate/` (this folder).

## 6. What Magpii does not cover (build as first-class product work)

The harness has no skill for:

| Gap | Why it matters | Where to park it |
|---|---|---|
| Licensed market-data connectors (FactSet, CapIQ, PitchBook, LSEG) | Rogo’s “trusted data” is a **vendor contract**, not an LLM | `ExternalApi` entities + workflow integrations; never scrape |
| Excel/PowerPoint fidelity | Bankers reject “pretty markdown” | Python (`openpyxl`, `python-pptx`) behind API; eval on formula/citation |
| SEC / EDGAR + transcript ingest | Public corpus for research | Python ingest workers; cite filing accession + span |
| Numeric / accounting eval harness | Hallucinated EBITDA is a deal-killer | Extend `test-strategist` + `ai-feature-engineer` evalSuite |
| MNPI / wall-cross / need-to-know | Advisory firms still handle confidential rooms | Productize as mandate ACL + `security-architect` threat model |
| House-style templates | Rogo differentiator is firm templates | Template entity + FEAT-005; not a new skill |
| Model-risk documentation | Internal use still needs “what the model must not do” | `documentation-contract` + AI disclosures |

## 7. Session logging and CI

On every Magpii workflow step:

```bash
node scripts/ensure-harness-current.mjs --quiet
node scripts/ensure-log-sync.mjs --quiet
node scripts/session-log.mjs start --workflow=inception_pipeline --agent=product-discovery
# end when the step finishes:
# node scripts/session-log.mjs end --session=$SESSION --status=completed --verdict=GO
```

After skill/schema edits: `npm run harness-check`. After this product pack: validate spec + discovery brief only (do not fail harness-check on unsigned `signedOff: false`).

## 8. Immediate next Magpii invocations (after sign-off)

1. Copy signed contracts into `mandate-app/product/`
2. `lead-architect` tech stack council (confirm JS/Python/Postgres/AWS; Python for ingest+agents)
3. `ux-flow-designer` — journeys in discovery handoff
4. `entity-architect` — nouns in discovery handoff
5. `workflow-architect` — ingest/index/run/review/export
6. `data-architect` + `security-architect` in parallel (vector tenancy, MNPI)
7. `api-architect` OpenAPI 3.1 (**required**; not a numbered lifecycle step)
8. `test-strategist` then `feature-implementer` then **`ai-feature-engineer` (mandatory)**
