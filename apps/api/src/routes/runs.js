import { Router } from 'express';
import { many, one, query } from '../db.js';
import { record } from '../audit.js';
import { requireUser, requireMandate } from '../access.js';
import { executeRun, getRun, listRuns } from '../services/runs.js';

export const runRouter = Router();
runRouter.use(requireUser);

runRouter.post('/mandates/:mandateId/runs', requireMandate(), async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Type a question first.' });

  const indexed = await one(
    `SELECT count(*)::int AS n FROM documents WHERE mandate_id = $1 AND state = 'indexed'`,
    [req.mandate.id]
  );
  if (!indexed.n) {
    return res.status(400).json({ error: 'Upload and index at least one document before asking a question.' });
  }

  const run = await executeRun({
    firmId: req.user.firm_id,
    mandateId: req.mandate.id,
    question,
    userId: req.user.id,
  });
  res.json({ run });
});

runRouter.get('/mandates/:mandateId/runs', requireMandate(), async (req, res) => {
  const runs = await listRuns(req.mandate.id, { standaloneOnly: true, limit: 50 });
  res.json({ runs });
});

// Citation state changes are scoped by a membership join so a run id alone is not
// enough to mutate someone else's mandate.
async function loadAccessibleCitation(req) {
  return one(
    `SELECT ct.* FROM citations ct
       JOIN memberships ms
         ON ms.mandate_id = ct.mandate_id AND ms.user_id = $2 AND ms.state = 'active'
      WHERE ct.id = $1`,
    [req.params.citationId, req.user.id]
  );
}

runRouter.get('/runs/:runId', async (req, res) => {
  const allowed = await one(
    `SELECT r.id FROM research_runs r
       JOIN memberships ms
         ON ms.mandate_id = r.mandate_id AND ms.user_id = $2 AND ms.state = 'active'
      WHERE r.id = $1`,
    [req.params.runId, req.user.id]
  );
  if (!allowed) return res.status(404).json({ error: 'Run not found.' });
  res.json({ run: await getRun(req.params.runId) });
});

for (const [action, nextState] of [['reject', 'rejected'], ['accept', 'accepted']]) {
  runRouter.post(`/citations/:citationId/${action}`, async (req, res) => {
    const citation = await loadAccessibleCitation(req);
    if (!citation) return res.status(404).json({ error: 'Citation not found.' });

    await query(`UPDATE citations SET state = $2 WHERE id = $1`, [citation.id, nextState]);

    if (nextState === 'rejected') {
      // A rejected source invalidates any memo that is waiting to be approved, so the
      // approver never signs off a pack that has changed underneath them.
      await query(
        `UPDATE briefing_memos SET state = 'draft', updated_at = now()
          WHERE mandate_id = $1 AND state = 'pending_approval'`,
        [citation.mandate_id]
      );
    }

    await record({
      firmId: citation.firm_id, mandateId: citation.mandate_id, actorUserId: req.user.id,
      action: `citation.${action}ed`, entity: 'Citation', entityId: citation.id,
      detail: { runId: citation.run_id, marker: citation.marker },
    });

    res.json({ citation: await one(`SELECT * FROM citations WHERE id = $1`, [citation.id]) });
  });
}
