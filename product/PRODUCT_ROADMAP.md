# Product Roadmap

## Document meta

| Field | Value |
|---|---|
| **Platform** | Mandate |
| **Horizon** | mvp |
| **Last updated** | 2026-08-17 |
| **Owner** | INVRT product (draft) |
| **Spec contract version** | 0.1.0 |

---

## Roadmap summary

| Phase | Theme | Timebox (indicative) | Learning goal |
|---|---|---|---|
| MVP | Cited target briefing | capability slice, not a calendar promise | Will INVRT prefer Mandate to ChatGPT+Word on a mandate-shaped corpus? |
| v1 | Institutional artifacts + one licensed data seam | after MVP learning | Do we need slides and fundamentals to call it real work product? |
| v2 | Deal room depth | after v1 | Does mandate memory compound without breaking walls? |
| Future | Optional walled firm knowledge; more connectors | TBD | Chinese-wall firm memory vs mandate-only forever |

---

## Phase detail

### MVP

**Core job (one sentence):** Produce a cited target briefing (evidence table + Word memo) from an mandate corpus.

**Capabilities in scope:**

| Capability ID | Title | Epic | Priority |
|---|---|---|---|
| FEAT-001 | Mandate workspace and membership ACL | EPIC-003 | P0 |
| FEAT-002 | Document ingest and citation index | EPIC-001 | P0 |
| FEAT-003 | Cited question answering | EPIC-001 | P0 |
| FEAT-004 | Evidence table | EPIC-001 | P0 |
| FEAT-005 | Briefing memo generate and approve-to-export | EPIC-002 | P0 |
| FEAT-006 | Diligence question list | EPIC-004 | P0 |
| FEAT-007 | Audit log and export pack | EPIC-005 | P0 |
| FEAT-008 | No-train, injection, and limitation disclosure | EPIC-005 | P0 |

**Anti-goals (explicitly out of MVP):**

- Licensed FactSet/CapIQ/PitchBook
- PowerPoint pitchbooks and DCF/LBO model engines
- Email-delegated agents
- Native VDR vendor integrations
- Fine-tuned finance foundation models
- Commercial billing

**Enterprise readiness floor:**

- [x] RBAC with admin role — IN_MVP
- [x] Audit log export — IN_MVP
- [x] Mandate isolation — IN_MVP
- [x] Encryption + no-train posture — IN_MVP
- [ ] SSO / OIDC — **open** (research agents recommend IN_MVP; boutique may use one IdP)
- [ ] SCIM — DEFERRED

**Success metrics:**

| Metric | Baseline | MVP target | How measured |
|---|---|---|---|
| Time to cited memo | unknown / many hours | &lt; 90 min on 50 docs | pilot |
| Citation coverage | n/a | ≥ 95% | eval suite |
| Cross-mandate leak | n/a | 0 | ACL tests |

**Learning goals:**

1. Does a partner accept a Mandate memo as a starting draft on a real-shaped corpus?
2. Is the evidence table the primary surface, or do users live in chat?
3. Can we ship without a paid fundamentals feed?

---

### v1

**Theme:** House-style slides + one licensed fundamentals connector + Excel table fidelity.

**Capabilities:** FEAT-009 PPT outline from briefing; FEAT-010 licensed fundamentals pull into comps skeleton; FEAT-011 SharePoint/Drive sync.

**Learning goals:** Confirm whether artifacts without slides still stall adoption.

---

### v2 and beyond

**Theme:** Deal-room depth — larger corpora, VDR connector, scheduled “what changed”, optional walled firm memory.

**Open bets:**

| Bet | Risk | Validation plan |
|---|---|---|
| pgvector holds | M | data-architect spike |
| Fine-tune needed | H | only after eval plateau |
| VDR partnership vs upload | M | one live room test |

---

## Epic map

| Epic ID | Title | Problem (one line) | MVP features | Later features |
|---|---|---|---|---|
| EPIC-001 | Cited interrogation | Cannot trust answers without sources | FEAT-002, 003, 004 | larger corpus, web+news |
| EPIC-002 | Work product | Chat is not a client artifact | FEAT-005 | PPT, richer Excel |
| EPIC-003 | Mandate boundary | Generic tools mix clients | FEAT-001 | SSO, SCIM |
| EPIC-004 | Encoded workflows | Blank chat is not INVRT process | FEAT-006 | comps, transcripts |
| EPIC-005 | Governance | Leakage and unaudited AI | FEAT-007, 008 | SOC2 programme |

---

## Dependencies and constraints

| Dependency | Type | Impact on roadmap |
|---|---|---|
| Sibling application repo | delivery | Implementation cannot live in the skill-harness repo |
| LLM provider no-train contract | legal | Blocks production |
| House Word template | product | Blocks memo export quality |
| Magpii sign-off | process | `signedOff: true` required before lifecycle pipeline |

---

## Gate checklist

- [x] MVP defines one end-to-end core job
- [x] Every MVP capability maps to a feature ID
- [x] Anti-goals documented
- [x] Learning goals are falsifiable
- [x] Phase names match spec-contract roadmap
- [x] Enterprise floor items marked DEFERRED or IN SCOPE
