import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// The Python side is invoked as a short-lived process per job rather than as a second
// HTTP service, so there is only one server to start. Jobs are batch work (parse a
// file, render a document), never request-path work, so process startup cost is fine.
export function runPython(scriptName, job, { timeoutMs = 180000 } = {}) {
  return new Promise((resolve) => {
    if (!existsSync(config.pythonBin)) {
      return resolve({
        ok: false,
        error: `Python environment missing at ${config.pythonBin}. Run: npm run setup`,
      });
    }
    const script = path.join(config.researchDir, scriptName);
    const child = spawn(config.pythonBin, [script], { cwd: config.researchDir });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ ok: false, error: `${scriptName} timed out after ${Math.round(timeoutMs / 1000)}s` });
    }, timeoutMs);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: `could not start python: ${err.message}` });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (stderr.trim()) console.warn(`[python:${scriptName}] ${stderr.trim().slice(0, 2000)}`);
      if (!stdout.trim()) {
        return resolve({ ok: false, error: stderr.trim() || `${scriptName} exited with code ${code} and no output` });
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ ok: false, error: `${scriptName} returned output that is not JSON: ${stdout.slice(0, 400)}` });
      }
    });

    child.stdin.write(JSON.stringify(job));
    child.stdin.end();
  });
}
