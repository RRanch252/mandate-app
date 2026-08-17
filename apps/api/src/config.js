import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

const isWindows = process.platform === 'win32';

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/mandate',
  storageDir: process.env.STORAGE_DIR || path.join(repoRoot, 'storage'),
  webDir: path.join(repoRoot, 'apps', 'web'),
  pythonBin:
    process.env.PYTHON_BIN ||
    path.join(repoRoot, 'services', 'research', '.venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
  researchDir: path.join(repoRoot, 'services', 'research'),

  // Optional. With no key the answerer runs extractive-only: it quotes source
  // sentences verbatim instead of writing prose. That is a weaker read but it
  // cannot invent a number, so it is the safe default rather than an error state.
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 60 * 1024 * 1024),
};

export const hasLlm = () => Boolean(config.openaiApiKey);
