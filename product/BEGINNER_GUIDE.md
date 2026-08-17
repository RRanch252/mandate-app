# Mandate — simple start guide (new to Cursor and GitHub)

You will make a **new GitHub project** and a **new Cursor chat**.  
Do **not** keep building inside `Magpii-Skill-harness`. That folder is the instruction manual. Mandate is a separate app.

**Goal:** a local app you can open in a browser, upload PDFs, get cited answers, and export a Word briefing.

---

## Step 1 — Create a new GitHub repo

1. Open [https://github.com/new](https://github.com/new)
2. Fill in:

| Field | What to enter |
|---|---|
| Owner | your user or `martin-hibernia` |
| Repository name | `mandate-app` |
| Visibility | **Private** |
| Add a README | **tick this** |

3. Click **Create repository**
4. Copy the repo URL (green **Code** button → HTTPS). It looks like:

```text
https://github.com/YOUR-NAME/mandate-app.git
```

---

## Step 2 — Open that repo in Cursor

1. Open the **Cursor** app on your computer (not this Cloud Agent chat)
2. **File → Clone Git Repository…** (or the Command Palette: `Cmd+Shift+P` / `Ctrl+Shift+P`, type `clone`)
3. Paste your `mandate-app` URL and choose a folder such as `Documents`
4. When asked, **Open** the cloned folder

You should see `README.md` in the left file list.

---

## Step 3 — Also get Magpii on your computer (one time)

Magpii is the skill pack. Mandate needs it next door.

In Cursor, open the **Terminal** (`` Ctrl+` `` or **View → Terminal**) and paste:

```bash
cd ..
git clone https://github.com/martin-hibernia/Magpii-Skill-harness.git
cd Magpii-Skill-harness
git checkout cursor/internal-finance-ai-inception-6536
cd ../mandate-app
```

If `git checkout` says the branch does not exist, the PR was merged — skip that line and stay on `main`.

Your folders should look like:

```text
Documents/
  Magpii-Skill-harness/
  mandate-app/          ← Cursor is open here
```

---

## Step 4 — Copy the product spec into Mandate

Still in the Cursor terminal, with `mandate-app` as the folder, paste:

```bash
mkdir -p product
cp -R ../Magpii-Skill-harness/Inception_Product/products/mandate/. product/
ls product
```

You should see `README.md`, `RESEARCH.md`, `spec-contract.json`.

---

## Step 5 — Attach Magpii to this project

Paste:

```bash
cd ../Magpii-Skill-harness
npm run install:cursor -- --project=../mandate-app
cd ../mandate-app
```

If `npm` is missing, install Node from [https://nodejs.org](https://nodejs.org) (LTS), then run the command again.

---

## Step 6 — Start a **new** Cursor Agent chat

1. In Cursor, click **Agent** (chat panel)
2. Click **New chat** — do not reuse the Magpii-harness cloud chat
3. At the top of the chat, click the **model** name and pick **Claude Opus**  
   If you do not see Opus, pick **Claude Sonnet**
4. Paste **Prompt A** below and send

---

## Prompt A — paste this (build the app)

```text
You are building Mandate, INVRT’s internal research app.

Read product/README.md, product/HARNESS_EXECUTION_PLAN.md, and product/spec-contract.json.

I am the owner and I am signing off the MVP in this chat: cited briefing pack only.

Do this in order:
1. Install / follow Magpii skills if they are in this project.
2. Write product/entity-contract.json and product/workflow-contract.json for the MVP only.
3. Build a runnable local app I can use today:
   - Create a mandate
   - Upload PDF / DOCX
   - Ask questions and show clickable citations
   - Fill an evidence table
   - Draft a Word memo that I must approve before download
4. Stack: JavaScript for the website and API, Python for document ingest and Word export, PostgreSQL.
5. Do not scrape paid data. Do not add billing. Do not add email agents. Do not add PowerPoint.
6. If a fact is not in the documents, say so. Do not invent numbers.
7. When it runs, give me exact commands to start it and the browser URL.

I am new to GitHub and Cursor. Use simple commands. Commit to this repo as you go.
```

---

## Prompt B — paste this later (check the work)

Open a **second** new chat. Change the model to **Codex** (or GPT if you do not see Codex). Paste:

```text
Run a code review of the Mandate app as if you did not write it.

Focus on: can another client’s files leak, can the app invent numbers, can someone export without approval, and can I actually run it locally.

List the top 10 problems, most serious first, and fix only the blockers.
```

---

## Step 7 — Run it when Cursor says it is ready

The Agent should print commands. They will look like this (use **its** version if it differs):

```bash
cp .env.example .env
# put your AI API key in .env where it tells you
docker compose up -d
npm install
npm run dev
```

Then open the URL it gives you (often `http://localhost:3000`).

Upload one real CIM or a public 10-K. If citations work, you are using Mandate.

---

## What not to do

- Do not add Mandate code into `Magpii-Skill-harness`
- Do not keep going in the old Cloud Agent chat on the harness repo
- Do not pick the same chat to both build and review

---

## If something fails

| What you see | What to do |
|---|---|
| `command not found: git` | Install Git, restart Cursor |
| `command not found: npm` | Install Node LTS from nodejs.org |
| `checkout` branch missing | Skip checkout; Magpii `main` may already include `products/mandate` |
| Agent asks for an API key | Create one at your AI provider, paste into `.env` as instructed — never commit `.env` |
| Port already in use | Tell the Agent “port 3000 is busy — use another port” |
