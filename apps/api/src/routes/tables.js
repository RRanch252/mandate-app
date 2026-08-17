import { Router } from 'express';
import { many, one, query } from '../db.js';
import { record } from '../audit.js';
import { requireUser, requireMandate } from '../access.js';
import { executeRun, listCitations } from '../services/runs.js';
import { DEFAULT_QUESTIONS } from './mandates.js';

export const tableRouter = Router();
tableRouter.use(requireUser);

const stripMarkers = (text) => String(text || '').replace(/\s*\[\d+\]/g, '').trim();

async function getOrCreateTable(mandate, firmId) {
  let table = await one(`SELECT * FROM evidence_tables WHERE mandate_id = $1 ORDER BY created_at LIMIT 1`, [mandate.id]);
  if (!table) {
    table = await one(
      `INSERT INTO evidence_tables (firm_id, mandate_id, row_topics, columns) VALUES ($1, $2, $3, $4) RETURNING *`,
      [firmId, mandate.id, JSON.stringify([mandate.name]), JSON.stringify(DEFAULT_QUESTIONS)]
    );
  }
  await ensureCells(table, firmId);
  return table;
}

// Cells are materialised rather than computed so that a per-cell state, a human edit
// and a backing run id all have somewhere to live.
async function ensureCells(table, firmId) {
  const rows = (table.row_topics || []).length;
  const cols = (table.columns || []).length;
  if (!rows || !cols) return;
  const values = [];
  const params = [];
  let i = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const base = i * 5;
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`);
      params.push(firmId, table.mandate_id, table.id, r, c);
      i += 1;
    }
  }
  await query(
    `INSERT INTO evidence_cells (firm_id, mandate_id, table_id, row_index, col_index)
     VALUES ${values.join(',')}
     ON CONFLICT (table_id, row_index, col_index) DO NOTHING`,
    params
  );
}

async function loadCells(tableId) {
  const cells = await many(
    `SELECT id, row_index, col_index, state, text, run_id, updated_at
       FROM evidence_cells WHERE table_id = $1 ORDER BY row_index, col_index`,
    [tableId]
  );
  for (const cell of cells) {
    cell.citations = cell.run_id ? (await listCitations(cell.run_id)).filter((c) => c.state !== 'rejected') : [];
  }
  return cells;
}

tableRouter.get('/mandates/:mandateId/table', requireMandate(), async (req, res) => {
  const table = await getOrCreateTable(req.mandate, req.user.firm_id);
  res.json({ table, cells: await loadCells(table.id) });
});

tableRouter.put('/mandates/:mandateId/table', requireMandate(), async (req, res) => {
  const rowTopics = (req.body?.rowTopics || []).map((t) => String(t).trim()).filter(Boolean);
  const columns = (req.body?.columns || []).map((c) => String(c).trim()).filter(Boolean);
  if (!rowTopics.length || !columns.length) {
    return res.status(400).json({ error: 'The table needs at least one row topic and one question.' });
  }
  const existing = await getOrCreateTable(req.mandate, req.user.firm_id);
  const table = await one(
    `UPDATE evidence_tables SET row_topics = $2, columns = $3 WHERE id = $1 RETURNING *`,
    [existing.id, JSON.stringify(rowTopics), JSON.stringify(columns)]
  );
  // Cells outside the new shape are dropped; cells inside it keep their answers.
  await query(`DELETE FROM evidence_cells WHERE table_id = $1 AND (row_index >= $2 OR col_index >= $3)`, [
    table.id,
    rowTopics.length,
    columns.length,
  ]);
  await ensureCells(table, req.user.firm_id);
  res.json({ table, cells: await loadCells(table.id) });
});

function cellQuestion(table, cell) {
  const topic = (table.row_topics || [])[cell.row_index] || '';
  const question = (table.columns || [])[cell.col_index] || '';
  return `${question} (${topic})`;
}

async function fillCell(table, cell, req) {
  await query(`UPDATE evidence_cells SET state = 'queued', updated_at = now() WHERE id = $1`, [cell.id]);
  const run = await executeRun({
    firmId: req.user.firm_id,
    mandateId: table.mandate_id,
    question: cellQuestion(table, cell),
    userId: req.user.id,
  });
  const answered = run.state === 'answered';
  const text = answered ? stripMarkers(run.answer_text) : null;
  await query(
    `UPDATE evidence_cells
        SET state = $2, text = $3, retrieved_text = $3, run_id = $4, updated_at = now()
      WHERE id = $1`,
    [cell.id, answered ? 'filled' : 'not_in_corpus', text, run.id]
  );
}

async function finaliseTable(tableId) {
  const summary = await one(
    `SELECT count(*) FILTER (WHERE state IN ('filled', 'edited'))::int AS good,
            count(*)::int AS total
       FROM evidence_cells WHERE table_id = $1`,
    [tableId]
  );
  const state = summary.good === summary.total ? 'filled' : 'partial';
  await query(`UPDATE evidence_tables SET state = $2 WHERE id = $1`, [tableId, state]);
}

tableRouter.post('/mandates/:mandateId/table/fill', requireMandate(), async (req, res) => {
  const table = await getOrCreateTable(req.mandate, req.user.firm_id);
  const onlyEmpty = req.body?.onlyEmpty !== false;
  const targets = await many(
    `SELECT * FROM evidence_cells
      WHERE table_id = $1 ${onlyEmpty ? `AND state IN ('empty', 'not_in_corpus')` : `AND state <> 'edited'`}
      ORDER BY row_index, col_index`,
    [table.id]
  );
  if (!targets.length) return res.json({ queued: 0 });

  await query(`UPDATE evidence_tables SET state = 'filling' WHERE id = $1`, [table.id]);
  await query(
    `UPDATE evidence_cells SET state = 'queued', updated_at = now() WHERE id = ANY($1::uuid[])`,
    [targets.map((t) => t.id)]
  );

  // Answered immediately so the browser can start polling and show per-cell progress
  // rather than one blocking spinner across the whole table.
  res.json({ queued: targets.length });

  (async () => {
    for (const cell of targets) {
      try {
        await fillCell(table, cell, req);
      } catch (err) {
        console.error('[table] cell fill failed:', err.message);
        await query(`UPDATE evidence_cells SET state = 'not_in_corpus', updated_at = now() WHERE id = $1`, [cell.id]);
      }
    }
    await finaliseTable(table.id);
    await record({
      firmId: req.user.firm_id, mandateId: table.mandate_id, actorUserId: req.user.id,
      action: 'table.fill_completed', entity: 'EvidenceTable', entityId: table.id,
      detail: { cells: targets.length },
    });
  })().catch((err) => console.error('[table] fill batch failed:', err.message));
});

async function loadAccessibleCell(req) {
  return one(
    `SELECT ec.* FROM evidence_cells ec
       JOIN memberships ms ON ms.mandate_id = ec.mandate_id AND ms.user_id = $2 AND ms.state = 'active'
      WHERE ec.id = $1`,
    [req.params.cellId, req.user.id]
  );
}

tableRouter.post('/mandates/:mandateId/table/cells/:cellId/rerun', requireMandate(), async (req, res) => {
  const cell = await loadAccessibleCell(req);
  if (!cell) return res.status(404).json({ error: 'Cell not found.' });
  const table = await one(`SELECT * FROM evidence_tables WHERE id = $1`, [cell.table_id]);
  await fillCell(table, cell, req);
  await finaliseTable(table.id);
  const refreshed = (await loadCells(table.id)).find((c) => c.id === cell.id);
  res.json({ cell: refreshed });
});

tableRouter.put('/mandates/:mandateId/table/cells/:cellId', requireMandate(), async (req, res) => {
  const cell = await loadAccessibleCell(req);
  if (!cell) return res.status(404).json({ error: 'Cell not found.' });

  if (req.body?.markUnverified) {
    await query(`UPDATE evidence_cells SET state = 'unverified', updated_at = now() WHERE id = $1`, [cell.id]);
  } else {
    const text = String(req.body?.text ?? '').trim();
    // retrieved_text is left untouched so the original machine answer stays auditable
    // next to whatever the human replaced it with.
    await query(`UPDATE evidence_cells SET text = $2, state = 'edited', updated_at = now() WHERE id = $1`, [
      cell.id,
      text,
    ]);
    await record({
      firmId: cell.firm_id, mandateId: cell.mandate_id, actorUserId: req.user.id,
      action: 'cell.edited', entity: 'EvidenceCell', entityId: cell.id,
      detail: { previous: cell.text, next: text },
    });
  }

  const refreshed = (await loadCells(cell.table_id)).find((c) => c.id === cell.id);
  res.json({ cell: refreshed });
});
