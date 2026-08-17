const state = {
  session: null,
  mandates: [],
  mandate: null,
  role: null,
  tab: 'documents',
  documents: [],
  members: [],
  table: null,
  cells: [],
  runs: [],
  memos: [],
  audit: [],
  asking: false,
  citations: new Map(),
  deal: null,
  points: [],
  checkpoints: [],
  paper: null,
  closeView: 'blotter',
  selectedPointId: null,
};

let pollTimer = null;

/* ---------------- plumbing ---------------- */

async function api(path, options = {}) {
  const init = { credentials: 'same-origin', ...options };
  if (init.body && !(init.body instanceof FormData)) {
    init.headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
    init.body = JSON.stringify(init.body);
  }
  const res = await fetch(`/api${path}`, init);
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function toast(message, isError = false) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.className = `toast${isError ? ' error' : ''}`;
  node.hidden = false;
  clearTimeout(node._timer);
  node._timer = setTimeout(() => { node.hidden = true; }, isError ? 6500 : 3200);
}

const fmtDate = (value) => (value ? new Date(value).toLocaleString() : '');
const fmtSize = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`;

function indexCitations(citations = []) {
  for (const citation of citations) state.citations.set(citation.id, citation);
}

/* ---------------- rendering helpers ---------------- */

const CELL_PILL = {
  empty: ['mute', 'Empty'],
  queued: ['wait', 'Running'],
  filled: ['ok', 'Cited'],
  edited: ['ok', 'Edited'],
  unverified: ['warn', 'Unverified'],
  not_in_corpus: ['warn', 'Not in corpus'],
};

const DOC_PILL = {
  uploaded: ['wait', 'Queued'],
  parsing: ['wait', 'Reading'],
  indexed: ['ok', 'Indexed'],
  failed: ['bad', 'Failed'],
};

const POINT_PILL = {
  open: ['warn', 'Live'],
  seller: ['wait', 'Seller'],
  buyer: ['wait', 'Buyer'],
  agreed: ['ok', 'Agreed'],
  dropped: ['mute', 'Dropped'],
};

const MEMO_PILL = {
  draft: ['mute', 'Draft'],
  generated: ['wait', 'Generated'],
  pending_approval: ['warn', 'Awaiting approval'],
  approved: ['ok', 'Approved'],
  rejected: ['bad', 'Rejected'],
  exported: ['ok', 'Exported'],
};

function pill(map, key) {
  const [cls, label] = map[key] || ['mute', key];
  return `<span class="pill ${cls}">${escapeHtml(label)}</span>`;
}

// Turns "[1]" markers inside an answer into buttons that open the source drawer.
function withCitationChips(text, citations = []) {
  return escapeHtml(text).replace(/\[(\d+)\]/g, (match, marker) => {
    const citation = citations.find((c) => String(c.marker) === marker);
    if (!citation) return match;
    const tip = `${citation.filename} — ${citation.locator}`;
    return `<button class="cite" data-citation="${citation.id}" title="${escapeHtml(tip)}">${marker}</button>`;
  });
}

function citationChips(citations = []) {
  if (!citations.length) return '';
  return citations
    .map((c) => `<button class="cite" data-citation="${c.id}" title="${escapeHtml(`${c.filename} — ${c.locator}`)}">${c.marker}</button>`)
    .join('');
}

/* ---------------- data loading ---------------- */

async function loadSession() {
  state.session = await api('/session');
  const badge = document.getElementById('mode-badge');
  badge.textContent = state.session.answerMode === 'generative' ? 'Generative answers' : 'Extractive answers';
  badge.title = state.session.model;
}

async function loadMandates() {
  const { mandates } = await api('/mandates');
  state.mandates = mandates;
}

async function openMandate(id) {
  const detail = await api(`/mandates/${id}`);
  state.mandate = detail.mandate;
  state.role = detail.role;
  state.documents = detail.documents;
  state.members = detail.members;
  state.tab = 'close';
  state.closeView = 'blotter';
  state.selectedPointId = null;
  await refreshTab();
}

async function refreshTab() {
  const id = state.mandate?.id;
  if (!id) return;
  if (state.tab === 'close') {
    const data = await api(`/mandates/${id}/deal`);
    state.deal = data.deal;
    state.points = data.points;
    state.checkpoints = data.checkpoints;
    state.paper = data.paper;
  } else if (state.tab === 'documents' || state.tab === 'team') {
    const [docs, detail] = await Promise.all([api(`/mandates/${id}/documents`), api(`/mandates/${id}`)]);
    state.documents = docs.documents;
    state.members = detail.members;
  } else if (state.tab === 'ask') {
    const { runs } = await api(`/mandates/${id}/runs`);
    state.runs = [];
    for (const run of runs.slice(0, 15)) {
      const detail = await api(`/runs/${run.id}`);
      indexCitations(detail.run.citations);
      state.runs.push(detail.run);
    }
  } else if (state.tab === 'table') {
    const data = await api(`/mandates/${id}/table`);
    state.table = data.table;
    state.cells = data.cells;
    state.cells.forEach((cell) => indexCitations(cell.citations));
  } else if (state.tab === 'memo') {
    const data = await api(`/mandates/${id}/memos`);
    state.memos = data.memos;
  } else if (state.tab === 'activity') {
    const { events } = await api(`/mandates/${id}/audit`);
    state.audit = events;
  }
  render();
  schedulePoll();
}

// Polls only while something is actually in flight, so an idle tab makes no requests.
function schedulePoll() {
  clearTimeout(pollTimer);
  const docsBusy = state.tab === 'documents' && state.documents.some((d) => ['uploaded', 'parsing'].includes(d.state));
  const cellsBusy = state.tab === 'table' && state.cells.some((c) => c.state === 'queued');
  if (docsBusy || cellsBusy) {
    pollTimer = setTimeout(() => refreshTab().catch(() => {}), 1500);
  }
}

/* ---------------- views ---------------- */

function render() {
  renderUserArea();
  const app = document.getElementById('app');
  if (!state.session?.user) return renderSignIn(app);
  if (!state.mandate) return renderMandateList(app);
  return renderWorkspace(app);
}

function renderUserArea() {
  const area = document.getElementById('user-area');
  const user = state.session?.user;
  if (!user) { area.innerHTML = ''; return; }
  area.innerHTML = `
    <div class="row">
      <span class="meta">${escapeHtml(user.name)}</span>
      <button class="btn subtle small" id="sign-out">Switch user</button>
    </div>`;
  document.getElementById('sign-out').onclick = async () => {
    await api('/session', { method: 'DELETE' });
    state.session.user = null;
    state.mandate = null;
    render();
  };
}

function renderSignIn(app) {
  app.innerHTML = `
    <div class="panel">
      <h2>Who is using Mandate?</h2>
      <p class="hint">
        This MVP has no password login. Pick a person to act as. What is enforced is
        membership and role on each mandate, not identity, so keep this on one trusted machine.
      </p>
      <div class="card-list">
        ${state.session.users.map((u) => `
          <button class="card clickable" data-user="${u.id}">
            <strong>${escapeHtml(u.name)}</strong>
            <div class="meta">${escapeHtml(u.email)}</div>
          </button>`).join('')}
      </div>
    </div>`;
  app.querySelectorAll('[data-user]').forEach((btn) => {
    btn.onclick = async () => {
      const { user } = await api('/session', { method: 'POST', body: { userId: btn.dataset.user } });
      state.session.user = user;
      await loadMandates();
      render();
    };
  });
}

function renderMandateList(app) {
  app.innerHTML = `
    <div class="panel">
      <h2>Create a mandate</h2>
      <p class="hint">A mandate is the workspace and the wall. Documents, answers and memos never cross between mandates.</p>
      <div class="row">
        <input type="text" id="m-name" class="grow" placeholder="Mandate name, e.g. Project Harbour" />
        <input type="text" id="m-client" class="grow" placeholder="Client label (optional)" />
        <label class="row" style="gap:6px"><input type="checkbox" id="m-restricted" /> Restricted</label>
        <button class="btn" id="m-create">Create mandate</button>
      </div>
    </div>

    <div class="panel">
      <h2>Your mandates</h2>
      ${state.mandates.length ? `
        <div class="card-list">
          ${state.mandates.map((m) => `
            <button class="card clickable" data-mandate="${m.id}">
              <div class="spread">
                <strong>${escapeHtml(m.name)}</strong>
                <span class="pill mute">${escapeHtml(m.member_role)}</span>
              </div>
              <div class="meta">
                ${escapeHtml(m.client_label || 'No client label')}
                &middot; ${m.indexed_documents} indexed document${Number(m.indexed_documents) === 1 ? '' : 's'}
                ${m.restricted ? '&middot; restricted' : ''}
              </div>
            </button>`).join('')}
        </div>` : '<div class="empty">No mandates yet. Create one above.</div>'}
    </div>`;

  document.getElementById('m-create').onclick = async (event) => {
    const name = document.getElementById('m-name').value.trim();
    if (!name) return toast('Give the mandate a name first.', true);
    event.target.disabled = true;
    try {
      const { mandate } = await api('/mandates', {
        method: 'POST',
        body: {
          name,
          clientLabel: document.getElementById('m-client').value.trim(),
          restricted: document.getElementById('m-restricted').checked,
        },
      });
      await loadMandates();
      await openMandate(mandate.id);
      toast('Mandate created. You are a partner on it, so you can approve exports.');
    } catch (err) {
      toast(err.message, true);
      event.target.disabled = false;
    }
  };

  app.querySelectorAll('[data-mandate]').forEach((btn) => {
    btn.onclick = () => openMandate(btn.dataset.mandate).catch((e) => toast(e.message, true));
  });
}

const TABS = [
  ['close', 'Close'],
  ['documents', 'Documents'],
  ['ask', 'Ask'],
  ['table', 'Evidence table'],
  ['memo', 'Briefing memo'],
  ['team', 'Team'],
  ['activity', 'Activity'],
];

function renderWorkspace(app) {
  const m = state.mandate;
  app.innerHTML = `
    <div class="spread" style="margin-bottom:14px">
      <div>
        <button class="btn subtle small" id="back">&larr; All mandates</button>
        <h2 style="margin:8px 0 2px">${escapeHtml(m.name)}</h2>
        <div class="meta">
          ${escapeHtml(m.client_label || 'No client label')} &middot; you are ${escapeHtml(state.role)}
          ${m.restricted ? '&middot; <strong>restricted</strong>' : ''}
        </div>
      </div>
    </div>
    <div class="tabs" role="tablist">
      ${TABS.map(([key, label]) => `
        <button class="tab" role="tab" data-tab="${key}" aria-selected="${state.tab === key}">${label}</button>`).join('')}
    </div>
    <div id="tab-body"></div>`;

  document.getElementById('back').onclick = async () => {
    clearTimeout(pollTimer);
    state.mandate = null;
    await loadMandates();
    render();
  };
  app.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.onclick = async () => {
      state.tab = btn.dataset.tab;
      await refreshTab().catch((e) => toast(e.message, true));
    };
  });

  const body = document.getElementById('tab-body');
  ({
    close: renderClose,
    documents: renderDocuments,
    ask: renderAsk,
    table: renderTable,
    memo: renderMemo,
    team: renderTeam,
    activity: renderActivity,
  })[state.tab](body);
}

/* ---------------- close (six-week commercial close) ---------------- */

const CLOSE_VIEWS = [
  ['blotter', 'Blotter'],
  ['model', 'Model'],
  ['people', 'People / ops'],
  ['paper', 'Paper'],
  ['checklist', 'Close list'],
];

function dealCounts(points = state.points) {
  const live = points.filter((p) => ['open', 'seller', 'buyer'].includes(p.state)).length;
  const agreed = points.filter((p) => p.state === 'agreed').length;
  const blocking = points.filter((p) => p.blocks_term_sheet && ['open', 'seller', 'buyer'].includes(p.state)).length;
  return { live, agreed, blocking };
}

function partyLine(deal) {
  const seller = deal?.seller?.vehicle || deal?.seller?.name;
  const buyer = deal?.buyer?.name;
  if (seller && buyer) return `${seller} → ${buyer}`;
  return 'Empty sell-side template — load Project Cedar or fill the blotter';
}

async function applyDeal(data) {
  state.deal = data.deal;
  state.points = data.points;
  state.checkpoints = data.checkpoints;
  state.paper = data.paper;
  render();
}

function renderClose(body) {
  const deal = state.deal;
  const points = state.points || [];
  const counts = dealCounts(points);
  const paper = state.paper || {};
  const day = deal?.day || 1;
  const total = deal?.days_total || 42;
  const pct = Math.min(100, Math.round((day / total) * 100));
  const selected = points.find((p) => p.id === state.selectedPointId) || null;

  body.innerHTML = `
    <div class="panel">
      <div class="spread">
        <div>
          <h2>Six-week commercial close</h2>
          <p class="hint" style="margin:0">
            INVRT owns commercials and negotiation. Counsel papers the SPA from
            <strong>agreed</strong> points only. Finish line: both parties on a combined
            agreement, then close. ${escapeHtml(partyLine(deal))}
          </p>
        </div>
        <button class="btn ghost small" id="load-cedar">Load Project Cedar sample</button>
      </div>
      <div class="row" style="margin-top:14px; gap:18px">
        <div>
          <div class="meta">Clock</div>
          <div><strong>Day ${day} / ${total}</strong></div>
          <div class="clock-track" aria-hidden="true"><span style="width:${pct}%"></span></div>
        </div>
        <div><div class="meta">Live</div><strong>${counts.live}</strong></div>
        <div><div class="meta">Agreed</div><strong>${counts.agreed}</strong></div>
        <div>
          <div class="meta">Blocking TS</div>
          <strong>${counts.blocking}</strong>
          ${paper.canIssueTermSheet
            ? '<div class="pill ok">Can issue TS</div>'
            : '<div class="pill warn">Cannot issue TS</div>'}
        </div>
      </div>
    </div>

    <div class="tabs" role="tablist" style="margin-top:4px">
      ${CLOSE_VIEWS.map(([key, label]) => `
        <button class="tab" data-close-view="${key}" aria-selected="${state.closeView === key}">${label}</button>`).join('')}
    </div>
    <div id="close-body"></div>`;

  document.getElementById('load-cedar').onclick = async (event) => {
    if (!window.confirm('Replace this mandate’s deal with the Project Cedar fixture? Live edits on the blotter will be overwritten.')) return;
    event.target.disabled = true;
    try {
      const data = await api(`/mandates/${state.mandate.id}/deal/sample`, { method: 'POST', body: { sample: 'cedar' } });
      state.selectedPointId = null;
      state.closeView = 'blotter';
      await applyDeal(data);
      toast('Project Cedar loaded — Brennan Precision, day 8 of 42.');
    } catch (err) {
      toast(err.message, true);
      event.target.disabled = false;
    }
  };

  body.querySelectorAll('[data-close-view]').forEach((btn) => {
    btn.onclick = () => {
      state.closeView = btn.dataset.closeView;
      render();
    };
  });

  const inner = document.getElementById('close-body');
  ({
    blotter: () => renderBlotter(inner, selected),
    model: () => renderDealModel(inner),
    people: () => renderDealPeople(inner),
    paper: () => renderDealPaper(inner),
    checklist: () => renderDealChecklist(inner),
  })[state.closeView]();
}

function renderBlotter(body, selected) {
  const points = state.points || [];
  body.innerHTML = `
    <div class="panel">
      <h2>Commercial blotter</h2>
      <p class="hint">Click a row to edit positions. Agree wording only when both sides have actually landed there — paper is generated from agreed text, nothing else.</p>
      <div class="table-scroll">
        <table class="evidence blotter">
          <thead>
            <tr>
              <th>#</th>
              <th>Point</th>
              <th>Seller</th>
              <th>Buyer</th>
              <th>Agreed</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            ${points.map((p) => `
              <tr class="blotter-row${selected?.id === p.id ? ' selected' : ''}" data-point="${p.id}">
                <td class="meta">${p.sort_order}</td>
                <td>
                  <strong>${escapeHtml(p.title)}</strong>
                  ${p.blocks_term_sheet ? '<div class="pill warn" style="margin-top:4px">Blocks TS</div>' : ''}
                </td>
                <td class="cell-text">${escapeHtml(p.seller_position) || '<span class="meta">—</span>'}</td>
                <td class="cell-text">${escapeHtml(p.buyer_position) || '<span class="meta">—</span>'}</td>
                <td class="cell-text">${escapeHtml(p.agreed_text) || '<span class="meta">—</span>'}</td>
                <td>${pill(POINT_PILL, p.state)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${selected ? renderPointEditor(selected) : '<div class="empty">Select a commercial point to edit.</div>'}`;

  body.querySelectorAll('[data-point]').forEach((row) => {
    row.onclick = () => {
      state.selectedPointId = row.dataset.point;
      render();
    };
  });
  bindPointEditor(body, selected);
}

function renderPointEditor(point) {
  return `
    <div class="panel" id="point-editor">
      <div class="spread">
        <h2>${escapeHtml(point.title)}</h2>
        <div class="row">
          ${pill(POINT_PILL, point.state)}
          ${point.blocks_term_sheet ? '<span class="pill warn">Blocks TS</span>' : ''}
        </div>
      </div>
      <p class="hint">Agree seller or buyer wording copies that side into agreed text and freezes the point. Mark agreed uses the agreed box as typed.</p>
      <div class="stack">
        <label class="meta">Seller position
          <textarea id="pt-seller">${escapeHtml(point.seller_position)}</textarea>
        </label>
        <label class="meta">Buyer position
          <textarea id="pt-buyer">${escapeHtml(point.buyer_position)}</textarea>
        </label>
        <label class="meta">Agreed text (what paper will emit)
          <textarea id="pt-agreed">${escapeHtml(point.agreed_text)}</textarea>
        </label>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn subtle small" data-pt="save">Save positions</button>
        <button class="btn small" data-pt="agree-seller">Agree seller wording</button>
        <button class="btn small" data-pt="agree-buyer">Agree buyer wording</button>
        <button class="btn ghost small" data-pt="agree">Mark agreed</button>
        <button class="btn subtle small" data-pt="reopen">Re-open</button>
        <button class="btn danger small" data-pt="drop">Drop</button>
      </div>
    </div>`;
}

function bindPointEditor(body, point) {
  if (!point) return;
  const readFields = () => ({
    seller_position: document.getElementById('pt-seller').value,
    buyer_position: document.getElementById('pt-buyer').value,
    agreed_text: document.getElementById('pt-agreed').value,
  });
  const send = async (patch, okMessage) => {
    try {
      const data = await api(`/mandates/${state.mandate.id}/deal/points/${point.id}`, {
        method: 'PATCH', body: patch,
      });
      await applyDeal(data);
      if (okMessage) toast(okMessage);
    } catch (err) {
      toast(err.message, true);
    }
  };
  body.querySelectorAll('[data-pt]').forEach((btn) => {
    btn.onclick = async (event) => {
      event.stopPropagation();
      const fields = readFields();
      const action = btn.dataset.pt;
      if (action === 'save') return send({ ...fields, state: point.state === 'agreed' ? point.state : 'open' }, 'Positions saved.');
      if (action === 'agree-seller') {
        if (!fields.seller_position.trim()) return toast('Seller wording is empty.', true);
        return send({ ...fields, agreed_text: fields.seller_position, state: 'agreed' }, 'Agreed on seller wording. Paper will use this text.');
      }
      if (action === 'agree-buyer') {
        if (!fields.buyer_position.trim()) return toast('Buyer wording is empty.', true);
        return send({ ...fields, agreed_text: fields.buyer_position, state: 'agreed' }, 'Agreed on buyer wording. Paper will use this text.');
      }
      if (action === 'agree') return send({ ...fields, state: 'agreed' });
      if (action === 'reopen') return send({ ...fields, state: 'open' }, 'Point re-opened. It will not appear in paper until agreed again.');
      if (action === 'drop') return send({ ...fields, state: 'dropped' }, 'Point dropped.');
    };
  });
}

function renderDealModel(body) {
  const model = state.deal?.model || {};
  const headline = model.headline || {};
  const ebitda = model.ebitda || {};
  const netDebt = model.netDebt || {};
  const earnOut = model.earnOut || {};
  body.innerHTML = `
    <div class="panel">
      <h2>Model</h2>
      <p class="hint">Numbers here are working commercials, not a DCF. They do not go into the term sheet until the matching blotter point is agreed.</p>
      <div class="row">
        <label class="meta grow">Clock day
          <input type="text" id="model-day" value="${escapeHtml(state.deal?.day ?? 1)}" />
        </label>
        <label class="meta grow">EBITDA (${escapeHtml(ebitda.unit || 'm')} ${escapeHtml(model.currency || '')})
          <input type="text" id="model-ebitda" value="${escapeHtml(ebitda.value ?? '')}" />
        </label>
        <label class="meta grow">Headline — seller
          <input type="text" id="model-hs" value="${escapeHtml(headline.seller ?? '')}" />
        </label>
        <label class="meta grow">Headline — buyer
          <input type="text" id="model-hb" value="${escapeHtml(headline.buyer ?? '')}" />
        </label>
        <label class="meta grow">Net debt
          <input type="text" id="model-nd" value="${escapeHtml(netDebt.value ?? '')}" />
        </label>
      </div>
      <p class="meta" style="margin-top:10px">
        Earn-out seller: ${escapeHtml(earnOut.seller || '—')}<br />
        Earn-out buyer: ${escapeHtml(earnOut.buyer || '—')}
        ${ebitda.basis ? `<br />EBITDA basis: ${escapeHtml(ebitda.basis)}` : ''}
        ${netDebt.note ? `<br />${escapeHtml(netDebt.note)}` : ''}
      </p>
      <div class="row" style="margin-top:10px">
        <button class="btn small" id="save-model">Save day and model</button>
      </div>
    </div>`;
  document.getElementById('save-model').onclick = async () => {
    const day = Number(document.getElementById('model-day').value);
    const nextModel = {
      ...model,
      ebitda: { ...ebitda, value: Number(document.getElementById('model-ebitda').value) || document.getElementById('model-ebitda').value },
      headline: {
        ...headline,
        seller: Number(document.getElementById('model-hs').value) || document.getElementById('model-hs').value,
        buyer: Number(document.getElementById('model-hb').value) || document.getElementById('model-hb').value,
      },
      netDebt: { ...netDebt, value: Number(document.getElementById('model-nd').value) || document.getElementById('model-nd').value },
    };
    try {
      await applyDeal(await api(`/mandates/${state.mandate.id}/deal`, {
        method: 'PATCH', body: { day, model: nextModel },
      }));
      toast('Model saved. Headline still does not paper until the blotter point is agreed.');
    } catch (err) { toast(err.message, true); }
  };
}

function renderDealPeople(body) {
  const ops = state.deal?.operating_model || {};
  const md = ops.md || {};
  const perimeter = ops.perimeter || {};
  const invrt = state.deal?.invrt || {};
  body.innerHTML = `
    <div class="panel">
      <h2>People / ops</h2>
      <p class="hint">Operating facts that sit behind the blotter. Employment and perimeter still have to be agreed as commercial points before they appear in paper.</p>
      <div class="card-list">
        <div class="card">
          <strong>Managing director</strong>
          <div class="meta">${escapeHtml(md.name || 'Not set')}</div>
          <div>${escapeHtml(md.role || '')}</div>
          <div class="meta">${escapeHtml(md.note || '')}</div>
        </div>
        <div class="card">
          <strong>Perimeter</strong>
          <div>In: ${escapeHtml(perimeter.in || '—')}</div>
          <div>Out: ${escapeHtml(perimeter.out || '—')}</div>
        </div>
        <div class="card">
          <strong>Day-1 operating</strong>
          <div>${escapeHtml(ops.familyRecharges || 'Family recharges: live on blotter')}</div>
          <div>${escapeHtml(ops.groupFd || 'Group FD: live on blotter')}</div>
        </div>
        <div class="card">
          <strong>INVRT</strong>
          <div>${escapeHtml(invrt.role || '')}</div>
          <div class="meta">
            ${invrt.feePct ? `Fee ${invrt.feePct}% of ${escapeHtml(invrt.feeBase || 'equity value')}` : ''}
            ${invrt.kickerPct ? ` · ${invrt.kickerPct}% kicker` : ''}
          </div>
          <div class="meta">${escapeHtml(invrt.termSheet || '')}</div>
        </div>
      </div>
    </div>`;
}

function renderDealPaper(body) {
  const paper = state.paper || {};
  const can = Boolean(paper.canIssueTermSheet);
  body.innerHTML = `
    <div class="panel">
      <h2>Paper</h2>
      <p class="hint">
        Generated on the server from <strong>agreed</strong> blotter points only.
        Live points are listed as do-not-paper. Copy this into an email to counsel —
        it is not a SPA editor and it is not stored as a file.
      </p>
      ${can
        ? '<div class="disclosure" style="border-color:#b7d7c4;background:var(--good-soft);color:var(--good)">Every blocking commercial is agreed. This pack can be issued.</div>'
        : `<div class="disclosure">Cannot issue a term sheet yet. Still live and blocking: ${(paper.blockingOpen || []).map((p) => escapeHtml(p.title)).join('; ') || '—'}</div>`}
      <div class="spread" style="margin-bottom:8px">
        <h3 style="margin:0;font-size:15px">Term sheet (agreed commercials only)</h3>
        <button class="btn ghost small" data-copy="termSheet">Copy term sheet</button>
      </div>
      <pre class="paper">${escapeHtml(paper.termSheet || '')}</pre>
      <div class="spread" style="margin:16px 0 8px">
        <h3 style="margin:0;font-size:15px">Counsel pack</h3>
        <button class="btn ghost small" data-copy="counselPack">Copy counsel pack</button>
      </div>
      <pre class="paper">${escapeHtml(paper.counselPack || '')}</pre>
    </div>`;
  body.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.onclick = async () => {
      const text = paper[btn.dataset.copy] || '';
      try {
        await navigator.clipboard.writeText(text);
        toast('Copied. Check it still contains only agreed commercials before you send it.');
      } catch {
        toast('Could not copy — select the text and copy it yourself.', true);
      }
    };
  });
}

function renderDealChecklist(body) {
  const items = state.checkpoints || [];
  const done = items.filter((c) => c.done).length;
  body.innerHTML = `
    <div class="panel">
      <h2>Close list</h2>
      <p class="hint">${done} of ${items.length} done. These are process gates, not commercials. Toggling “Commercials frozen” does not freeze the blotter by itself — agree the blocking points first.</p>
      <div class="card-list">
        ${items.map((c) => `
          <button class="card clickable" data-toggle="${c.id}">
            <div class="spread">
              <strong>${escapeHtml(c.title)}</strong>
              ${c.done ? '<span class="pill ok">Done</span>' : '<span class="pill mute">Open</span>'}
            </div>
          </button>`).join('')}
      </div>
    </div>`;
  body.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        await applyDeal(await api(`/mandates/${state.mandate.id}/deal/checkpoints/${btn.dataset.toggle}/toggle`, { method: 'POST' }));
      } catch (err) { toast(err.message, true); }
    };
  });
}

/* ---------------- documents ---------------- */

function renderDocuments(body) {
  body.innerHTML = `
    <div class="panel">
      <h2>Upload documents</h2>
      <p class="hint">PDF and DOCX only. Each file is read into citable passages: PDFs cite a page, Word files cite a heading.</p>
      <div class="dropzone" id="dropzone">
        <strong>Drop files here</strong> or
        <button class="btn ghost small" id="pick">choose files</button>
        <input type="file" id="file-input" multiple accept=".pdf,.docx" hidden />
      </div>
    </div>

    <div class="panel">
      <div class="spread"><h2>Corpus</h2><button class="btn subtle small" id="refresh-docs">Refresh</button></div>
      ${state.documents.length ? `
        <div class="card-list" style="margin-top:12px">
          ${state.documents.map((d) => `
            <div class="card">
              <div class="spread">
                <strong>${escapeHtml(d.filename)}</strong>
                ${pill(DOC_PILL, d.state)}
              </div>
              <div class="meta">
                ${fmtSize(d.byte_size)}
                ${d.page_count ? `&middot; ${d.page_count} pages` : ''}
                ${d.chunk_count ? `&middot; ${d.chunk_count} passages indexed` : ''}
                &middot; ${fmtDate(d.created_at)}
              </div>
              ${d.state === 'failed' ? `
                <div class="meta" style="color:var(--bad);margin-top:6px">${escapeHtml(d.error || 'Parse failed')}</div>
                <div style="margin-top:8px"><button class="btn subtle small" data-retry="${d.id}">Try again</button></div>` : ''}
            </div>`).join('')}
        </div>` : '<div class="empty" style="margin-top:12px">Nothing uploaded yet.</div>'}
    </div>`;

  const input = document.getElementById('file-input');
  const zone = document.getElementById('dropzone');
  document.getElementById('pick').onclick = () => input.click();
  input.onchange = () => uploadFiles(input.files);
  document.getElementById('refresh-docs').onclick = () => refreshTab().catch((e) => toast(e.message, true));

  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault(); zone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault(); zone.classList.remove('over');
  }));
  zone.addEventListener('drop', (e) => uploadFiles(e.dataTransfer.files));

  body.querySelectorAll('[data-retry]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/documents/${btn.dataset.retry}/retry`, { method: 'POST' });
      toast('Retrying that file.');
      refreshTab();
    };
  });
}

async function uploadFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  try {
    toast(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`);
    await api(`/mandates/${state.mandate.id}/documents`, { method: 'POST', body: form });
    await refreshTab();
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---------------- ask ---------------- */

function renderAsk(body) {
  body.innerHTML = `
    <div class="panel">
      <h2>Ask this mandate's documents</h2>
      <p class="hint">
        Answers come only from the files uploaded to this mandate. If the answer is not in
        them, Mandate says so instead of guessing.
      </p>
      <div class="row">
        <input type="text" id="q" class="grow" placeholder="e.g. What was revenue last year?" />
        <button class="btn" id="ask" ${state.asking ? 'disabled' : ''}>${state.asking ? 'Searching…' : 'Ask'}</button>
      </div>
    </div>

    ${state.runs.length ? state.runs.map(renderRunCard).join('') : '<div class="empty">No questions asked yet.</div>'}`;

  const input = document.getElementById('q');
  const ask = async () => {
    const question = input.value.trim();
    if (!question) return;
    state.asking = true;
    render();
    try {
      await api(`/mandates/${state.mandate.id}/runs`, { method: 'POST', body: { question } });
      state.asking = false;
      await refreshTab();
    } catch (err) {
      state.asking = false;
      render();
      toast(err.message, true);
    }
  };
  document.getElementById('ask').onclick = ask;
  input.onkeydown = (e) => { if (e.key === 'Enter') ask(); };

  body.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/citations/${btn.dataset.reject}/reject`, { method: 'POST' });
      toast('Citation rejected. It will not appear on an export unless replaced.');
      refreshTab();
    };
  });
}

function renderRunCard(run) {
  const noEvidence = run.state === 'no_evidence';
  const citations = run.citations || [];
  return `
    <div class="answer ${noEvidence ? 'no-evidence' : ''}">
      <div class="question">${escapeHtml(run.question)}</div>
      <div class="body">${withCitationChips(run.answer_text || '', citations)}</div>
      <div class="note">
        ${noEvidence
          ? 'Nothing in this mandate&rsquo;s documents supports an answer.'
          : `${citations.length} source${citations.length === 1 ? '' : 's'} &middot; ${escapeHtml(run.answer_mode || '')} &middot; ${escapeHtml(run.model_version || '')}`}
        &middot; ${fmtDate(run.created_at)}
      </div>
      ${citations.length ? `
        <div class="row" style="margin-top:9px">
          ${citations.map((c) => `
            <span class="meta">
              [${c.marker}] ${escapeHtml(c.filename)}, ${escapeHtml(c.locator)}
              ${c.state === 'rejected'
                ? '<span class="pill bad">rejected</span>'
                : `<button class="btn subtle small" data-reject="${c.id}">Reject</button>`}
            </span>`).join('')}
        </div>` : ''}
    </div>`;
}

/* ---------------- evidence table ---------------- */

function renderTable(body) {
  const table = state.table;
  const topics = table?.row_topics || [];
  const columns = table?.columns || [];
  const byPosition = new Map(state.cells.map((c) => [`${c.row_index}:${c.col_index}`, c]));
  const running = state.cells.filter((c) => c.state === 'queued').length;

  body.innerHTML = `
    <div class="panel">
      <div class="spread">
        <div>
          <h2>Evidence table</h2>
          <p class="hint" style="margin:0">
            Rows are topics, columns are briefing questions. Every filled cell carries its sources.
            ${running ? `<strong>${running} cell${running === 1 ? '' : 's'} still running.</strong>` : ''}
          </p>
        </div>
        <div class="row">
          <button class="btn" id="fill">${running ? 'Filling…' : 'Fill empty cells'}</button>
          <button class="btn subtle small" id="edit-shape">Edit rows &amp; questions</button>
        </div>
      </div>
    </div>

    <div class="table-scroll">
      <table class="evidence">
        <thead>
          <tr>
            <th class="topic">Topic</th>
            ${columns.map((q) => `<th>${escapeHtml(q)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${topics.map((topic, r) => `
            <tr>
              <td class="topic">${escapeHtml(topic)}</td>
              ${columns.map((_, c) => renderCell(byPosition.get(`${r}:${c}`))).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  document.getElementById('fill').onclick = async () => {
    try {
      const { queued } = await api(`/mandates/${state.mandate.id}/table/fill`, { method: 'POST', body: {} });
      toast(queued ? `Filling ${queued} cells. Progress appears per cell.` : 'Every cell already has an answer.');
      await refreshTab();
    } catch (err) { toast(err.message, true); }
  };

  document.getElementById('edit-shape').onclick = () => editShape();

  body.querySelectorAll('[data-rerun]').forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await api(`/mandates/${state.mandate.id}/table/cells/${btn.dataset.rerun}/rerun`, { method: 'POST', body: {} });
        await refreshTab();
      } catch (err) { toast(err.message, true); }
    };
  });

  body.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = async () => {
      const cell = state.cells.find((c) => c.id === btn.dataset.edit);
      const next = window.prompt('Edit this cell. Your text is what appears in the exported memo.', cell?.text || '');
      if (next === null) return;
      await api(`/mandates/${state.mandate.id}/table/cells/${cell.id}`, { method: 'PUT', body: { text: next } });
      await refreshTab();
    };
  });

  body.querySelectorAll('[data-unverified]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/mandates/${state.mandate.id}/table/cells/${btn.dataset.unverified}`, {
        method: 'PUT', body: { markUnverified: true },
      });
      await refreshTab();
    };
  });
}

function renderCell(cell) {
  if (!cell) return '<td class="meta">—</td>';
  const text = cell.state === 'not_in_corpus'
    ? '<em>Not stated in the uploaded documents.</em>'
    : escapeHtml(cell.text || '');
  return `
    <td>
      ${pill(CELL_PILL, cell.state)}
      <div class="cell-text" style="margin-top:6px">${text || '<span class="meta">—</span>'}</div>
      ${cell.citations?.length ? `<div style="margin-top:6px">${citationChips(cell.citations)}</div>` : ''}
      <div class="cell-actions">
        <button class="btn subtle small" data-rerun="${cell.id}">Rerun</button>
        <button class="btn subtle small" data-edit="${cell.id}">Edit</button>
        ${['filled', 'edited'].includes(cell.state)
          ? `<button class="btn subtle small" data-unverified="${cell.id}">Mark unverified</button>` : ''}
      </div>
    </td>`;
}

async function editShape() {
  const topics = window.prompt(
    'Row topics, one per line.',
    (state.table?.row_topics || []).join('\n')
  );
  if (topics === null) return;
  const columns = window.prompt(
    'Questions, one per line. These become the table columns.',
    (state.table?.columns || []).join('\n')
  );
  if (columns === null) return;
  try {
    await api(`/mandates/${state.mandate.id}/table`, {
      method: 'PUT',
      body: {
        rowTopics: topics.split('\n').map((s) => s.trim()).filter(Boolean),
        columns: columns.split('\n').map((s) => s.trim()).filter(Boolean),
      },
    });
    await refreshTab();
  } catch (err) { toast(err.message, true); }
}

/* ---------------- memo ---------------- */

function renderMemo(body) {
  const canApprove = ['lead', 'partner', 'admin'].includes(state.role);
  body.innerHTML = `
    <div class="panel">
      <h2>Briefing memo</h2>
      <p class="hint">
        Generates a Word document from the evidence table and the questions you asked, with a
        citation appendix. Nothing downloads until a lead or partner approves it.
      </p>
      <div class="row">
        <input type="text" id="memo-title" class="grow" placeholder="${escapeHtml(state.mandate.name)} — briefing memo" />
        <button class="btn" id="generate">Generate memo</button>
      </div>
    </div>

    ${state.memos.length ? state.memos.map((memo) => renderMemoCard(memo, canApprove)).join('')
      : '<div class="empty">No memo generated yet.</div>'}`;

  document.getElementById('generate').onclick = async (event) => {
    event.target.disabled = true;
    event.target.textContent = 'Building Word document…';
    try {
      await api(`/mandates/${state.mandate.id}/memos`, {
        method: 'POST',
        body: { title: document.getElementById('memo-title').value.trim() },
      });
      toast('Memo generated. Send it for approval when you are happy with it.');
      await refreshTab();
    } catch (err) {
      toast(err.message, true);
      event.target.disabled = false;
      event.target.textContent = 'Generate memo';
    }
  };

  body.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = async () => {
      const { action, memo: memoId } = btn.dataset;
      try {
        if (action === 'reject') {
          const reason = window.prompt('Why is this memo not good enough to export?');
          if (reason === null) return;
          await api(`/memos/${memoId}/reject`, { method: 'POST', body: { reason } });
        } else {
          await api(`/memos/${memoId}/${action}`, { method: 'POST', body: {} });
        }
        toast(action === 'approve' ? 'Approved. The download is now unlocked.' : 'Done.');
        await refreshTab();
      } catch (err) { toast(err.message, true); }
    };
  });
}

function renderMemoCard(memo, canApprove) {
  const downloadable = ['approved', 'exported'].includes(memo.state) && memo.download_token;
  return `
    <div class="panel">
      <div class="spread">
        <strong>${escapeHtml(memo.title)}</strong>
        ${pill(MEMO_PILL, memo.state)}
      </div>
      <div class="meta" style="margin-top:4px">
        Prepared by ${escapeHtml(memo.generated_by_name || 'unknown')}
        ${memo.approved_by_name ? `&middot; approved by ${escapeHtml(memo.approved_by_name)}` : ''}
        &middot; ${fmtDate(memo.updated_at)}
      </div>
      ${memo.rejection_reason ? `<div class="meta" style="color:var(--bad);margin-top:6px">${escapeHtml(memo.rejection_reason)}</div>` : ''}

      ${memo.state === 'generated' ? `
        <div class="disclosure" style="margin-top:12px">
          AI-assisted draft. Read it against its citations before sending it for approval.
        </div>` : ''}
      ${memo.state === 'pending_approval' && !canApprove ? `
        <div class="disclosure" style="margin-top:12px">
          Waiting for a lead or partner. You cannot approve your own export at the analyst role.
        </div>` : ''}

      <div class="row" style="margin-top:12px">
        ${memo.state === 'generated' ? `<button class="btn" data-action="submit" data-memo="${memo.id}">Send for approval</button>` : ''}
        ${memo.state === 'pending_approval' && canApprove ? `
          <button class="btn" data-action="approve" data-memo="${memo.id}">Approve for export</button>
          <button class="btn danger" data-action="reject" data-memo="${memo.id}">Reject</button>` : ''}
        ${downloadable
          ? `<a class="btn" href="/api/memos/${memo.id}/download?token=${encodeURIComponent(memo.download_token)}">Download Word file</a>`
          : `<button class="btn" disabled title="A lead or partner must approve this first">Download Word file</button>`}
      </div>
    </div>`;
}

/* ---------------- team and activity ---------------- */

function renderTeam(body) {
  const canManage = ['partner', 'admin'].includes(state.role);
  const others = (state.session.users || []).filter(
    (u) => !state.members.some((m) => m.user_id === u.id && m.state === 'active')
  );
  body.innerHTML = `
    <div class="panel">
      <h2>Who can see this mandate</h2>
      <p class="hint">Only active members can list documents, ask questions or open work product.</p>
      <div class="card-list">
        ${state.members.map((m) => `
          <div class="card">
            <div class="spread">
              <div>
                <strong>${escapeHtml(m.name)}</strong>
                <div class="meta">${escapeHtml(m.email)}</div>
              </div>
              <div class="row">
                <span class="pill ${m.state === 'active' ? 'ok' : 'mute'}">${escapeHtml(m.role)}${m.state === 'revoked' ? ' (revoked)' : ''}</span>
                ${canManage && m.state === 'active'
                  ? `<button class="btn subtle small" data-revoke="${m.id}">Revoke</button>` : ''}
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    ${canManage && others.length ? `
      <div class="panel">
        <h2>Add a colleague</h2>
        <div class="row">
          <select id="add-user" class="grow">
            ${others.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}
          </select>
          <select id="add-role">
            <option value="analyst">analyst</option>
            <option value="lead">lead</option>
            <option value="partner">partner</option>
            <option value="admin">admin</option>
          </select>
          <button class="btn" id="add-member">Add to mandate</button>
        </div>
      </div>` : ''}`;

  const addBtn = document.getElementById('add-member');
  if (addBtn) {
    addBtn.onclick = async () => {
      try {
        await api(`/mandates/${state.mandate.id}/members`, {
          method: 'POST',
          body: {
            userId: document.getElementById('add-user').value,
            role: document.getElementById('add-role').value,
          },
        });
        await refreshTab();
      } catch (err) { toast(err.message, true); }
    };
  }
  body.querySelectorAll('[data-revoke]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        await api(`/mandates/${state.mandate.id}/members/${btn.dataset.revoke}/revoke`, { method: 'POST', body: {} });
        await refreshTab();
      } catch (err) { toast(err.message, true); }
    };
  });
}

function renderActivity(body) {
  body.innerHTML = `
    <div class="panel">
      <h2>Activity</h2>
      <p class="hint">Every ingest, question, edit, approval and export on this mandate. Append-only.</p>
      ${state.audit.length ? `
        <div class="stack">
          ${state.audit.map((e) => `
            <div class="card">
              <div class="spread">
                <strong class="mono">${escapeHtml(e.action)}</strong>
                <span class="meta">${fmtDate(e.created_at)}</span>
              </div>
              <div class="meta">${escapeHtml(e.actor_name || 'system')} &middot; ${escapeHtml(e.entity)}</div>
              ${Object.keys(e.detail || {}).length
                ? `<div class="mono meta" style="margin-top:6px">${escapeHtml(JSON.stringify(e.detail))}</div>` : ''}
            </div>`).join('')}
        </div>` : '<div class="empty">Nothing recorded yet.</div>'}
    </div>`;
}

/* ---------------- source drawer ---------------- */

function closeDrawer() {
  document.getElementById('drawer').hidden = true;
}

function openDrawer(citationId) {
  const citation = state.citations.get(citationId);
  if (!citation) return;
  const drawer = document.getElementById('drawer');
  document.getElementById('drawer-title').textContent = `Source [${citation.marker}]`;

  const deepLink = citation.locator_kind === 'page' && citation.page
    ? `/api/documents/${citation.document_id}/file#page=${citation.page}`
    : `/api/documents/${citation.document_id}/file`;

  document.getElementById('drawer-body').innerHTML = `
    <div class="stack">
      <div>
        <strong>${escapeHtml(citation.filename)}</strong>
        <div class="meta">${escapeHtml(citation.locator)}</div>
      </div>
      <div class="quote">${escapeHtml(citation.quote)}</div>
      <div>
        <a class="btn ghost small" href="${deepLink}" target="_blank" rel="noopener">
          ${citation.ext === 'pdf' ? 'Open the PDF at this page' : 'Download the source file'}
        </a>
      </div>
      <details>
        <summary class="meta">Show the full passage that was retrieved</summary>
        <div class="quote" style="margin-top:8px">${escapeHtml(citation.chunk_text || '')}</div>
      </details>
    </div>`;
  drawer.hidden = false;
}

document.getElementById('drawer-close').addEventListener('click', (event) => {
  event.stopPropagation();
  closeDrawer();
});

document.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-citation]');
  if (chip) {
    event.preventDefault();
    openDrawer(chip.dataset.citation);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
});

/* ---------------- boot ---------------- */

(async function boot() {
  try {
    await loadSession();
    if (state.session.user) await loadMandates();
    render();
  } catch (err) {
    document.getElementById('app').innerHTML =
      `<div class="panel"><h2>Mandate could not start</h2><p class="hint">${escapeHtml(err.message)}</p></div>`;
  }
})();
