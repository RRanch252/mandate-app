# Mandate — INVRT internal research workbench

Greenfield inception pack for an **original internal** finance-research and work-product platform. Public capabilities of [Rogo](https://rogo.com/product) set the quality bar. This is **not** a clone, a scrape of paid data, or a commercial Rogo substitute.

| Item | Value |
|---|---|
| **Platform** | Mandate (working name; domain object is also Mandate) |
| **Owner** | INVRT (internal) |
| **Segment** | Vertical — boutique strategic advisory / M&A / fundraising |
| **Harness phase** | Inception (`product-discovery` → `spec-analyst`) — **not signed off** |
| **Delivery repo** | Not created yet. Next: sibling application repo + Magpii SaaS lifecycle |

## What this folder is

Magpii Skill Harness is the **delivery system**. `Inception_Product` is the **spec system**. Mandate artifacts live here until a sibling app repo exists.

```text
Inception_Product/products/mandate/     ← you are here (inception)
future sibling app repo/                 ← implementation (not in this PR)
  product/   (copies of signed contracts)
  docs/TECH_STACK_RESOLUTION.md
  src/
```

## Read in this order

0. **New to Cursor/GitHub?** [`BEGINNER_GUIDE.md`](./BEGINNER_GUIDE.md)
1. [`RESEARCH.md`](./RESEARCH.md) — public capability map, competitors, architecture, build-vs-buy
2. [`HARNESS_EXECUTION_PLAN.md`](./HARNESS_EXECUTION_PLAN.md) — exact Magpii skills, artifacts, gates, gaps
3. [`DISCOVERY_BRIEF.md`](./DISCOVERY_BRIEF.md) + [`discovery-brief.json`](./discovery-brief.json)
4. [`PLATFORM_VISION.md`](./PLATFORM_VISION.md) + [`PRODUCT_ROADMAP.md`](./PRODUCT_ROADMAP.md)
5. [`spec-contract.json`](./spec-contract.json) — **`signedOff: false`** until stakeholder approval

## Validation

```bash
# From Magpii-Skill-harness root
node scripts/validate-artifacts.mjs --file=Inception_Product/products/mandate/discovery-brief.json --schema=discovery-brief.schema.json

# From Inception_Product
npm run validate:spec -- --file=products/mandate/spec-contract.json
```

## Gate

Do **not** run `saas-lifecycle-pipeline` or set `signedOff: true` until the owner approves vision, MVP anti-goals, and the hybrid (build orchestration, license data) posture.
