import { Router } from 'express';
import { many, one, query } from '../db.js';
import { record, listForMandate } from '../audit.js';
import { requireUser, requireMandate, requireRole } from '../access.js';
import { ensureDeal } from '../services/deal.js';

export const mandateRouter = Router();

// The starting column set for a new mandate's evidence table. Editable per mandate.
export const DEFAULT_QUESTIONS = [
  'What does the business do and what does it sell?',
  'What is revenue and how has it grown?',
  'Who are the customers and is there customer concentration?',
  'What are the margins or profitability?',
  'Who are the competitors?',
  'What are the key risks?',
];

mandateRouter.use(requireUser);

mandateRouter.get('/mandates', async (req, res) => {
  const rows = await many(
    `SELECT m.*, ms.role AS member_role,
            (SELECT count(*) FROM documents d WHERE d.mandate_id = m.id AND d.state = 'indexed') AS indexed_documents
       FROM mandates m
       JOIN memberships ms ON ms.mandate_id = m.id AND ms.user_id = $1 AND ms.state = 'active'
      WHERE m.firm_id = $2
      ORDER BY m.created_at DESC`,
    [req.user.id, req.user.firm_id]
  );
  res.json({ mandates: rows });
});

mandateRouter.post('/mandates', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'A mandate needs a name.' });

  const mandate = await one(
    `INSERT INTO mandates (firm_id, name, client_label, restricted, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.firm_id, name, String(req.body?.clientLabel || '').trim(), Boolean(req.body?.restricted), req.user.id]
  );

  // The creator becomes a partner so that someone can approve an export from the
  // moment the mandate exists. Everyone else has to be added deliberately.
  await query(
    `INSERT INTO memberships (firm_id, mandate_id, user_id, role) VALUES ($1, $2, $3, 'partner')`,
    [req.user.firm_id, mandate.id, req.user.id]
  );

  await one(
    `INSERT INTO evidence_tables (firm_id, mandate_id, row_topics, columns)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [req.user.firm_id, mandate.id, JSON.stringify([name]), JSON.stringify(DEFAULT_QUESTIONS)]
  );

  await ensureDeal({ firmId: req.user.firm_id, mandateId: mandate.id });

  await record({
    firmId: req.user.firm_id, mandateId: mandate.id, actorUserId: req.user.id,
    action: 'mandate.created', entity: 'Mandate', entityId: mandate.id,
    detail: { name, restricted: mandate.restricted },
  });

  res.status(201).json({ mandate: { ...mandate, member_role: 'partner' } });
});

mandateRouter.get('/mandates/:mandateId', requireMandate(), async (req, res) => {
  const documents = await many(
    `SELECT id, filename, ext, state, error, page_count, byte_size, created_at
       FROM documents WHERE mandate_id = $1 AND state <> 'deleted' ORDER BY created_at DESC`,
    [req.mandate.id]
  );
  const members = await listMembers(req.mandate.id);
  res.json({ mandate: req.mandate, role: req.role, documents, members });
});

async function listMembers(mandateId) {
  return many(
    `SELECT ms.id, ms.role, ms.state, u.id AS user_id, u.name, u.email
       FROM memberships ms JOIN users u ON u.id = ms.user_id
      WHERE ms.mandate_id = $1 ORDER BY u.name`,
    [mandateId]
  );
}

mandateRouter.post('/mandates/:mandateId/members', requireMandate(), requireRole('partner'), async (req, res) => {
  const { userId, role } = req.body || {};
  if (!['analyst', 'lead', 'partner', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be analyst, lead, partner or admin.' });
  }
  const user = await one(`SELECT * FROM users WHERE id = $1 AND firm_id = $2`, [userId, req.user.firm_id]);
  if (!user) return res.status(400).json({ error: 'Unknown firm user.' });

  await query(
    `INSERT INTO memberships (firm_id, mandate_id, user_id, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (mandate_id, user_id) DO UPDATE SET role = EXCLUDED.role, state = 'active'`,
    [req.user.firm_id, req.mandate.id, userId, role]
  );
  await record({
    firmId: req.user.firm_id, mandateId: req.mandate.id, actorUserId: req.user.id,
    action: 'membership.granted', entity: 'Membership', entityId: userId, detail: { role, user: user.name },
  });
  res.json({ members: await listMembers(req.mandate.id) });
});

mandateRouter.post('/mandates/:mandateId/members/:membershipId/revoke', requireMandate(), requireRole('partner'), async (req, res) => {
  const remaining = await one(
    `SELECT count(*)::int AS n FROM memberships
      WHERE mandate_id = $1 AND state = 'active' AND role IN ('partner', 'admin') AND id <> $2`,
    [req.mandate.id, req.params.membershipId]
  );
  if (!remaining || remaining.n < 1) {
    return res.status(400).json({ error: 'A mandate must keep at least one active partner or admin.' });
  }
  await query(`UPDATE memberships SET state = 'revoked' WHERE id = $1 AND mandate_id = $2`, [
    req.params.membershipId,
    req.mandate.id,
  ]);
  await record({
    firmId: req.user.firm_id, mandateId: req.mandate.id, actorUserId: req.user.id,
    action: 'membership.revoked', entity: 'Membership', entityId: req.params.membershipId, detail: {},
  });
  res.json({ members: await listMembers(req.mandate.id) });
});

mandateRouter.get('/mandates/:mandateId/audit', requireMandate(), async (req, res) => {
  res.json({ events: await listForMandate(req.mandate.id) });
});
