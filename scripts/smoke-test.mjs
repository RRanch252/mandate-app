#!/usr/bin/env node
// End-to-end check against a running server: create a mandate, ingest a PDF and a
// DOCX, ask an answerable and an unanswerable question, fill the evidence table,
// then prove the export gate by trying to download before and after approval.
//
// Run the app first (npm start), then: npm run smoke

import { openAsBlob } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SMOKE_BASE || 'http://localhost:3000';

const PAUL = '22222222-2222-2222-2222-222222222201';
const ALEX = '22222222-2222-2222-2222-222222222202';
const SAM = '22222222-2222-2222-2222-222222222203';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function makeClient() {
  let cookie = '';
  return async function call(pathname, options = {}) {
    const init = { ...options, headers: { ...(options.headers || {}) } };
    if (cookie) init.headers.Cookie = cookie;
    if (init.body && !(init.body instanceof FormData)) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(init.body);
    }
    const res = await fetch(`${BASE}${pathname}`, init);
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const entry of setCookie) cookie = entry.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const body = type.includes('application/json') ? await res.json() : await res.arrayBuffer();
    return { status: res.status, body, headers: res.headers };
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\nMandate smoke test against ${BASE}\n`);

  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error('The server is not responding. Start it with "npm start" in another terminal.\n');
    process.exit(1);
  }

  const pdf = path.join(repoRoot, 'fixtures', 'acme-cim.pdf');
  const docx = path.join(repoRoot, 'fixtures', 'acme-notes.docx');
  if (!existsSync(pdf) || !existsSync(docx)) {
    console.error('Fixtures are missing. Run: services/research/.venv/Scripts/python scripts/make-fixtures.py fixtures\n');
    process.exit(1);
  }

  // ---- partner session ----
  const partner = makeClient();
  await partner('/api/session', { method: 'POST', body: { userId: PAUL } });

  console.log('Mandate and ingest');
  const created = await partner('/api/mandates', {
    method: 'POST',
    body: { name: `Smoke ${Date.now()}`, clientLabel: 'Acme Industrial', restricted: false },
  });
  check('mandate created', created.status === 201, JSON.stringify(created.body).slice(0, 200));
  const mandateId = created.body.mandate.id;

  console.log('\nCommercial close');
  const dealEmpty = await partner(`/api/mandates/${mandateId}/deal`);
  check('deal auto-created', dealEmpty.status === 200, JSON.stringify(dealEmpty.body).slice(0, 200));
  check('empty template has 10 points', (dealEmpty.body.points || []).length === 10,
    `got ${(dealEmpty.body.points || []).length}`);
  check('empty template has 8 checkpoints', (dealEmpty.body.checkpoints || []).length === 8);

  const cedar = await partner(`/api/mandates/${mandateId}/deal/sample`, {
    method: 'POST', body: { sample: 'cedar' },
  });
  check('cedar sample loaded', cedar.status === 200, JSON.stringify(cedar.body?.deal?.seller || {}).slice(0, 160));
  check('cedar is day 8 of 42', cedar.body.deal?.day === 8 && cedar.body.deal?.days_total === 42,
    `${cedar.body.deal?.day}/${cedar.body.deal?.days_total}`);
  check('cedar still has 10 points', (cedar.body.points || []).length === 10);
  check('cannot issue TS while blocking points are live', cedar.body.paper?.canIssueTermSheet === false);
  check('term sheet omits live headline figure', !/€48/.test(cedar.body.paper?.termSheet || ''),
    (cedar.body.paper?.termSheet || '').slice(0, 180));
  check('live headline is listed as do-not-paper', (cedar.body.paper?.doNotPaper || []).includes('Headline price'));

  const headline = (cedar.body.points || []).find((p) => p.title === 'Headline price');
  check('cedar has a headline point', Boolean(headline));
  const refuse = await partner(`/api/mandates/${mandateId}/deal/points/${headline?.id}`, {
    method: 'PATCH', body: { state: 'agreed', agreed_text: '' },
  });
  check('refuse agreed with empty wording', refuse.status === 400, `got ${refuse.status}`);

  const agreeOne = await partner(`/api/mandates/${mandateId}/deal/points/${headline.id}`, {
    method: 'PATCH',
    body: { agreed_text: headline.seller_position, state: 'agreed' },
  });
  check('agreeing one blocking point succeeds', agreeOne.status === 200, JSON.stringify(agreeOne.body?.paper || {}).slice(0, 120));
  check('canIssueTermSheet still false until all blocking agreed', agreeOne.body.paper?.canIssueTermSheet === false);
  check('agreed headline now appears in the term sheet', /€48\.0m/.test(agreeOne.body.paper?.termSheet || ''),
    (agreeOne.body.paper?.termSheet || '').slice(0, 220));

  const outsiderDeal = makeClient();
  await outsiderDeal('/api/session', { method: 'POST', body: { userId: SAM } });
  const peekDeal = await outsiderDeal(`/api/mandates/${mandateId}/deal`);
  check('non-member GET /deal is 404', peekDeal.status === 404, `got ${peekDeal.status}`);

  const form = new FormData();
  form.append('files', await openAsBlob(pdf), 'acme-cim.pdf');
  form.append('files', await openAsBlob(docx), 'acme-notes.docx');
  const upload = await partner(`/api/mandates/${mandateId}/documents`, { method: 'POST', body: form });
  check('upload accepted', upload.status === 202, JSON.stringify(upload.body).slice(0, 200));

  let documents = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(700);
    const res = await partner(`/api/mandates/${mandateId}/documents`);
    documents = res.body.documents;
    if (documents.every((d) => ['indexed', 'failed'].includes(d.state))) break;
  }
  check('both files indexed', documents.length === 2 && documents.every((d) => d.state === 'indexed'),
    documents.map((d) => `${d.filename}:${d.state}:${d.error || ''}`).join(' | '));
  check('passages were written', documents.every((d) => d.chunk_count > 0));

  // ---- cited answers ----
  console.log('\nCited question answering');
  const revenue = await partner(`/api/mandates/${mandateId}/runs`, {
    method: 'POST', body: { question: 'What was revenue in 2025?' },
  });
  const revenueRun = revenue.body.run;
  check('answerable question is answered', revenueRun?.state === 'answered', revenueRun?.state);
  check('answer carries at least one citation', (revenueRun?.citations || []).length > 0);
  check('answer contains the figure from the document', /48\.2/.test(revenueRun?.answer_text || ''),
    (revenueRun?.answer_text || '').slice(0, 160));

  const citation = revenueRun?.citations?.[0];
  check('citation resolves to a page locator', Boolean(citation?.filename && citation?.locator),
    `${citation?.filename} ${citation?.locator}`);

  const sourceFile = await partner(`/api/documents/${citation.document_id}/file`);
  check('citation source file is retrievable', sourceFile.status === 200);

  const churn = await partner(`/api/mandates/${mandateId}/runs`, {
    method: 'POST', body: { question: 'What is the customer churn rate?' },
  });
  check('unanswerable question returns no_evidence', churn.body.run?.state === 'no_evidence', churn.body.run?.state);
  check('unanswerable question invents no number', !/\d+(\.\d+)?\s*(per cent|%)/.test(churn.body.run?.answer_text || ''),
    churn.body.run?.answer_text);

  // ---- evidence table ----
  console.log('\nEvidence table');
  const fill = await partner(`/api/mandates/${mandateId}/table/fill`, { method: 'POST', body: {} });
  check('fill was queued', fill.body.queued > 0, JSON.stringify(fill.body));

  let cells = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(900);
    const res = await partner(`/api/mandates/${mandateId}/table`);
    cells = res.body.cells;
    if (!cells.some((c) => c.state === 'queued')) break;
  }
  check('no cell left running', !cells.some((c) => c.state === 'queued'));
  check('every cell reached a decided state',
    cells.every((c) => ['filled', 'not_in_corpus', 'edited', 'unverified'].includes(c.state)),
    cells.map((c) => c.state).join(','));
  check('at least one cell filled with citations',
    cells.some((c) => c.state === 'filled' && c.citations.length > 0));

  // ---- isolation ----
  console.log('\nMandate isolation');
  const outsider = makeClient();
  await outsider('/api/session', { method: 'POST', body: { userId: SAM } });
  const peek = await outsider(`/api/mandates/${mandateId}`);
  check('non-member gets 404, not 403', peek.status === 404, `got ${peek.status}`);
  const peekRuns = await outsider(`/api/runs/${revenueRun.id}`);
  check('non-member cannot open a run by id', peekRuns.status === 404, `got ${peekRuns.status}`);

  // ---- approval gate ----
  console.log('\nApprove-to-export gate');
  await partner(`/api/mandates/${mandateId}/members`, {
    method: 'POST', body: { userId: ALEX, role: 'analyst' },
  });

  const analyst = makeClient();
  await analyst('/api/session', { method: 'POST', body: { userId: ALEX } });

  const memoRes = await analyst(`/api/mandates/${mandateId}/memos`, {
    method: 'POST', body: { title: 'Acme briefing memo' },
  });
  check('analyst can generate a memo', memoRes.status === 201, JSON.stringify(memoRes.body).slice(0, 250));
  const memo = memoRes.body.memo;
  check('memo has a citation appendix', (memoRes.body.payload?.appendix || []).length > 0);

  const earlyDownload = await analyst(`/api/memos/${memo.id}/download`);
  check('download blocked before approval', earlyDownload.status === 403, `got ${earlyDownload.status}`);

  await analyst(`/api/memos/${memo.id}/submit`, { method: 'POST', body: {} });
  const analystApprove = await analyst(`/api/memos/${memo.id}/approve`, { method: 'POST', body: {} });
  check('analyst cannot approve their own export', analystApprove.status === 403, `got ${analystApprove.status}`);

  const approve = await partner(`/api/memos/${memo.id}/approve`, { method: 'POST', body: {} });
  check('partner can approve', approve.status === 200, JSON.stringify(approve.body).slice(0, 200));
  const token = approve.body.memo.download_token;

  const noToken = await partner(`/api/memos/${memo.id}/download`);
  check('download still blocked without the token', noToken.status === 403, `got ${noToken.status}`);

  const download = await partner(`/api/memos/${memo.id}/download?token=${token}`);
  const bytes = download.body instanceof ArrayBuffer ? new Uint8Array(download.body) : new Uint8Array();
  check('approved download succeeds', download.status === 200, `got ${download.status}`);
  check('downloaded file is a real .docx', bytes[0] === 0x50 && bytes[1] === 0x4b, `${bytes.length} bytes`);
  check('downloaded file is not empty', bytes.length > 5000, `${bytes.length} bytes`);

  // ---- audit ----
  console.log('\nAudit trail');
  const audit = await partner(`/api/mandates/${mandateId}/audit`);
  const actions = new Set((audit.body.events || []).map((e) => e.action));
  for (const action of ['mandate.created', 'document.indexed', 'run.answered', 'memo.generated', 'memo.approved', 'memo.exported', 'deal.point_agreed']) {
    check(`audit recorded ${action}`, actions.has(action));
  }
  const aiEvent = (audit.body.events || []).find((e) => e.action === 'run.answered');
  check('AI event records model and retrieved chunks',
    Boolean(aiEvent?.detail?.modelVersion && Array.isArray(aiEvent?.detail?.retrievedChunkIds)));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(1);
});
