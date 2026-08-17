# FEAT-009 — Deal blotter and paper from agreed commercials

| Field | Value |
|---|---|
| **ID** | FEAT-009 |
| **Epic** | EPIC-006 |
| **Phase** | post-MVP |
| **Priority** | P0 |
| **Status** | signed |

## Summary

One Deal per Mandate, auto-created as an empty sell-side template. Commercial points carry seller/buyer/agreed wording. The term sheet and counsel pack are generated server-side from agreed points only. Blocking points that are still live make `canIssueTermSheet` false. Close checkpoints are a process list, not a second negotiation.

## Acceptance criteria

- Creating or first-opening a mandate yields a deal with the ten default sell-side points and the eight close checkpoints.
- `POST .../deal/sample { sample: "cedar" }` replaces the deal with Project Cedar (Brennan Precision / Helix, day 8 of 42).
- Marking a point `agreed` with empty `agreed_text` is refused.
- Paper lists live points as do-not-paper and omits their numbers from the term sheet.
- `canIssueTermSheet` is false while any `blocks_term_sheet` point is live.
- Membership still isolates: a non-member gets 404 on `/deal`.
- Cited Q&A, ingest, evidence table, and memo approval are unchanged.

## Non-functional

| Category | Requirement |
|---|---|
| Tenancy | `firm_id` and `mandate_id` on Deal, CommercialPoint, CloseCheckpoint |
| Security | `requireMandate` on every deal route; identity remains the local user picker |
| Scope | No SPA file, no VDR, no origination |
