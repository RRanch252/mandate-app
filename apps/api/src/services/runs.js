import { many, one, query } from '../db.js';
import { record } from '../audit.js';
import { retrieve, locatorLabel } from '../retrieval.js';
import { answerQuestion } from '../answer.js';

/**
 * Executes one question against one mandate corpus, moving the ResearchRun through
 * the states declared in product/entity-contract.json. A retrieval miss ends in
 * no_evidence, which is a success path: it is how the system says "the documents do
 * not answer this" instead of producing a number.
 */
export async function executeRun({ firmId, mandateId, question, userId }) {
  const run = await one(
    `INSERT INTO research_runs (firm_id, mandate_id, question, state, created_by)
     VALUES ($1, $2, $3, 'queued', $4) RETURNING *`,
    [firmId, mandateId, question, userId]
  );

  await record({
    firmId, mandateId, actorUserId: userId,
    action: 'run.start', entity: 'ResearchRun', entityId: run.id,
    detail: { question },
  });

  try {
    await query(`UPDATE research_runs SET state = 'retrieving' WHERE id = $1`, [run.id]);
    const { chunks } = await retrieve({ firmId, mandateId, question });

    await query(`UPDATE research_runs SET retrieved_chunk_ids = $2 WHERE id = $1`, [
      run.id,
      JSON.stringify(chunks.map((c) => c.id)),
    ]);

    if (chunks.length) {
      await query(`UPDATE research_runs SET state = 'answering' WHERE id = $1`, [run.id]);
    }

    const result = await answerQuestion({ question, chunks });

    await query(
      `UPDATE research_runs
          SET state = $2, answer_text = $3, answer_mode = $4,
              model_provider = $5, model_version = $6, completed_at = now()
        WHERE id = $1`,
      [run.id, result.state, result.answerText, result.answerMode, result.modelProvider, result.modelVersion]
    );

    for (const citation of result.citations) {
      await query(
        `INSERT INTO citations (firm_id, mandate_id, run_id, chunk_id, marker, quote)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [firmId, mandateId, run.id, citation.chunkId, citation.marker, citation.quote]
      );
    }

    await record({
      firmId, mandateId, actorUserId: userId,
      action: result.state === 'answered' ? 'run.answered' : 'run.no_evidence',
      entity: 'ResearchRun', entityId: run.id,
      detail: {
        answerMode: result.answerMode,
        modelProvider: result.modelProvider,
        modelVersion: result.modelVersion,
        retrievedChunkIds: chunks.map((c) => c.id),
        citationCount: result.citations.length,
        note: result.note,
      },
    });

    return { ...(await getRun(run.id)), note: result.note };
  } catch (err) {
    await query(`UPDATE research_runs SET state = 'failed', error = $2, completed_at = now() WHERE id = $1`, [
      run.id,
      err.message,
    ]);
    await record({
      firmId, mandateId, actorUserId: userId,
      action: 'run.failed', entity: 'ResearchRun', entityId: run.id,
      detail: { error: err.message },
    });
    return getRun(run.id);
  }
}

export async function getRun(runId) {
  const run = await one(`SELECT * FROM research_runs WHERE id = $1`, [runId]);
  if (!run) return null;
  run.citations = await listCitations(runId);
  return run;
}

export function listCitations(runId) {
  return many(
    `SELECT ct.id, ct.marker, ct.quote, ct.state, ct.chunk_id,
            c.page, c.section, c.para_index, c.locator_kind, c.ordinal, c.text AS chunk_text,
            d.id AS document_id, d.filename, d.ext
       FROM citations ct
       JOIN document_chunks c ON c.id = ct.chunk_id
       JOIN documents d ON d.id = c.document_id
      WHERE ct.run_id = $1
      ORDER BY ct.marker ASC`,
    [runId]
  ).then((rows) => rows.map((r) => ({ ...r, locator: locatorLabel(r) })));
}

export function listRuns(mandateId, { standaloneOnly = false, limit = 100 } = {}) {
  const filter = standaloneOnly
    ? `AND NOT EXISTS (SELECT 1 FROM evidence_cells ec WHERE ec.run_id = r.id)`
    : '';
  return many(
    `SELECT r.* FROM research_runs r
      WHERE r.mandate_id = $1 ${filter}
      ORDER BY r.created_at DESC
      LIMIT $2`,
    [mandateId, limit]
  );
}
