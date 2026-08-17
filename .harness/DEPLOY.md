# .harness — deployment policy

**Do not deploy** the `.harness/` folder, `HARNESS.md`, or `.github/copilot-instructions.md` to production/staging artifacts.

These files are for **local AI co-pilot / IDE harness context** only.

| File | Deploy? | Commit to git? |
|---|---|---|
| `project.json` | No | Yes (team project context — no absolute homes) |
| `instructions.md` | No | Yes (optional team instructions — no absolute homes) |
| `harness-local.md` | No | No (generated locally; may contain this machine's harness home) |
| `INSTRUCTIONS.md` (legacy) | No | No (old generated name — superseded by harness-local.md) |
| `harness-link.json` | No | No (generated locally) |
| `../HARNESS.md` | No | No |
| `../.magpii/` | No | No |
| IDE `skill-harness` merge blobs / skill junctions | No | No |

**Multi-developer:** the installer writes **repo-relative** skill junctions into IDE merge rules. Absolute harness homes stay in gitignored local files only.

The installer adds `.harness/` to `.dockerignore`, `.vercelignore`, and similar deploy ignore files.
