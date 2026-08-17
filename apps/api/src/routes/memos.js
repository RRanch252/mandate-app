import { Router } from 'express';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { many, one, query } from '../db.js';
import { record } from '../audit.js';
import { requireUser, requireMandate, atLeast } from '../access.js';
import { buildMemoPayload, renderDocx, getTable } from '../services/memo.js';

export const memoRouter = Router();
memoRouter.use(requireUser);

memoRouter.get('/mandates/:mandateId/memos', requireMandate(), async (req, res) => {
  const memos = await many(
    `SELECT m.id, m.title, m.state, m.rejection_reason, m.download_token, m.created_at, m.updated_at,
            g.name AS generated_by_name, a.name AS approved_by_name
       FROM briefing_memos m
       LEFT JOIN users g ON g.id = m.generated_by
       LEFT JOIN users a ON a.id = m.approved_by
      WHERE m.mandate_id = $1
      ORDER BY m.created_at DESC`,
    [req.mandate.id]
  );
  res.json({ memos, role: req.role });
});

memoRouter.post('/mandates/:mandateId/memos', requireMandate(), async (req, res) => {
  const table = await getTable(req.mandate.id);
  const filled = await one(
    `SELECT count(*)::int AS n FROM evidence_cells
      WHERE mandate_id = $1 AND state <> 'empty'`,
    [req.mandate.id]
  );
  const answered = await one(
    `SELECT count(*)::int AS n FROM research_runs WHERE mandate_id = $1 AND state = 'answered'`,
    [req.mandate.id]
  );
  if (!filled.n && !answered.n) {
    return res.status(400).json({
      error: 'There is nothing to write up yet. Fill the evidence table or ask a question first.',
    });
  }

  const title = String(req.body?.title || '').trim() || `${req.mandate.name} — briefing memo`;

  const memo = await one(
    `INSERT INTO briefing_memos (firm_id, mandate_id, table_id, title, state, generated_by)
     VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING *`,
    [req.user.firm_id, req.mandate.id, table?.id || null, title, req.user.id]
  );

  try {
    const payload = await buildMemoPayload({
      mandate: req.mandate,
      table,
      title,
      generatedBy: req.user.name,
    });
    const docxPath = await renderDocx(memo.id, payload);
    const updated = await one(
      `UPDATE briefing_memos SET state = 'generated', payload = $2, docx_path = $3, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [memo.id, JSON.stringify(payload), docxPath]
    );
    await record({
      firmId: req.user.firm_id, mandateId: req.mandate.id, actorUserId: req.user.id,
      action: 'memo.generated', entity: 'BriefingMemo', entityId: memo.id,
      detail: { title, citations: payload.appendix.length, answerMode: payload.model },
    });
    res.status(201).json({ memo: updated, payload });
  } catch (err) {
    await query(`UPDATE briefing_memos SET rejection_reason = $2 WHERE id = $1`, [memo.id, err.message]);
    res.status(500).json({ error: `Could not build the Word document: ${err.message}` });
  }
});

async function loadAccessibleMemo(req) {
  return one(
    `SELECT m.*, ms.role AS member_role, u.name AS generated_by_name, a.name AS approved_by_name
       FROM briefing_memos m
       JOIN memberships ms ON ms.mandate_id = m.mandate_id AND ms.user_id = $2 AND ms.state = 'active'
       LEFT JOIN users u ON u.id = m.generated_by
       LEFT JOIN users a ON a.id = m.approved_by
      WHERE m.id = $1`,
    [req.params.memoId, req.user.id]
  );
}

memoRouter.get('/memos/:memoId', async (req, res) => {
  const memo = await loadAccessibleMemo(req);
  if (!memo) return res.status(404).json({ error: 'Memo not found.' });
  res.json({ memo, canApprove: atLeast(memo.member_role, 'lead') });
});

memoRouter.post('/memos/:memoId/submit', async (req, res) => {
  const memo = await loadAccessibleMemo(req);
  if (!memo) return res.status(404).json({ error: 'Memo not found.' });
  if (memo.state !== 'generated') {
    return res.status(409).json({ error: `A memo can only be sent for approval from the generated state (this one is ${memo.state}).` });
  }
  const updated = await one(
    `UPDATE briefing_memos SET state = 'pending_approval', updated_at = now() WHERE id = $1 RETURNING *`,
    [memo.id]
  );
  await record({
    firmId: memo.firm_id, mandateId: memo.mandate_id, actorUserId: req.user.id,
    action: 'memo.approval_requested', entity: 'BriefingMemo', entityId: memo.id, detail: {},
  });
  res.json({ memo: updated });
});

memoRouter.post('/memos/:memoId/approve', async (req, res) => {
  const memo = await loadAccessibleMemo(req);
  if (!memo) return res.status(404).json({ error: 'Memo not found.' });
  if (!atLeast(memo.member_role, 'lead')) {
    return res.status(403).json({ error: 'Only a lead or partner on this mandate can approve an export.' });
  }
  if (memo.state !== 'pending_approval') {
    return res.status(409).json({ error: `Only a memo awaiting approval can be approved (this one is ${memo.state}).` });
  }

  // Re-render from the frozen payload so the approver's name is written into the file
  // itself, not just into the audit log.
  const payload = { ...memo.payload, approved_by: req.user.name };
  const docxPath = await renderDocx(memo.id, payload);
  const token = randomUUID();

  const updated = await one(
    `UPDATE briefing_memos
        SET state = 'approved', approved_by = $2, download_token = $3, payload = $4, docx_path = $5, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [memo.id, req.user.id, token, JSON.stringify(payload), docxPath]
  );

  await record({
    firmId: memo.firm_id, mandateId: memo.mandate_id, actorUserId: req.user.id,
    action: 'memo.approved', entity: 'BriefingMemo', entityId: memo.id,
    detail: { approver: req.user.name, generatedBy: memo.generated_by_name, model: memo.payload?.model },
  });

  res.json({ memo: updated });
});

memoRouter.post('/memos/:memoId/reject', async (req, res) => {
  const memo = await loadAccessibleMemo(req);
  if (!memo) return res.status(404).json({ error: 'Memo not found.' });
  if (!atLeast(memo.member_role, 'lead')) {
    return res.status(403).json({ error: 'Only a lead or partner on this mandate can reject a memo.' });
  }
  if (memo.state !== 'pending_approval') {
    return res.status(409).json({ error: 'Only a memo awaiting approval can be rejected.' });
  }
  const updated = await one(
    `UPDATE briefing_memos SET state = 'rejected', rejection_reason = $2, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [memo.id, String(req.body?.reason || '').trim() || 'No reason given.']
  );
  await record({
    firmId: memo.firm_id, mandateId: memo.mandate_id, actorUserId: req.user.id,
    action: 'memo.rejected', entity: 'BriefingMemo', entityId: memo.id,
    detail: { reason: updated.rejection_reason },
  });
  res.json({ memo: updated });
});

// The approval gate. This route re-reads state from the database on every request, so
// hiding the download button in the UI is a convenience, not the control.
memoRouter.get('/memos/:memoId/download', async (req, res) => {
  const memo = await loadAccessibleMemo(req);
  if (!memo) return res.status(404).json({ error: 'Memo not found.' });

  if (!['approved', 'exported'].includes(memo.state)) {
    return res.status(403).json({
      error: `This memo has not been approved yet (state: ${memo.state}). A lead or partner must approve it before it can be downloaded.`,
    });
  }
  if (!memo.download_token || req.query.token !== memo.download_token) {
    return res.status(403).json({ error: 'Invalid or missing download token.' });
  }
  if (!memo.docx_path || !existsSync(memo.docx_path)) {
    return res.status(410).json({ error: 'The generated file is missing. Regenerate the memo.' });
  }

  await query(`UPDATE briefing_memos SET state = 'exported', updated_at = now() WHERE id = $1`, [memo.id]);
  await record({
    firmId: memo.firm_id, mandateId: memo.mandate_id, actorUserId: req.user.id,
    action: 'memo.exported', entity: 'BriefingMemo', entityId: memo.id,
    detail: { approver: memo.approved_by_name, model: memo.payload?.model },
  });

  const safeName = `${memo.title.replace(/[^\w \-.]+/g, '')}.docx`.trim();
  res.download(path.resolve(memo.docx_path), safeName);
});
