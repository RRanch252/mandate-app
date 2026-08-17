# DISCOVERY BRIEF — Mandate

### Meta
- Product context: greenfield
- Segment: vertical (boutique strategic advisory)
- Confidence: M
- Discovery mode: full
- signedOff: false (awaiting INVRT owner)

### Problem Summary

Analysts and mandate leads at boutique advisory firms (INVRT) struggle to turn a pile of CIMs, filings, notes, and data-room files into a briefing a partner can defend, because search is fragmented across Drive, PDFs, and generic chat tools with no citations or deal isolation. That results in slow time-to-insight, uncited claims, and leakage risk. Today they Ctrl-F, paste into ChatGPT, and rebuild memos by hand at a cost of many hours per mandate plus reputational risk.

### Persona Registry
| Persona | Type | Primary Job | Success Metric |
|---------|------|-------------|----------------|
| Managing Partner | buyer | Approve client-ready advice without leaks | Time-to-cited-briefing; zero cross-client retrieval |
| Mandate lead | user | Shared facts for the mandate | Briefing ready before next client call |
| Analyst | user | Interrogate corpus and draft materials | Hours dump → cited memo |
| Operator | admin | Access, retention, audit | Audit export &lt; 5 min |

### Assumption Map
| Assumption | Category | Risk | Evidence | Status |
|------------|----------|------|----------|--------|
| Uncited chat is unusable for client work | desirability | 5 | [S] category (Rogo/Hebbia cites) | pending |
| First pain is briefing/diligence not LBO models | desirability | 4 | [A] INVRT service mix | pending |
| Uploads + EDGAR suffice for MVP | feasibility | 3 | [A] | pending |
| Mandate ACL is the tenancy boundary | feasibility | 5 | [O] Deal Room / MNPI practice | pending |
| Boutique will not buy Rogo | viability | 3 | [A] ICP mismatch | pending |

### Hypothesis Results
- **H-1** Cited briefing: We believe an analyst will complete a first cited memo in &lt; 90 minutes on a 50-document corpus if citations are clickable. Experiment: concierge test on one sanitized mandate. Falsifier: still prefers ChatGPT+Word. Status: pending.
- **H-2** Table over chat: We believe leads will start from the evidence table, not the chat transcript. Falsifier: table unused in 5 sessions. Status: pending.
- **H-3** No FactSet in MVP: We believe a useful briefing is possible without licensed fundamentals. Falsifier: partner blocks export for missing comps. Status: pending.

### MVP Scope
**Core job**: Produce a cited target briefing (evidence table + Word memo) from an mandate corpus.  
**In scope**: ingest, cited Q&A, evidence table, memo+export, diligence Q list, RBAC, audit, no-train.  
**Anti-goals**: Bloomberg clone; scraping paid data; IB agent marketplace; email agents; PPT/DCF engines; fine-tunes; commercial SaaS.  
**Enterprise floor**: mandate ACL, MFA, audit export, encryption, retention. SSO DEFERRED.

### Phase Map
| Phase | Capability slice | Learning goal |
|-------|------------------|---------------|
| MVP | Cited briefing W1–W5 | Will INVRT use this instead of ChatGPT on a live-shaped mandate? |
| v1.1 | House PPT + one licensed fundamentals connector | Do artifacts need slides/comps to be “real work”? |
| v2 | VDR + scheduled runs + optional walled firm memory | Does deal memory compound without leaking? |

### Downstream Handoff
See `RESEARCH.md` Magpii handoff notes and `HARNESS_EXECUTION_PLAN.md`.

### Open Decisions
- Problem: live client vs sanitized replay for H-1
- Persona: admin vs buyer overlap in a founder-led firm
- Scope: product name Mandate
- Monetisation: none (internal)
