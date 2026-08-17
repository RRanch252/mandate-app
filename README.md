# Mandate

INVRT's internal research workbench. Upload the documents for a mandate, ask questions
and get answers with clickable citations, fill an evidence table, draft a Word
briefing memo that a lead or partner must approve before anyone can download it,
and run the six-week sell-side commercial close (blotter → agreed paper → close list).

The original MVP is the **cited briefing pack**. The Close tab is the commercial
close: INVRT owns commercials and negotiation; counsel papers the SPA.

---

## Start it

Open PowerShell in this folder (`mandate-app`).

**First time only** — this downloads PostgreSQL and sets up Python, so it takes a few
minutes:

```powershell
npm install
npm run setup
```

**Every time you want to use it:**

```powershell
npm start
```

Then open your browser at:

```
http://localhost:3000
```

To stop it, press `Ctrl+C` in the PowerShell window. The database keeps running in the
background; stop that too with `npm run db:stop` if you want.

If you already ran setup before the Close tab existed, apply the new tables:

```powershell
npm run db:migrate
```

Then restart `npm start`. Old mandates get a deal on first visit to Close.

If you stopped the database and `npm start` complains it cannot connect, run
`npm run db:start` first.

---

## Using it

1. **Pick who you are.** There is no password. Choose Paul Higgins to start.
2. **Create a mandate.** This is the workspace and the wall — nothing crosses between
   mandates. Whoever creates it becomes a partner on it, so you can approve your own
   exports while trying it out. A Deal is created at the same time (empty sell-side
   template). Existing mandates get a deal the first time you open the Close tab.
3. **Close tab (first).** This is the six-week commercial close. The blotter is the
   work. Agree wording only when it is actually agreed — the term sheet and counsel
   pack are generated from those agreed points and nothing else. Blocking points
   (headline, locked box vs completion accounts, earn-out, MD employment) prevent
   “can issue TS” until they are agreed. Press **Load Project Cedar sample** to see
   Brennan Precision / Helix on day 8 of 42.
4. **Upload documents** on the Documents tab. PDF and DOCX only. Wait for each file to
   show **Indexed**.
5. **Ask questions** on the Ask tab. Every answer carries numbered citations. Click a
   number to see the exact passage it came from and open the source PDF at that page.
   If the documents do not answer the question, Mandate says so rather than guessing.
6. **Fill the evidence table.** Rows are topics, columns are briefing questions. Press
   *Fill empty cells* and watch them fill one at a time. You can edit any cell, mark it
   unverified, or rerun it on its own. Your edit is what appears in the memo.
7. **Generate the briefing memo**, then *Send for approval*. The download stays locked
   until a lead or partner approves it. Sign in as a different person to feel the gate
   working.

---

## What it will not do

These are deliberate, not missing pieces:

- **It will not invent a number.** Every figure in an answer has to appear in the text
  that was cited to support it. Anything that fails that check is thrown away.
- **It will not answer from general knowledge.** Only the documents uploaded to the
  mandate you are looking at.
- **It will not let you download an unapproved memo.** The download route checks the
  approval state on the server, so hiding the button is not the only control.
- **It does not read spreadsheets or slides.** PDF and DOCX only for now.
- **It does not fetch any external or paid data.** Nothing is scraped.
- **Close does not write a SPA.** The Paper panel is a copyable pack from agreed
  commercials. Live points are listed as do-not-paper. There is no VDR and no
  origination / universe surface.

---

## Answer modes

Out of the box Mandate runs **extractive**: it finds the sentences in your documents
that answer the question and quotes them verbatim. This reads bluntly, but it cannot
fabricate anything, and it needs no API key or internet connection.

If you want fluent prose instead, copy `.env.example` to `.env` and set
`OPENAI_API_KEY`. Answers are still restricted to retrieved passages, every claim must
cite one, and any figure that does not appear in the cited text causes the whole
generated answer to be discarded in favour of the quoted source. The badge in the top
right tells you which mode you are in.

---

## Commands

| Command | What it does |
|---|---|
| `npm start` | Run the app on http://localhost:3000 |
| `npm run setup` | First-time setup: database, schema, seed data, Python |
| `npm run smoke` | End-to-end self test against a running app |
| `npm run db:start` / `db:stop` | Start or stop the local PostgreSQL |
| `npm run db:migrate` | Re-apply the schema |
| `npm run db:reset` | Delete all data and start over |
| `npm run db:psql` | Open a SQL prompt against the database |

---

## How it is put together

| Part | Technology | Where |
|---|---|---|
| Website | Plain HTML, CSS and JavaScript, no build step | `apps/web/` |
| API | Node and Express | `apps/api/src/` |
| Document ingest and Word export | Python (`pypdf`, `python-docx`) | `services/research/` |
| Database | PostgreSQL 16, full-text search | `db/schema.sql`, `.localdb/` |

The Node API calls the Python scripts as short-lived processes and talks to them in
JSON, so there is only one server to start.

Retrieval uses PostgreSQL's built-in full-text index rather than a vector database.
That keeps the install to a stock PostgreSQL, at the cost of weaker recall when a
question is worded very differently from the document. Chunks are stored so an
embedding column can be added later without changing the data model.

### The contracts

`product/entity-contract.json` and `product/workflow-contract.json` define the entities,
their states, who may move them, and the workflows. Both validate against the Magpii
harness schemas. The database enforces the same state sets with `CHECK` constraints, so
an invalid state fails at the database rather than in the UI. Read the `openDecisions`
in both files: they record what was deliberately left out and why.

---

## Not production ready

Two things in particular before this goes near a real client file:

- **There is no authentication.** Choosing a name from a list is not signing in.
  Membership and roles *are* enforced on every request, but identity is not proved.
  Keep this on one trusted machine until a real identity provider is wired in.
- **Background work is in-process.** If you stop the app while a document is being
  read, that document is stuck in `parsing` and needs a retry. A durable queue is the
  first thing to add before more than one person uses it at once.
