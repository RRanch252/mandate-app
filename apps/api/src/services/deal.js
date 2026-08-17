import { many, one, query, withTransaction } from '../db.js';
import { record } from '../audit.js';

export const POINT_STATES = ['open', 'seller', 'buyer', 'agreed', 'dropped'];
const LIVE_STATES = new Set(['open', 'seller', 'buyer']);

export const DEFAULT_POINTS = [
  { title: 'Headline price', blocksTermSheet: true },
  { title: 'Locked box vs completion accounts', blocksTermSheet: true },
  { title: 'Earn-out', blocksTermSheet: true },
  { title: 'Perimeter — factory vs family yard', blocksTermSheet: false },
  { title: 'Leakage / bonuses', blocksTermSheet: false },
  { title: 'MD employment', blocksTermSheet: true },
  { title: 'Non-compete', blocksTermSheet: false },
  { title: 'Family recharges stop', blocksTermSheet: false },
  { title: 'Group FD day 1', blocksTermSheet: false },
  { title: 'Exclusivity', blocksTermSheet: false },
];

export const DEFAULT_CHECKPOINTS = [
  'Commercials frozen',
  'TS issued or written waiver to SPA',
  'Counsel pack sent',
  'SPA first draft',
  'MD employment in draft',
  'Disclosure open',
  'Funds flow',
  'Sign and complete',
];

const EMPTY_DEAL = {
  day: 1,
  days_total: 42,
  side: 'sell',
  control: 'majority',
  seller: {},
  buyer: {},
  model: {},
  operating_model: {},
  invrt: {
    role: 'Sell-side adviser. INVRT owns commercials and negotiation; counsel papers the SPA.',
  },
};

export const CEDAR = {
  day: 8,
  days_total: 42,
  side: 'sell',
  control: 'majority',
  seller: {
    name: 'Brennan family',
    vehicle: 'Brennan Precision Ltd',
    stake: '100%',
  },
  buyer: {
    name: 'Helix Engineering Ltd',
    stakeSought: '100%',
  },
  model: {
    currency: 'EUR',
    ebitda: { value: 6.0, unit: 'm', year: 2025, basis: 'reported, last twelve months' },
    headline: { seller: 48, buyer: 45, unit: 'm' },
    netDebt: { value: 2.1, unit: 'm', note: 'Locked-box date still live — do not paper a number' },
    earnOut: {
      seller: 'On reported EBITDA, 24 months post-close',
      buyer: 'On adjusted EBITDA, 24 months post-close',
    },
  },
  operating_model: {
    md: {
      name: 'Siobhán Brennan',
      role: 'Managing Director, in situ',
      note: 'Employment terms still live and block the term sheet',
    },
    perimeter: {
      in: 'Precision factory and operating assets of Brennan Precision Ltd',
      out: 'Family yard and adjacent non-operating land',
    },
    familyRecharges: 'Stop at completion — agreed',
    groupFd: 'Buyer-nominated Group FD in seat on completion (day 1) — agreed',
  },
  invrt: {
    role: 'Sell-side adviser. INVRT owns commercials and negotiation; counsel papers the SPA.',
    feePct: 1.25,
    kickerPct: 0.4,
    feeBase: 'equity value',
    termSheet: 'Draft exists, unsigned. Issue only once blocking commercials are agreed.',
  },
  points: [
    {
      title: 'Headline price',
      blocksTermSheet: true,
      seller_position: '€48.0m equity value for 100% of Brennan Precision Ltd.',
      buyer_position: '€45.0m equity value for 100% of Brennan Precision Ltd.',
      agreed_text: '',
      state: 'open',
    },
    {
      title: 'Locked box vs completion accounts',
      blocksTermSheet: true,
      seller_position: 'Locked box at 31 December 2025. Leakage only, no completion accounts.',
      buyer_position: 'Completion accounts with a normalised working-capital peg.',
      agreed_text: '',
      state: 'open',
    },
    {
      title: 'Earn-out',
      blocksTermSheet: true,
      seller_position: 'Earn-out on reported EBITDA, 24 months post-close.',
      buyer_position: 'Earn-out on adjusted EBITDA, 24 months post-close.',
      agreed_text: '',
      state: 'open',
    },
    {
      title: 'Perimeter — factory vs family yard',
      blocksTermSheet: false,
      seller_position: 'Factory and operating assets in. Family yard and adjacent land out.',
      buyer_position: 'Factory in. Option over the family yard for 18 months post-close.',
      agreed_text: '',
      state: 'open',
    },
    {
      title: 'Leakage / bonuses',
      blocksTermSheet: false,
      seller_position: 'Ordinary-course bonuses permitted as leakage exceptions.',
      buyer_position: 'No leakage save the permitted leakage schedule in the SPA.',
      agreed_text: '',
      state: 'open',
    },
    {
      title: 'MD employment',
      blocksTermSheet: true,
      seller_position: 'Siobhán Brennan continues as MD on current terms, three-year term.',
      buyer_position: 'Siobhán Brennan as MD on buyer-form service agreement, 12-month notice.',
      agreed_text: '',
      state: 'open',
    },
    {
      title: 'Non-compete',
      blocksTermSheet: false,
      seller_position: 'Two years, Republic of Ireland, precision engineering only.',
      buyer_position: 'Three years, Ireland and UK, engineering.',
      agreed_text: '',
      state: 'open',
    },
    {
      title: 'Family recharges stop',
      blocksTermSheet: false,
      seller_position: 'Family recharges stop at completion.',
      buyer_position: 'Family recharges stop at completion. No further related-party charges in.',
      agreed_text: 'Family recharges stop at completion. No further related-party charges into Brennan Precision Ltd after close.',
      state: 'agreed',
    },
    {
      title: 'Group FD day 1',
      blocksTermSheet: false,
      seller_position: 'Buyer nominates Group FD; in seat on completion.',
      buyer_position: 'Buyer nominates Group FD; in seat on completion (day 1).',
      agreed_text: 'Buyer nominates Group FD; in seat on completion (day 1).',
      state: 'agreed',
    },
    {
      title: 'Exclusivity',
      blocksTermSheet: false,
      seller_position: 'Exclusive until day 42 of the close clock.',
      buyer_position: 'Exclusive until day 42 of the close clock.',
      agreed_text: 'Exclusive until day 42 of the close clock (end of week 6). Draft term sheet exists and is unsigned.',
      state: 'agreed',
    },
  ],
  checkpoints: DEFAULT_CHECKPOINTS.map((title) => ({ title, done: false })),
};

function json(value) {
  return JSON.stringify(value ?? {});
}

function isLive(point) {
  return LIVE_STATES.has(point.state);
}

function isBlockingOpen(point) {
  return Boolean(point.blocks_term_sheet) && isLive(point);
}

export function buildPaper(deal, points) {
  const agreed = points.filter((p) => p.state === 'agreed' && String(p.agreed_text || '').trim());
  const live = points.filter(isLive);
  const blockingOpen = points.filter(isBlockingOpen);
  const canIssueTermSheet = blockingOpen.length === 0;

  const sellerLabel = deal.seller?.name
    ? `${deal.seller.name}${deal.seller.vehicle ? ` — ${deal.seller.vehicle}` : ''}${deal.seller.stake ? ` (${deal.seller.stake})` : ''}`
    : '[seller not set]';
  const buyerLabel = deal.buyer?.name
    ? `${deal.buyer.name}${deal.buyer.stakeSought ? ` acquiring ${deal.buyer.stakeSought}` : ''}`
    : '[buyer not set]';

  const agreedBlock = agreed.length
    ? agreed.map((p) => `${p.sort_order}. ${p.title}\n   ${p.agreed_text.trim()}`).join('\n\n')
    : '(none — do not issue a term sheet and do not instruct counsel to paper commercials)';

  const liveBlock = live.length
    ? live.map((p) => {
      const flag = p.blocks_term_sheet ? ' — BLOCKS TS' : '';
      return `${p.sort_order}. ${p.title} [${p.state}]${flag}`;
    }).join('\n')
    : '(none)';

  const issueLine = canIssueTermSheet
    ? 'CAN ISSUE: every term-sheet-blocking commercial is agreed. Issue from this page only.'
    : `CANNOT ISSUE: ${blockingOpen.length} term-sheet-blocking point${blockingOpen.length === 1 ? '' : 's'} still live (${blockingOpen.map((p) => p.title).join('; ')}).`;

  const termSheet = [
    'NON-BINDING HEADS OF TERMS',
    '(binding only as to exclusivity, confidentiality and governing law, and only where those appear below as AGREED)',
    '',
    `Side: ${deal.side}-side  ·  Control: ${deal.control}  ·  Clock: day ${deal.day} of ${deal.days_total}`,
    `Seller: ${sellerLabel}`,
    `Buyer: ${buyerLabel}`,
    '',
    'AGREED COMMERCIALS — the only points that may appear in a term sheet or be sent to counsel to paper',
    agreedBlock,
    '',
    'DO NOT PAPER — still live; omit from the term sheet and from the SPA until agreed',
    liveBlock,
    '',
    issueLine,
    '',
    'INVRT owns commercials and negotiation. Counsel papers the SPA from AGREED points only.',
    'A draft term sheet may already exist; it is not issued until blocking commercials are agreed.',
  ].join('\n');

  const counselPack = [
    'COUNSEL PACK — paper the SPA from AGREED commercials only',
    '',
    `Mandate clock: day ${deal.day} of ${deal.days_total}. ${issueLine}`,
    `Parties: ${sellerLabel} to ${buyerLabel}.`,
    '',
    'PAPER THESE (agreed)',
    agreedBlock,
    '',
    'DO NOT PAPER (live). Do not put these in the first draft. If a prior draft TS already mentions them, mark them open and leave the number blank.',
    liveBlock,
    '',
    'Process: INVRT freezes commercials, then emits this pack. Counsel does not originate commercials. Jurisdiction is a parameter for counsel, not a commercial.',
    deal.invrt?.feePct
      ? `INVRT fee (not for the SPA): ${deal.invrt.feePct}% of ${deal.invrt.feeBase || 'equity value'}${deal.invrt.kickerPct ? ` plus ${deal.invrt.kickerPct}% kicker` : ''}.`
      : '',
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');

  return {
    canIssueTermSheet,
    doNotPaper: live.map((p) => p.title),
    blockingOpen: blockingOpen.map((p) => ({ id: p.id, title: p.title })),
    termSheet,
    counselPack,
  };
}

async function insertPoints(client, { firmId, mandateId, dealId, points }) {
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    await client.query(
      `INSERT INTO commercial_points
         (firm_id, mandate_id, deal_id, title, sort_order, blocks_term_sheet,
          seller_position, buyer_position, agreed_text, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        firmId, mandateId, dealId, p.title, i + 1, Boolean(p.blocksTermSheet),
        p.seller_position || '', p.buyer_position || '', p.agreed_text || '', p.state || 'open',
      ]
    );
  }
}

async function insertCheckpoints(client, { firmId, mandateId, dealId, checkpoints }) {
  for (let i = 0; i < checkpoints.length; i += 1) {
    const c = checkpoints[i];
    const title = typeof c === 'string' ? c : c.title;
    const done = typeof c === 'string' ? false : Boolean(c.done);
    await client.query(
      `INSERT INTO close_checkpoints (firm_id, mandate_id, deal_id, title, sort_order, done)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [firmId, mandateId, dealId, title, i + 1, done]
    );
  }
}

export async function ensureDeal({ firmId, mandateId }) {
  const existing = await one(`SELECT * FROM deals WHERE mandate_id = $1 AND firm_id = $2`, [mandateId, firmId]);
  if (existing) return existing;

  return withTransaction(async (client) => {
    const locked = await client.query(
      `SELECT * FROM deals WHERE mandate_id = $1 AND firm_id = $2 FOR UPDATE`,
      [mandateId, firmId]
    );
    if (locked.rows[0]) return locked.rows[0];

    const inserted = await client.query(
      `INSERT INTO deals
         (firm_id, mandate_id, day, days_total, side, control, seller, buyer, model, operating_model, invrt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (mandate_id) DO NOTHING
       RETURNING *`,
      [
        firmId, mandateId, EMPTY_DEAL.day, EMPTY_DEAL.days_total, EMPTY_DEAL.side, EMPTY_DEAL.control,
        json(EMPTY_DEAL.seller), json(EMPTY_DEAL.buyer), json(EMPTY_DEAL.model),
        json(EMPTY_DEAL.operating_model), json(EMPTY_DEAL.invrt),
      ]
    );
    const deal = inserted.rows[0] || (await client.query(
      `SELECT * FROM deals WHERE mandate_id = $1 AND firm_id = $2`,
      [mandateId, firmId]
    )).rows[0];
    if (!inserted.rows[0]) return deal;
    await insertPoints(client, {
      firmId, mandateId, dealId: deal.id,
      points: DEFAULT_POINTS.map((p) => ({ ...p, seller_position: '', buyer_position: '', agreed_text: '', state: 'open' })),
    });
    await insertCheckpoints(client, {
      firmId, mandateId, dealId: deal.id, checkpoints: DEFAULT_CHECKPOINTS,
    });
    return deal;
  });
}

export async function loadDealBundle({ firmId, mandateId }) {
  const deal = await ensureDeal({ firmId, mandateId });
  const points = await many(
    `SELECT * FROM commercial_points WHERE deal_id = $1 AND mandate_id = $2 ORDER BY sort_order`,
    [deal.id, mandateId]
  );
  const checkpoints = await many(
    `SELECT * FROM close_checkpoints WHERE deal_id = $1 AND mandate_id = $2 ORDER BY sort_order`,
    [deal.id, mandateId]
  );
  return { deal, points, checkpoints, paper: buildPaper(deal, points) };
}

export async function applyCedarSample({ firmId, mandateId, actorUserId }) {
  const deal = await ensureDeal({ firmId, mandateId });
  const updated = await withTransaction(async (client) => {
    await client.query(`DELETE FROM commercial_points WHERE deal_id = $1 AND mandate_id = $2`, [deal.id, mandateId]);
    await client.query(`DELETE FROM close_checkpoints WHERE deal_id = $1 AND mandate_id = $2`, [deal.id, mandateId]);
    const result = await client.query(
      `UPDATE deals SET
         day = $3, days_total = $4, side = $5, control = $6,
         seller = $7, buyer = $8, model = $9, operating_model = $10, invrt = $11,
         sample_key = 'cedar', state = 'open', updated_at = now()
       WHERE id = $1 AND mandate_id = $2
       RETURNING *`,
      [
        deal.id, mandateId, CEDAR.day, CEDAR.days_total, CEDAR.side, CEDAR.control,
        json(CEDAR.seller), json(CEDAR.buyer), json(CEDAR.model),
        json(CEDAR.operating_model), json(CEDAR.invrt),
      ]
    );
    await insertPoints(client, { firmId, mandateId, dealId: deal.id, points: CEDAR.points });
    await insertCheckpoints(client, { firmId, mandateId, dealId: deal.id, checkpoints: CEDAR.checkpoints });
    return result.rows[0];
  });

  await record({
    firmId, mandateId, actorUserId,
    action: 'deal.sample_loaded', entity: 'Deal', entityId: updated.id,
    detail: { sample: 'cedar', seller: CEDAR.seller.vehicle, buyer: CEDAR.buyer.name, day: CEDAR.day },
  });
  return loadDealBundle({ firmId, mandateId });
}

export async function patchDeal({ firmId, mandateId, actorUserId, day, model }) {
  const deal = await ensureDeal({ firmId, mandateId });
  const nextDay = day === undefined ? deal.day : Number(day);
  if (!Number.isInteger(nextDay) || nextDay < 1) {
    const error = new Error('Day must be a whole number of 1 or more.');
    error.status = 400;
    throw error;
  }
  const nextModel = model === undefined
    ? deal.model
    : { ...(deal.model || {}), ...(model && typeof model === 'object' ? model : {}) };

  const updated = await one(
    `UPDATE deals SET day = $3, model = $4, updated_at = now()
      WHERE id = $1 AND mandate_id = $2 AND firm_id = $5
      RETURNING *`,
    [deal.id, mandateId, nextDay, json(nextModel), firmId]
  );
  await record({
    firmId, mandateId, actorUserId,
    action: 'deal.patched', entity: 'Deal', entityId: deal.id,
    detail: { day: nextDay },
  });
  return loadDealBundle({ firmId, mandateId: updated.mandate_id });
}

export async function patchPoint({ firmId, mandateId, pointId, actorUserId, patch }) {
  const point = await one(
    `SELECT * FROM commercial_points WHERE id = $1 AND mandate_id = $2 AND firm_id = $3`,
    [pointId, mandateId, firmId]
  );
  if (!point) {
    const error = new Error('Commercial point not found.');
    error.status = 404;
    throw error;
  }

  const seller_position = patch.seller_position !== undefined ? String(patch.seller_position) : point.seller_position;
  const buyer_position = patch.buyer_position !== undefined ? String(patch.buyer_position) : point.buyer_position;
  const agreed_text = patch.agreed_text !== undefined ? String(patch.agreed_text) : point.agreed_text;
  const state = patch.state !== undefined ? String(patch.state) : point.state;

  if (!POINT_STATES.includes(state)) {
    const error = new Error('State must be open, seller, buyer, agreed or dropped.');
    error.status = 400;
    throw error;
  }
  if (state === 'agreed' && !agreed_text.trim()) {
    const error = new Error('A point cannot be marked agreed without agreed wording.');
    error.status = 400;
    throw error;
  }

  const updated = await one(
    `UPDATE commercial_points
        SET seller_position = $4, buyer_position = $5, agreed_text = $6, state = $7, updated_at = now()
      WHERE id = $1 AND mandate_id = $2 AND firm_id = $3
      RETURNING *`,
    [pointId, mandateId, firmId, seller_position, buyer_position, agreed_text, state]
  );

  const becameAgreed = point.state !== 'agreed' && state === 'agreed';
  await record({
    firmId, mandateId, actorUserId,
    action: becameAgreed ? 'deal.point_agreed' : 'deal.point_updated',
    entity: 'CommercialPoint',
    entityId: pointId,
    detail: { title: updated.title, state, previousState: point.state, blocksTermSheet: updated.blocks_term_sheet },
  });
  return loadDealBundle({ firmId, mandateId });
}

export async function toggleCheckpoint({ firmId, mandateId, checkpointId, actorUserId }) {
  const row = await one(
    `SELECT * FROM close_checkpoints WHERE id = $1 AND mandate_id = $2 AND firm_id = $3`,
    [checkpointId, mandateId, firmId]
  );
  if (!row) {
    const error = new Error('Checkpoint not found.');
    error.status = 404;
    throw error;
  }
  const updated = await one(
    `UPDATE close_checkpoints SET done = NOT done, updated_at = now()
      WHERE id = $1 AND mandate_id = $2 RETURNING *`,
    [checkpointId, mandateId]
  );
  await record({
    firmId, mandateId, actorUserId,
    action: 'deal.checkpoint_toggled', entity: 'CloseCheckpoint', entityId: checkpointId,
    detail: { title: updated.title, done: updated.done },
  });
  return loadDealBundle({ firmId, mandateId });
}
