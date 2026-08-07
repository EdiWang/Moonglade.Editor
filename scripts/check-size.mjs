import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const budgets = [
  { file: 'dist/moonglade-editor.js', maxBytes: 32 * 1024 },
  { file: 'dist/moonglade-editor.rich-html.js', maxBytes: 32 * 1024 },
  { file: 'dist/moonglade-editor.code.js', maxBytes: 32 * 1024 },
  { file: 'dist/moonglade-editor.global.js', maxBytes: 1530 * 1024 },
  { file: 'dist/moonglade-editor.formatter.js', maxBytes: 1400 * 1024 },
  { file: 'dist/moonglade-editor.css', maxBytes: 32 * 1024 }
];
const chunkBudget = { directory: 'dist/chunks', maxBytes: 650 * 1024 };

let failed = false;

for (const budget of budgets) {
  const { size } = await stat(budget.file);
  const label = `${formatBytes(size)} / ${formatBytes(budget.maxBytes)}`;
  console.log(`${budget.file}: ${label}`);

  if (size > budget.maxBytes) {
    failed = true;
  }
}

for (const file of await listJavaScriptFiles(chunkBudget.directory)) {
  const { size } = await stat(file);
  const label = `${formatBytes(size)} / ${formatBytes(chunkBudget.maxBytes)}`;
  console.log(`${file}: ${label}`);

  if (size > chunkBudget.maxBytes) {
    failed = true;
  }
}

if (failed) {
  throw new Error('Bundle size budget exceeded.');
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)}kb`;
}

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listJavaScriptFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(entryPath.replaceAll(path.sep, '/'));
    }
  }

  return files.sort();
}
