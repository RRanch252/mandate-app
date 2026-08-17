# Mandate research brief

Internal, original product. Public Rogo/Hebbia/AlphaSense materials define the **quality bar**, not the implementation. Evidence tags: **[O]** observed in public sources, **[S]** vendor-stated, **[A]** assumed for INVRT.

**Sources (public):** [rogo.com/product](https://rogo.com/product), [rogo.ai](https://rogo.ai/), [Rogo Agent Library](https://rogo.ai/news/agent-library), [Rogo Deal Room](https://rogo.ai/news/deal-room), [Rivanna acquisition](https://rogo.ai/news/rivanna), [Kleiner Perkins Series D note](https://www.kleinerperkins.com/perspectives/rogo-the-ai-platform-for-global-finance/), [OpenAI × Rogo](https://openai.com/index/rogo/), [OpenAI × Hebbia](https://openai.com/index/hebbia/), Hebbia/AlphaSense category pages, [INVRT](https://www.invrt.co/).

---

## Executive summary

Rogo is an enterprise AI platform for investment banks and PE: agents run **end-to-end finance workflows** and return **auditable Excel, Word, and PowerPoint** with citations, over **firm data + licensed market data**, under SOC2/ISO27001/GDPR and optional single-tenant deploy. **[O]**

INVRT is not a bulge-bracket bank. It is a boutique strategic advisory that does **target evaluation, M&A/fundraising support, diligence, and long-horizon quality work** for founders, family businesses, and growth companies. **[O]** An internal “Rogo” that tries to encode hundreds of IB agents (DCF/LBO/PIB libraries, email-delegated juniors, VDR partnerships) is the wrong product. The winning internal version is a **cited research and work-product workbench** that:

1. Completes one core job end-to-end: **interrogate a mandate’s documents and produce a defensible briefing (evidence table + memo)**.
2. Beats generic ChatGPT by **permissions, citations, audit, house templates, and deal memory**.
3. Uses Magpii for gated delivery; **licenses** data instead of scraping; keeps Python for ingest/agents and JS for API/UI.

**Build-vs-buy:** Do **not** buy Rogo as the system of record for a boutique (enterprise sales motion, seat economics, IB-shaped agent library). Do **not** rebuild Bloomberg/AlphaSense content. **Hybrid:** build Mandate orchestration on Magpii; ingest what INVRT already owns; add one licensed public-filing/news path in v1; add FactSet/CapIQ/PitchBook only when a live mandate cannot complete without them.

---

## Public capability map (quality bar)

### What Rogo sells (do not copy IP; match the job)

| Capability | Public description | Internal implication |
|---|---|---|
| Integrated content | Firm files + CRM/SharePoint + vendors (LSEG, DJ, FactSet, CapIQ, PitchBook, Preqin, SEC, transcripts, Quartr, Daloopa, web/news) **[O]** | Connectors are **contracts + APIs**. MVP = upload + folder ingest. |
| Transparent sources | Auditable citations **[S]** | Citation graph is a product entity, not a footnote afterthought. |
| Workflow automation | Firm-specific workflows; prompt library; agents chained/scheduled **[O]** | Encode INVRT’s 5 workflows; do not ship a 400-agent marketplace. |
| AI table interface | Sort/filter/update structured analysis **[O]** | Closest analogue: Hebbia Matrix (docs × questions, cell-level cites) **[S]**. |
| Material creation | Reports, summaries, presentations **[O]** | Word memo first; PPT/Excel in v1.1 when templates exist. |
| Custom models | Finance-tuned LLMs on labeled data **[S]** | MVP: frontier models + RAG + tools. Fine-tune only after eval plateau. |
| Governance | RBAC, audit, no training on customer data, single-tenant **[O]** | No-train + mandate ACL are MVP floor for client work. |
| Agent library | IB: DCF/LBO, comps, precedents, CIM, PIBs. PE: QoE, TAM, value-creation. Credit, ER, etc. Built by 75+ practitioners; 430k+ shared-library runs **[S]** | Library **quality process** (practitioner encode → live-company test → peer review) is the bar. Content of their agents is not ours. |
| Felix | Email-delegate like a junior analyst **[S]** | Defer. High prompt-injection and MNPI risk. |
| Deal Room + Rivanna | Governed home for a deal; ingest whole VDRs; query tens of thousands of files with fine cites; flag risks; team-shared facts **[O]** | Engagement workspace + ingest + Q&A is **MVP-shaped**. Native VDR vendor partnerships are v2. |

OpenAI case study (Rogo): GPT-4o for chat/analysis, smaller models for structure/search, reasoning models for evals/synthetic data; 50M+ documents claimed; diligence Q-lists and writing assist. **[S]** Treat as architecture hints, not a mandate to fine-tune.

### What “best-in-class” actually means

Bankers and advisors do not adopt chat. They adopt tools that get them **~80% of a familiar artifact** with **sources they can click**, in **house format**, without leaking the room. Baird: ~10k workflows/week, “85% of the way there,” hours saved for power users — **[S]** marketing, but the adoption pattern is real: **workflow-shaped agents + Excel/PPT, not a chatbot**.

---

## Competitive landscape

| Product | Center of gravity | Beat it internally by… | Do not try to beat |
|---|---|---|---|
| **Rogo** | Encoded IB/PE **workflows** → Office artifacts; white-glove; licensed data | Firm-specific INVRT process, cheaper, data stays in our VPC | 75-person agent factory, 300 institutions, Felix, VDR partnerships |
| **Hebbia Matrix** | Docs × questions grid, sentence-level cites, multi-agent over huge rooms | Smaller corpus, faster time-to-first-cite, INVRT memo templates | “Billions of documents” and ISD branding |
| **AlphaSense** | Licensed **broker research + expert calls** | We will never own that corpus | Content library |
| **Bloomberg AskB** | NL on Terminal data | N/A — keep Terminal/FactSet if already paid | Real-time pricing, IB chat |
| **ChatGPT Enterprise / Copilot** | General reasoning, weak finance audit | Citations, deal ACL, evals, Office artifacts | Raw model quality (use the same models underneath) |
| **Palantir** | Ontology + ops | Overkill for boutique advisory | Enterprise ontology programs |

Category split **[O/S]**: Terminal = numbers; AlphaSense = qualitative content; Hebbia = document synthesis; Rogo = workflow execution + artifacts. Mandate should sit on **Hebbia-like interrogation + Rogo-like artifacts**, scoped to INVRT mandates.

---

## Ranked requirements

### Must-have for advisors to trust output

1. Span-level (or at least page/section) **citations** on every factual claim
2. **Human review** before anything leaves the building (email, client PDF, data room)
3. Numbers in tables **trace to a cell or filing line**, or are marked `unverified`
4. **Engagement isolation** (client A cannot retrieve client B)
5. Export to **Word** (memo) with citation appendix; table export to **CSV/XLSX**
6. Honest empty states: “not in corpus” ≠ hallucinated answer

### Must-have for internal IT / risk

1. Contractual **no training on INVRT or client data**
2. Immutable **audit** of prompt, retrieval IDs, model version, actor, cost
3. SSO later; **RBAC + MFA** now
4. Encryption in transit/at rest; secrets not in prompts
5. Prompt-injection defense on uploaded documents (tool allowlist)
6. Retention / deletion per engagement (client offboarding)

### Differentiators an internal build can actually win

- INVRT **philosophy and memo structure** (quality/systems/compounding) encoded once
- **Engagement memory** that compounds across a mandate (Rogo Deal Room idea, our data)
- No vendor lock-in on the orchestration layer (Magpii contracts)
- Seat economics of a 5–20 person firm vs enterprise AI platforms
- Data residency we control (AWS account, not a multi-tenant SaaS)

### Anti-goals (explicit)

- Not a Bloomberg / CapIQ / PitchBook replacement
- Not scraping paid research or logins
- Not a general chatbot with a finance system prompt
- Not hundreds of IB agents in v1
- Not email-driven unsupervised agents
- Not custom foundation-model training
- Not a commercial SaaS to sell as “Rogo for SMBs” in this inception
- Not replacing partner judgment or signing fairness opinions

---

## Workflow library

### MVP five (one core job)

Core job: **From a mandate document set, produce a cited company/target briefing an INVRT partner can defend.**

| ID | Workflow | Trigger | Inputs | Tools | Output | HITL |
|---|---|---|---|---|---|---|
| W1 | **Corpus ingest** | New mandate / new files | PDF, DOCX, XLSX, PPTX, HTML | Parse, OCR fallback, chunk, embed, ACL stamp | Indexed corpus + ingest report | Owner confirms sensitive flag |
| W2 | **Cited Q&A** | Question in a mandate | Query + corpus + optional web | Retrieve, rerank, answer-with-spans | Answer + citation cards | User can reject a cite |
| W3 | **Evidence table** | Briefing template | Row entities (topics) × column questions | Parallel retrieve per cell | Spreadsheet-like grid with cites | Analyst edits cells |
| W4 | **Company briefing memo** | “Draft memo” | Table + Q&A + house template | Compose, attach citation appendix | DOCX | Partner approve-to-export |
| W5 | **Diligence question list** | CIM or data-room dump | Documents | Gap analysis vs INVRT checklist | Structured Q list (table + DOCX) | Deal lead prioritises |

### Backlog (v1.1–v2)

W6 Public comps skeleton (licensed fundamentals only) · W7 Precedent screen (licensed deals) · W8 Earnings/transcript post-mortem · W9 Board/pitch outline → PPTX · W10 Buyer/investor list from **our** CRM + public facts · W11 Credit/covenant extract · W12 Integration-risk memo · W13 Scheduled “what changed in the corpus” · W14 SharePoint/Drive sync · W15 VDR connector · W16 Email ingest (high risk) · W17 Multi-mandate firm knowledge (opt-in, Chinese wall)

Each backlog item needs a practitioner encode → golden-company test → peer review, same as Rogo’s stated process **[S]** — without copying their agents.

---

## Architecture implications (Magpii default stack)

Locked defaults: JS UI + JS API, Python for data/ML, PostgreSQL, AWS-first, API-first, multi-cloud-ready.

```text
[Web JS] --HTTPS--> [API JS] --queue--> [Python workers]
                         |                    |
                    PostgreSQL           Vector index (pgvector first)
                    object store S3      parsers / LibreOffice
                    audit log            openpyxl / python-docx / python-pptx
```

### Bounded contexts

| Context | Owner skill | Notes |
|---|---|---|
| Identity & tenancy | entity + security | Firm = tenant; Engagement = hard ACL boundary |
| Corpus | data-architect | Document, Chunk, CitationSpan |
| Research run | workflow + AI | AgentRun, ToolCall, PromptVersion |
| Work product | domain | Memo, EvidenceTable, Export |
| Connectors | ExternalApi | SEC, later FactSet; never in the LLM prompt as raw keys |
| Governance | security | Policy, AuditEvent, RetentionJob |

### Agent pattern

Planner (JS or Python orchestrator) → tool calls (retrieve, table-fill, compose, export) → critic/citation checker → HITL. Prefer **DAG of tools** over a single 100k-token chat. Route cheap models for classify/chunk; capable models for synthesis; keep evals on a pinned model.

### Spreadsheet / deck generation (realistic)

- Tables: generate **structured JSON** then `openpyxl` (formulas only when values are verified).
- Memos: `python-docx` from INVRT template.
- PPT: `python-pptx` in v1.1; do not invent a “PowerPoint engine.”
- Parse inbound xlsx with `openpyxl` / structured extract; never dump whole workbooks into the prompt.

### Eval gates (ship blockers)

| Eval | Threshold (starting) | Failure mode |
|---|---|---|
| Citation coverage | ≥95% of factual sentences have a span | Uncited claims |
| Citation precision (human spot-check) | ≥90% spans support the claim | Decorative cites |
| “Not in corpus” honesty | ≥90% on held-out missing-fact set | Hallucinated facts |
| Numeric match | 100% on golden filing line items | Wrong EBITDA |
| Cross-engagement leak | 0 | Retrieval without ACL |
| p95 interactive Q&A | <15s excluding first ingest | Unusable chat |

### Python vs Node

- **Python:** ingest, OCR, embedding, retrieval, agent graphs, Office files, evals.
- **Node/JS:** auth, RBAC, REST, websockets for run status, web app, billing skip, session.

---

## Compliance productization

INVRT handles client confidential information even if it is not a registered broker-dealer. Productize:

| Policy | Product behaviour |
|---|---|
| Need-to-know | Engagement membership required for retrieve/generate |
| MNPI / wall | Optional `restricted` flag; no firm-wide index by default |
| No training | Provider contracts + API flags; documented in UI |
| Retention | Per-engagement delete + object-store lifecycle |
| Disclosure | “AI-assisted, human-reviewed” on exports |
| Prompt injection | Documents are untrusted; tools allowlisted; no arbitrary HTTP from the model |
| Model risk | Versioned prompts; eval suite in CI; known-limitation doc |

EU AI Act / SOC2 / ISO27001 are **Rogo’s** public badges **[O]**. Internal Mandate should track toward SOC2-like controls without pretending certification exists on day one.

---

## Build vs buy vs hybrid

| Option | Verdict |
|---|---|
| Buy Rogo | Poor fit: enterprise motion, IB library, cost, INVRT is not their ICP |
| Buy Hebbia | Better document fit; still enterprise; less Magpii control; still need house templates |
| ChatGPT Enterprise + Drive | Fastest; fails citations, ACL, artifacts, evals |
| **Build Mandate hybrid** | **Recommended:** Magpii delivery + our corpus + public filings; license data when a deal blocks |

Smallest valuable platform: **W1–W5 on one mandate**, Word+XLSX export, audit, ACL, evals. That is already a Magpii full inception + AI-mandatory lifecycle, not a weekend GPT wrapper.

---

## Personas

| Persona | Type (JSON) | Primary job | Success metric |
|---|---|---|---|
| Managing Partner (Paul / INVRT) | buyer | Trust advice quality without leaking clients | Time-to-briefing ↓; zero cross-client leaks |
| Mandate lead | user (champion in prose) | Run a mandate with shared facts | Briefing ready before the next client call |
| Analyst / associate | user | Interrogate docs and draft materials | Hours from dump → cited memo |
| Operator / IT | admin | Access, retention, vendor risk | Audit export for any run in <5 min |

Jobs-to-be-done (analyst): When a CIM and filings land, I want a cited grid and memo, so I spend partner time on judgment not Ctrl-F.

---

## MVP recommendation

**One core job:** Produce a **cited target briefing** (evidence table + Word memo) from an mandate corpus.

**Happy path:** Create mandate → upload docs → index → fill briefing template table → draft memo → partner review → export DOCX/XLSX → audit recorded.

**In scope:** W1–W5, RBAC, no-train, citations, eval CI, JS+Python+Postgres on AWS.

**Out of scope:** See anti-goals; Excel models beyond tables; PPT; vendor terminals; Felix-like email; fine-tunes.

**Enterprise floor:** Engagement ACL, audit export, MFA, encryption, retention. SSO/SAML **DEFERRED**. SCIM **DEFERRED**.

**Phases:** MVP = cited briefing. v1.1 = house PPT + one licensed fundamentals API. v2 = VDR + scheduled agents + optional firm memory with walls.

---

## Assumptions and open questions

| Item | Tag | Status |
|---|---|---|
| Advisors will not trust uncited chat for client work | S (category-wide) | pending INVRT walkthrough |
| INVRT’s first pain is diligence/briefing, not LBO models | A | pending partner interview |
| Public EDGAR + uploads beat waiting on FactSet for MVP | A | pending one live mandate test |
| Boutique will not pay Rogo enterprise | A | pending quote vs build cost |
| pgvector is enough until >10M chunks | A | spike in data-architect |
| Who is admin if the firm is founder-led? | A | default: buyer wears admin hat |

Open decisions: SSO in MVP vs deferred; comps table in MVP vs v1; which licensed vendor if any; Microsoft 365 vs Google Workspace; VDR in use; reviewer of record; EU residency; live client vs sanitized replay for the first gold set (10 public companies + 3 anonymized memos).

---

## Folded conclusions from dedicated research agents

Product landscape and Magpii mapping agents agreed on hybrid build, Magpii inception-first, AI-mandatory, billing skip, and sibling app repo. Unique additions folded here:

| Topic | Conclusion |
|---|---|
| Name | **Mandate** is the platform and the atomic domain object (permissions, walls, artifacts). Not Ledger. Not a Rogo clone. |
| Trust bar | Export **blocked** on ungrounded numbers. Excel uses **formulas + Sources sheet + Audit sheet**, not pasted values. Claims tagged `fact \| estimate \| judgment`. |
| Chunking | Section-aware (10-K items) and table-aware; **ACL at query time** (do not index-then-filter). Treat uploaded docs as hostile. |
| Eval | Gold set of 10 public tickers before expanding playbooks. Schema eval thresholds are **0–1**, not milliseconds. |
| Greenfield evaluator | Pipeline step 01 has no `greenfield` enum — use `evaluationMode: release-candidate`, empty codebase, `conditional_pass`, no blockers on spec quality. |
| `api-architect` | Required planning-chain step, **not** one of the 23 lifecycle steps — run after entity + workflow sign-off. |
| `ux-flow-contract` | `usabilityCriteria` **minItems: 5**. |
| Live artifacts | Do not keep the product as a long-term resident of this skill pack; copy signed contracts into `mandate-app/product/`. This folder is a temporary inception home. |

Blocking questions before `signedOff: true`: paid vendor (FactSet vs CapIQ vs LSEG vs none); corpus (M365 vs Google); any VDR; who is Reviewer; whether outputs are regulated “research”; private LLM at MVP or v2.

---

## Magpii handoff notes

**entity-architect — domain nouns:** Tenant, WallGroup, User, Mandate, Party, Membership, Document, Chunk, Claim, Evidence, Locator, Playbook, Run, Artifact, Review, Connector, VendorEntitlement, AgentRun, ToolCall, EvidenceTable, Memo, Export, AuditEvent, IngestJob, EvalSuiteRun.  
**Actors:** PrincipalBuyer, Champion, Analyst, Reviewer, Compliance, Admin, Runner (system), VendorAPI.  
**Lifecycle verbs:** create_mandate, resolve_party, ingest, index, ask, plan, retrieve, bind_citations, wait_for_review, approve_peers, render_artifact, evaluate, approve_artifact, export, wall_cross, revoke, meter, retain/purge.  
**Classes:** Org, Identity, Domain, PlatformData, ExternalApi, AiAgent.

**ux-flow-designer — journeys:** (1) First briefing pack, (2) Ask with cite-check, (3) Evidence table / peer-set HITL, (4) Memo review/export blocked if ungrounded, (5) Admin connect corpus + vendor keys, (6) Compliance freeze + audit export. Entry: `/mandates/:id`.

**application-architect:** JS API + Python worker pool. Bounded contexts: identity, mandate, corpus, index/RAG, vendor data, orchestration, citation graph, artifact factory, eval, audit.

**ai-feature-engineer:** RAG + tool calling + table copilot. Risk tier **high** on export. Guardrails: tenant ACL, input injection, output cite-or-refuse, tool allowlist, pii/MNPI. Eval: citation coverage, numeric exact-match, formula round-trip, ACL leak = 0, injection canaries. Schema eval thresholds are 0–1. `ragConfig.tenantScoped: true`.

**billing-subscription-engineer:** skip commercial billing; still meter tokens per run.

**security-architect:** document injection, cross-mandate RAG, export exfil, vendor subprocessors, wall groups, license redistribution tags.

**cloud-architect:** single AWS account, EU region option (INVRT Dublin), staging+prod, no public buckets.

**api-architect (required, not in the 23-step pipeline):** OpenAPI 3.1 after signed entity + workflow contracts. `POST /v1/mandates/:id/runs`.
