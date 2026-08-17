import express from 'express';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'node:fs';
import { config, hasLlm } from './config.js';
import { loadUser } from './access.js';
import { query, pool } from './db.js';
import { sessionRouter } from './routes/session.js';
import { mandateRouter } from './routes/mandates.js';
import { documentRouter } from './routes/documents.js';
import { runRouter } from './routes/runs.js';
import { tableRouter } from './routes/tables.js';
import { memoRouter } from './routes/memos.js';
import { dealRouter } from './routes/deal.js';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(loadUser);

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, answerMode: hasLlm() ? 'generative' : 'extractive' });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

app.use('/api', sessionRouter);
app.use('/api', mandateRouter);
app.use('/api', documentRouter);
app.use('/api', runRouter);
app.use('/api', tableRouter);
app.use('/api', memoRouter);
app.use('/api', dealRouter);

app.use(express.static(config.webDir));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `That file is larger than the ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB limit.` });
  }
  console.error('[api]', err);
  res.status(500).json({ error: err?.message || 'Something went wrong.' });
});

async function verifyDatabase() {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('firms', 'mandates', 'document_chunks', 'briefing_memos', 'deals')`
  );
  if (rows[0].n < 5) {
    throw new Error('the database is reachable but the tables are missing — run: npm run db:migrate');
  }
  const { rows: firms } = await query(`SELECT count(*)::int AS n FROM firms`);
  if (!firms[0].n) {
    throw new Error('no firm has been seeded — run: npm run db:seed');
  }
}

async function main() {
  mkdirSync(config.storageDir, { recursive: true });
  try {
    await verifyDatabase();
  } catch (err) {
    console.error(`\nCannot start Mandate: ${err.message}\n`);
    console.error('If the database is not running, start it with: npm run db:start\n');
    await pool.end().catch(() => {});
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`\n  Mandate is running`);
    console.log(`  Open:        http://localhost:${config.port}`);
    console.log(`  Answer mode: ${hasLlm() ? `generative via ${config.openaiModel}` : 'extractive (quotes your documents verbatim)'}`);
    console.log(`  Database:    ${config.databaseUrl.replace(/\/\/[^@]*@/, '//')}\n`);
  });
}

main();
