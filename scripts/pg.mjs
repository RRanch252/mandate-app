#!/usr/bin/env node
// Portable PostgreSQL for local development.
// Downloads the EnterpriseDB no-installer binaries into .localdb/ so that running
// Mandate never needs admin rights, a Windows service, or a machine-wide Postgres.
// Delete the .localdb folder to remove every trace of it.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localDb = path.join(repoRoot, '.localdb');
const pgRoot = path.join(localDb, 'pgsql');
const binDir = path.join(pgRoot, 'bin');
const dataDir = path.join(localDb, 'pgdata');
const logFile = path.join(localDb, 'postgres.log');

const PG_VERSION = '16.9-1';
const ZIP_URL = `https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-windows-x64-binaries.zip`;

export const PG_PORT = process.env.PGPORT || '55432';
export const PG_USER = process.env.PGUSER || 'postgres';
export const PG_DATABASE = process.env.PGDATABASE || 'mandate';

const isWindows = process.platform === 'win32';
const exe = (name) => path.join(binDir, isWindows ? `${name}.exe` : name);

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${path.basename(cmd)} exited with code ${res.status}`);
}

function runQuiet(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function haveBinaries() {
  return existsSync(exe('pg_ctl'));
}

function downloadBinaries() {
  if (haveBinaries()) {
    console.log('postgres binaries already present');
    return;
  }
  if (!isWindows) {
    throw new Error(
      'Automatic download is only wired up for Windows. On macOS or Linux install PostgreSQL 16 ' +
        'with your package manager and point DATABASE_URL at it.'
    );
  }
  mkdirSync(localDb, { recursive: true });
  const zip = path.join(localDb, 'pgsql.zip');
  console.log(`downloading PostgreSQL ${PG_VERSION} (about 300 MB, this takes a few minutes)`);
  run('curl.exe', ['-L', '--fail', '--retry', '3', '--no-progress-meter', '-o', zip, ZIP_URL]);
  console.log('extracting');
  run('tar', ['-xf', zip, '-C', localDb]);
  rmSync(zip, { force: true });
  if (!haveBinaries()) throw new Error('extraction finished but pg_ctl is missing');
  console.log('postgres binaries ready');
}

function initCluster() {
  if (existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log('data directory already initialised');
    return;
  }
  console.log('initialising data directory');
  mkdirSync(dataDir, { recursive: true });
  // trust auth is acceptable because the cluster only ever listens on loopback
  run(exe('initdb'), ['-D', dataDir, '-U', PG_USER, '-E', 'UTF8', '--locale=C', '-A', 'trust']);
}

export function isRunning() {
  const res = runQuiet(exe('pg_ctl'), ['-D', dataDir, 'status']);
  return res.status === 0;
}

function start() {
  if (!haveBinaries()) throw new Error('postgres is not set up yet — run: npm run db:setup');
  if (isRunning()) {
    console.log(`postgres already running on port ${PG_PORT}`);
    return;
  }
  console.log(`starting postgres on port ${PG_PORT}`);
  run(exe('pg_ctl'), ['-D', dataDir, '-l', logFile, '-o', `-p ${PG_PORT} -h 127.0.0.1`, '-w', 'start']);
  console.log(`postgres started, log: ${logFile}`);
}

function stop() {
  if (!haveBinaries() || !isRunning()) {
    console.log('postgres is not running');
    return;
  }
  run(exe('pg_ctl'), ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
  console.log('postgres stopped');
}

function ensureDatabase() {
  const check = runQuiet(exe('psql'), [
    '-h', '127.0.0.1', '-p', PG_PORT, '-U', PG_USER, '-d', 'postgres',
    '-tAc', `SELECT 1 FROM pg_database WHERE datname='${PG_DATABASE}'`,
  ]);
  if ((check.stdout || '').trim() === '1') {
    console.log(`database "${PG_DATABASE}" already exists`);
    return;
  }
  run(exe('createdb'), ['-h', '127.0.0.1', '-p', PG_PORT, '-U', PG_USER, PG_DATABASE]);
  console.log(`database "${PG_DATABASE}" created`);
}

function psqlFile(file) {
  run(exe('psql'), [
    '-h', '127.0.0.1', '-p', PG_PORT, '-U', PG_USER, '-d', PG_DATABASE,
    '-v', 'ON_ERROR_STOP=1', '-q', '-f', file,
  ]);
}

function psqlShell() {
  const child = spawn(exe('psql'), ['-h', '127.0.0.1', '-p', PG_PORT, '-U', PG_USER, '-d', PG_DATABASE], {
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

const command = process.argv[2];

try {
  switch (command) {
    case 'setup':
      downloadBinaries();
      initCluster();
      start();
      ensureDatabase();
      console.log('\ndatabase ready');
      break;
    case 'start':
      start();
      ensureDatabase();
      break;
    case 'stop':
      stop();
      break;
    case 'status':
      console.log(isRunning() ? `running on port ${PG_PORT}` : 'not running');
      break;
    case 'migrate':
      psqlFile(path.join(repoRoot, 'db', 'schema.sql'));
      console.log('schema applied');
      break;
    case 'seed':
      psqlFile(path.join(repoRoot, 'db', 'seed.sql'));
      console.log('seed data applied');
      break;
    case 'psql':
      psqlShell();
      break;
    case 'reset':
      stop();
      rmSync(dataDir, { recursive: true, force: true });
      console.log('data directory deleted — run npm run db:setup to rebuild');
      break;
    default:
      console.log('usage: node scripts/pg.mjs <setup|start|stop|status|migrate|seed|psql|reset>');
      process.exit(1);
  }
} catch (err) {
  console.error(`\nerror: ${err.message}`);
  process.exit(1);
}
