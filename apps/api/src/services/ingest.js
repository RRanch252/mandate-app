import { query } from '../db.js';
import { record } from '../audit.js';
import { runPython } from '../python.js';

const INSERT_BATCH = 200;

async function insertChunks(doc, chunks) {
  for (let start = 0; start < chunks.length; start += INSERT_BATCH) {
    const batch = chunks.slice(start, start + INSERT_BATCH);
    const values = [];
    const params = [];
    batch.forEach((chunk, i) => {
      const base = i * 9;
      values.push(
        `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`
      );
      params.push(
        doc.firm_id,
        doc.mandate_id,
        doc.id,
        chunk.ordinal,
        chunk.text,
        chunk.locator_kind,
        chunk.page ?? null,
        chunk.section ?? null,
        chunk.para_index ?? null
      );
    });
    await query(
      `INSERT INTO document_chunks
         (firm_id, mandate_id, document_id, ordinal, text, locator_kind, page, section, para_index)
       VALUES ${values.join(',')}`,
      params
    );
  }
}

/**
 * Parse one uploaded file into citable chunks. A failure here is recorded against the
 * document and its ingest report and then swallowed, because FEAT-002 requires that
 * one corrupt file does not stop the rest of the batch.
 */
export async function ingestDocument(doc, actorUserId) {
  await query(`UPDATE documents SET state = 'parsing' WHERE id = $1`, [doc.id]);

  const result = await runPython('ingest.py', { path: doc.storage_path, ext: doc.ext });

  if (!result.ok || !Array.isArray(result.chunks) || !result.chunks.length) {
    const error = result.error || 'the parser returned no text';
    await query(`UPDATE documents SET state = 'failed', error = $2 WHERE id = $1`, [doc.id, error]);
    await record({
      firmId: doc.firm_id, mandateId: doc.mandate_id, actorUserId,
      action: 'document.ingest_failed', entity: 'Document', entityId: doc.id,
      detail: { filename: doc.filename, error },
    });
    return { ok: false, error };
  }

  try {
    await insertChunks(doc, result.chunks);
    await query(`UPDATE documents SET state = 'indexed', page_count = $2, error = NULL WHERE id = $1`, [
      doc.id,
      result.page_count ?? null,
    ]);
    await record({
      firmId: doc.firm_id, mandateId: doc.mandate_id, actorUserId,
      action: 'document.indexed', entity: 'Document', entityId: doc.id,
      detail: { filename: doc.filename, chunks: result.chunks.length, pageCount: result.page_count ?? null },
    });
    return { ok: true, chunks: result.chunks.length };
  } catch (err) {
    await query(`UPDATE documents SET state = 'failed', error = $2 WHERE id = $1`, [doc.id, err.message]);
    await record({
      firmId: doc.firm_id, mandateId: doc.mandate_id, actorUserId,
      action: 'document.ingest_failed', entity: 'Document', entityId: doc.id,
      detail: { filename: doc.filename, error: err.message },
    });
    return { ok: false, error: err.message };
  }
}

export async function ingestBatch(docs, reportId, actorUserId) {
  for (const doc of docs) {
    await ingestDocument(doc, actorUserId);
  }
  if (reportId) {
    await query(`UPDATE ingest_reports SET state = 'complete', completed_at = now() WHERE id = $1`, [reportId]);
  }
}
