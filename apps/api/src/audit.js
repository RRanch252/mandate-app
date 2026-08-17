import { query } from './db.js';

// Append-only by construction: this module exports a writer and a reader and no
// route anywhere calls UPDATE or DELETE on audit_events.
export async function record({ firmId, mandateId = null, actorUserId = null, action, entity, entityId = null, detail = {} }) {
  try {
    await query(
      `INSERT INTO audit_events (firm_id, mandate_id, actor_user_id, action, entity, entity_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [firmId, mandateId, actorUserId, action, entity, entityId ? String(entityId) : null, detail]
    );
  } catch (err) {
    // An audit write must never take down the action it is describing, but a silent
    // failure would be worse than a noisy one, so it is logged loudly.
    console.error(`[audit] failed to record ${action}:`, err.message);
  }
}

export function listForMandate(mandateId, limit = 200) {
  return query(
    `SELECT a.*, u.name AS actor_name
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.mandate_id = $1
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $2`,
    [mandateId, limit]
  ).then((r) => r.rows);
}
