import { one } from './db.js';

export const SESSION_COOKIE = 'mandate_uid';

// MVP identity is a local user picker, not authentication. What is real here is
// authorisation: membership and role are checked on every mandate-scoped request
// and enforced in the API rather than in the UI. See the openDecisions note in
// product/entity-contract.json before this is exposed beyond one trusted machine.
export async function loadUser(req, _res, next) {
  const userId = req.cookies?.[SESSION_COOKIE];
  req.user = null;
  if (userId) {
    try {
      req.user = await one(
        `SELECT u.*, f.name AS firm_name
           FROM users u JOIN firms f ON f.id = u.firm_id
          WHERE u.id = $1 AND u.state = 'active'`,
        [userId]
      );
    } catch {
      req.user = null; // a malformed cookie is treated as signed out, not as an error
    }
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in as a firm user first.' });
  next();
}

const ROLE_RANK = { analyst: 1, lead: 2, partner: 3, admin: 4 };

export function atLeast(role, minimum) {
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[minimum] || 99);
}

// Non-members get 404, never 403. A 403 would confirm that a mandate with this id
// exists, which FEAT-001 explicitly forbids.
export function requireMandate(paramName = 'mandateId') {
  return async (req, res, next) => {
    const mandateId = req.params[paramName];
    if (!req.user) return res.status(401).json({ error: 'Sign in as a firm user first.' });
    try {
      const row = await one(
        `SELECT m.*, ms.role AS member_role, ms.id AS membership_id
           FROM mandates m
           JOIN memberships ms
             ON ms.mandate_id = m.id AND ms.user_id = $2 AND ms.state = 'active'
          WHERE m.id = $1 AND m.firm_id = $3`,
        [mandateId, req.user.id, req.user.firm_id]
      );
      if (!row) return res.status(404).json({ error: 'Mandate not found.' });
      req.mandate = row;
      req.role = row.member_role;
      next();
    } catch {
      return res.status(404).json({ error: 'Mandate not found.' });
    }
  };
}

export function requireRole(minimum) {
  return (req, res, next) => {
    if (!atLeast(req.role, minimum)) {
      return res.status(403).json({ error: `This action needs the ${minimum} role or above on this mandate.` });
    }
    next();
  };
}
