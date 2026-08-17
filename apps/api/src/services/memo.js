import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { many, one } from '../db.js';
import { runPython } from '../python.js';
import { listCitations, listRuns } from './runs.js';

// Run-local markers ([1], [2] within one answer) are stripped and reassigned so the
// memo has one continuous numbering that matches its appendix.
const stripMarkers = (text) => String(text || '').replace(/\s*\[\d+\]/g, '').trim();

export async function buildMemoPayload({ mandate, table, title, generatedBy, approvedBy = null }) {
  const appendix = [];
  const markerByChunk = new Map();

  function markerFor(citation) {
    if (!markerByChunk.has(citation.chunk_id)) {
      const marker = appendix.length + 1;
      markerByChunk.set(citation.chunk_id, marker);
      appendix.push({
        marker,
        document: citation.filename,
        locator: citation.locator,
        quote: citation.quote,
      });
    }
    return markerByChunk.get(citation.chunk_id);
  }

  async function markersForRun(runId) {
    if (!runId) return [];
    const citations = await listCitations(runId);
    // A rejected citation never reaches the export. FEAT-003 requires that it can
    // only come back by being replaced, which creates a new proposed citation.
    return citations.filter((c) => c.state !== 'rejected').map(markerFor);
  }

  const sections = [];
  let answerModes = new Set();

  if (table) {
    const cells = await many(
      `SELECT ec.*, r.answer_mode, r.model_provider, r.model_version
         FROM evidence_cells ec
         LEFT JOIN research_runs r ON r.id = ec.run_id
        WHERE ec.table_id = $1
        ORDER BY ec.row_index, ec.col_index`,
      [table.id]
    );
    const byPosition = new Map(cells.map((c) => [`${c.row_index}:${c.col_index}`, c]));
    const topics = table.row_topics || [];
    const columns = table.columns || [];

    for (let r = 0; r < topics.length; r += 1) {
      const rows = [];
      for (let c = 0; c < columns.length; c += 1) {
        const cell = byPosition.get(`${r}:${c}`);
        const status = cell?.state || 'empty';
        const markers = status === 'not_in_corpus' ? [] : await markersForRun(cell?.run_id);
        if (cell?.answer_mode) answerModes.add(cell.answer_mode);
        rows.push({
          question: columns[c],
          answer: stripMarkers(cell?.text),
          status,
          markers,
        });
      }
      sections.push({ heading: topics[r], rows });
    }
  }

  const qa = [];
  for (const run of await listRuns(mandate.id, { standaloneOnly: true, limit: 50 })) {
    if (!['answered', 'no_evidence'].includes(run.state)) continue;
    if (run.answer_mode) answerModes.add(run.answer_mode);
    qa.push({
      question: run.question,
      answer: stripMarkers(run.answer_text),
      not_in_corpus: run.state === 'no_evidence',
      markers: run.state === 'no_evidence' ? [] : await markersForRun(run.id),
    });
  }

  const modeLabel = answerModes.size
    ? [...answerModes].sort().join(' + ')
    : 'extractive';

  return {
    title,
    mandate_name: mandate.name,
    client_label: mandate.client_label,
    generated_by: generatedBy,
    approved_by: approvedBy,
    generated_at: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    model: modeLabel === 'extractive' ? 'extractive — source text quoted verbatim' : modeLabel,
    sections,
    qa,
    appendix,
  };
}

export async function renderDocx(memoId, payload) {
  const dir = path.join(config.storageDir, 'memos');
  await mkdir(dir, { recursive: true });
  const outPath = path.join(dir, `${memoId}.docx`);
  const result = await runPython('export_docx.py', { out_path: outPath, memo: payload });
  if (!result.ok) throw new Error(result.error || 'Word export failed');
  return outPath;
}

export function getTable(mandateId) {
  return one(`SELECT * FROM evidence_tables WHERE mandate_id = $1 ORDER BY created_at ASC LIMIT 1`, [mandateId]);
}
