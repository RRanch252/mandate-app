import { Router } from 'express';
import { many, one } from '../db.js';
import { SESSION_COOKIE } from '../access.js';
import { hasLlm, config } from '../config.js';

export const sessionRouter = Router();

sessionRouter.get('/session', async (req, res) => {
  const users = await many(`SELECT id, name, email FROM users WHERE state = 'active' ORDER BY name`);
  res.json({
    user: req.user,
    users,
    answerMode: hasLlm() ? 'generative' : 'extractive',
    model: hasLlm() ? config.openaiModel : 'extractive (no external model configured)',
  });
});

sessionRouter.post('/session', async (req, res) => {
  const user = await one(`SELECT * FROM users WHERE id = $1 AND state = 'active'`, [req.body?.userId]);
  if (!user) return res.status(400).json({ error: 'Unknown user.' });
  res.cookie(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: 'lax' });
  res.json({ user });
});

sessionRouter.delete('/session', (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});
