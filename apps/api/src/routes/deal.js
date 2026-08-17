import { Router } from 'express';
import { requireUser, requireMandate } from '../access.js';
import {
  applyCedarSample,
  loadDealBundle,
  patchDeal,
  patchPoint,
  toggleCheckpoint,
} from '../services/deal.js';

export const dealRouter = Router();
dealRouter.use(requireUser);

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[deal]', err);
  return res.status(status).json({ error: err.message || 'Something went wrong.' });
}

dealRouter.get('/mandates/:mandateId/deal', requireMandate(), async (req, res) => {
  try {
    res.json(await loadDealBundle({ firmId: req.user.firm_id, mandateId: req.mandate.id }));
  } catch (err) {
    sendError(res, err);
  }
});

dealRouter.post('/mandates/:mandateId/deal/sample', requireMandate(), async (req, res) => {
  const sample = String(req.body?.sample || '').trim().toLowerCase();
  if (sample !== 'cedar') {
    return res.status(400).json({ error: 'Unknown sample. Use { "sample": "cedar" }.' });
  }
  try {
    res.json(await applyCedarSample({
      firmId: req.user.firm_id,
      mandateId: req.mandate.id,
      actorUserId: req.user.id,
    }));
  } catch (err) {
    sendError(res, err);
  }
});

dealRouter.patch('/mandates/:mandateId/deal', requireMandate(), async (req, res) => {
  try {
    res.json(await patchDeal({
      firmId: req.user.firm_id,
      mandateId: req.mandate.id,
      actorUserId: req.user.id,
      day: req.body?.day,
      model: req.body?.model,
    }));
  } catch (err) {
    sendError(res, err);
  }
});

dealRouter.patch('/mandates/:mandateId/deal/points/:pointId', requireMandate(), async (req, res) => {
  try {
    res.json(await patchPoint({
      firmId: req.user.firm_id,
      mandateId: req.mandate.id,
      pointId: req.params.pointId,
      actorUserId: req.user.id,
      patch: req.body || {},
    }));
  } catch (err) {
    sendError(res, err);
  }
});

dealRouter.post('/mandates/:mandateId/deal/checkpoints/:checkpointId/toggle', requireMandate(), async (req, res) => {
  try {
    res.json(await toggleCheckpoint({
      firmId: req.user.firm_id,
      mandateId: req.mandate.id,
      checkpointId: req.params.checkpointId,
      actorUserId: req.user.id,
    }));
  } catch (err) {
    sendError(res, err);
  }
});
