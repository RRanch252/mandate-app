# Platform Vision

## Document meta

| Field | Value |
|---|---|
| **Platform** | Mandate |
| **Author** | Magpii inception (draft for INVRT) |
| **Last updated** | 2026-08-17 |
| **Status** | draft |
| **Linked contract** | `spec-contract.json` version 0.1.0 |

---

## Vision statement

Boutique advisors at INVRT will walk into every client conversation with a cited, mandate-scoped briefing — table, memo, and sources — because Mandate turns the mandate’s documents into defensible work product. They will replace Ctrl-F, generic chat, and uncited paste-ups with a workspace where every claim is clickable, every export is reviewed, and no other client’s files are in the room.

---

## Strategic context

### Market segment

- **Primary segment**: Vertical — boutique strategic advisory, M&A support, fundraising, family-office / growth-company work (INVRT internal)
- **Geography**: Firm-operated; data residency in a single AWS region until decided
- **Buyer profile**: Managing Partner (economic and risk owner)
- **User profile**: Analyst and mandate lead

### Problem landscape

| Pain | Who feels it | Cost today | Why incumbents fail |
|---|---|---|---|
| Uncited synthesis | Analyst, partner | Hours + reputational risk | ChatGPT has no deal ACL or span cites |
| Fragmented corpus | Lead | Missed facts in the CIM/room | Drive search is not a briefing |
| Enterprise AI platforms | Buyer | Seat cost, IB-shaped workflows | Rogo/Hebbia optimised for banks/PE platforms |
| Leakage anxiety | Buyer, admin | Existential for a trust business | Consumer tools train or mix contexts |

### Competitive alternatives

- **Status quo**: Google Drive + Word + ChatGPT/Copilot
- **Direct (quality bar, not clone)**: Rogo, Hebbia, AlphaSense
- **Build vs buy**: Hybrid — build orchestration on Magpii; license data later; do not scrape; do not buy an IB agent cloud as system of record

---

## North-star outcomes

| Outcome | Metric | Target | Measurement method |
|---|---|---|---|
| Faster defensible briefing | Time dump → partner-ready memo | &lt; 90 minutes on a 50-doc corpus | Pilot stopwatch |
| Trust | Citation coverage on factual sentences | ≥ 95% | Eval suite + spot check |
| Safety | Cross-mandate retrieval incidents | 0 | Automated ACL tests |
| Adoption | Mandates using Mandate for the briefing | 1 pilot then majority of active mandates | Mandate flag |

---

## Principles

1. **Workflow completeness** — MVP completes ingest → cited table → memo export.
2. **Mandate-aware by default** — retrieval never crosses membership.
3. **Cite or refuse** — no decorative sources.
4. **Human on the way out** — export requires approval.
5. **Original product** — public Rogo capabilities are a bar, not a spec to copy.

---

## Anti-vision (what we are not building)

- Not a Bloomberg terminal or market-data vendor
- Not a commercial clone of Rogo’s agent library
- Not unsupervised email agents
- Not a general knowledge chatbot for the public internet as the product

---

## Alignment checklist

- [x] Vision names a specific segment
- [x] Outcome is customer-observable
- [x] At least one north-star metric is quantified
- [x] Anti-vision lists ≥2 explicit exclusions
- [x] Mission complements vision

---

## Downstream links

| Artifact | Path |
|---|---|
| Mission | below |
| Roadmap | `PRODUCT_ROADMAP.md` |
| Spec contract | `spec-contract.json` |
| Research | `RESEARCH.md` |

### Mission (companion statement)

Give INVRT analysts and leads one mandate-scoped workspace to ingest client and public documents, interrogate them with citations, fill an evidence table, and export a reviewed Word briefing — so partners spend time on judgment, not document archaeology.
