#!/usr/bin/env node
// One command to get Mandate ready: database, schema, seed data, and the Python
// environment used for document ingest and Word export. Safe to run more than once.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const venvDir = path.join(repoRoot, 'services', 'research', '.venv');
const venvPython = path.join(venvDir, isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python');

function step(label, cmd, args) {
  console.log(`\n=== ${label} ===`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, shell: false });
  if (res.status !== 0) {
    console.error(`\nSetup stopped at: ${label}`);
    process.exit(res.status ?? 1);
  }
}

function findSystemPython() {
  if (process.env.PYTHON_BIN && existsSync(process.env.PYTHON_BIN)) return process.env.PYTHON_BIN;
  const candidates = isWindows
    ? [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
        'python.exe',
      ]
    : ['python3', 'python'];
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) && !existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  return null;
}

console.log('Setting up Mandate.\n');

step('database (downloads PostgreSQL on first run)', process.execPath, [path.join(repoRoot, 'scripts', 'pg.mjs'), 'setup']);
step('schema', process.execPath, [path.join(repoRoot, 'scripts', 'pg.mjs'), 'migrate']);
step('seed data', process.execPath, [path.join(repoRoot, 'scripts', 'pg.mjs'), 'seed']);

if (!existsSync(venvPython)) {
  const systemPython = findSystemPython();
  if (!systemPython) {
    console.error(
      '\nPython 3.11 or newer was not found. Install it from https://www.python.org/downloads/ ' +
        'and run "npm run setup" again.'
    );
    process.exit(1);
  }
  step('python environment', systemPython, ['-m', 'venv', venvDir]);
}
step('python packages', venvPython, ['-m', 'pip', 'install', '--quiet', '-r', path.join(repoRoot, 'services', 'research', 'requirements.txt')]);

console.log('\nSetup complete. Start the app with:  npm start');
console.log('Then open:  http://localhost:3000\n');
