import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { many, one, query } from '../db.js';
import { record } from '../audit.js';
import { requireUser, requireMandate } from '../access.js';
import { ingestBatch, ingestDocument } from '../services/ingest.js';

export const documentRouter = Router();
documentRouter.use(requireUser);

const ALLOWED = new Set(['.pdf', '.docx']);

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = path.join(config.storageDir, 'uploads', req.params.mandateId);
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    // Rejecting here rather than at ingest keeps unsupported bytes off disk entirely.
    cb(null, ALLOWED.has(ext));
  },
});

documentRouter.post(
  '/mandates/:mandateId/documents',
  requireMandate(),
  upload.array('files', 25),
  async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No PDF or DOCX files were received. Only .pdf and .docx are supported.' });
    }

    const report = await one(
      `INSERT INTO ingest_reports (firm_id, mandate_id) VALUES ($1, $2) RETURNING *`,
      [req.user.firm_id, req.mandate.id]
    );

    const docs = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
      const doc = await one(
        `INSERT INTO documents (firm_id, mandate_id, ingest_report_id, filename, ext, byte_size, storage_path, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [req.user.firm_id, req.mandate.id, report.id, file.originalname, ext, file.size, file.path, req.user.id]
      );
      docs.push(doc);
      await record({
        firmId: req.user.firm_id, mandateId: req.mandate.id, actorUserId: req.user.id,
        action: 'document.uploaded', entity: 'Document', entityId: doc.id,
        detail: { filename: doc.filename, bytes: file.size },
      });
    }

    // Respond immediately; the browser polls the document list for state changes.
    res.status(202).json({ ingestReportId: report.id, documents: docs });

    ingestBatch(docs, report.id, req.user.id).catch((err) =>
      console.error('[ingest] batch failed:', err.message)
    );
  }
);

documentRouter.get('/mandates/:mandateId/documents', requireMandate(), async (req, res) => {
  const documents = await many(
    `SELECT d.id, d.filename, d.ext, d.state, d.error, d.page_count, d.byte_size, d.created_at,
            (SELECT count(*)::int FROM document_chunks c WHERE c.document_id = d.id AND c.state = 'indexed') AS chunk_count
       FROM documents d
      WHERE d.mandate_id = $1 AND d.state <> 'deleted'
      ORDER BY d.created_at DESC`,
    [req.mandate.id]
  );
  res.json({ documents });
});

// Loads a document only if the caller holds an active membership on its mandate.
async function loadAccessibleDocument(req) {
  return one(
    `SELECT d.* FROM documents d
       JOIN memberships ms
         ON ms.mandate_id = d.mandate_id AND ms.user_id = $2 AND ms.state = 'active'
      WHERE d.id = $1 AND d.firm_id = $3 AND d.state <> 'deleted'`,
    [req.params.documentId, req.user.id, req.user.firm_id]
  );
}

documentRouter.post('/documents/:documentId/retry', async (req, res) => {
  const doc = await loadAccessibleDocument(req);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  await query(`DELETE FROM document_chunks WHERE document_id = $1`, [doc.id]);
  res.status(202).json({ ok: true });
  ingestDocument(doc, req.user.id).catch((err) => console.error('[ingest] retry failed:', err.message));
});

// Backs the "open source" link on a citation. PDFs are served inline so the browser's
// viewer can jump to #page=N; DOCX downloads because browsers cannot deep-link into it.
documentRouter.get('/documents/:documentId/file', async (req, res) => {
  const doc = await loadAccessibleDocument(req);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  if (!existsSync(doc.storage_path)) return res.status(410).json({ error: 'The stored file is missing.' });

  if (doc.ext === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.filename)}"`);
    return res.sendFile(path.resolve(doc.storage_path));
  }
  return res.download(path.resolve(doc.storage_path), doc.filename);
});
