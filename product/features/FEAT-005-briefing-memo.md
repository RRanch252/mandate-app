# FEAT-005 — Briefing memo generate and approve-to-export

| Field | Value |
|---|---|
| **ID** | FEAT-005 |
| **Epic** | EPIC-002 |
| **Phase** | MVP |
| **Priority** | P0 |
| **Status** | draft |

## Summary

An analyst generates a house-template Word briefing from the evidence table and cited Q&A. A lead or partner must approve before DOCX download. The file carries AI-assisted disclosure and a citation appendix.

## Requirements

See `spec-contract.json` FEAT-005.

## Acceptance criteria

See `spec-contract.json` FEAT-005.

## Non-functional

| Category | Requirement |
|---|---|
| Security | Export blocked without lead/partner role |
| Tenancy | Memo stored on the mandate; no other mandate can read it |
| Performance | Preview stored; generation may be async |
