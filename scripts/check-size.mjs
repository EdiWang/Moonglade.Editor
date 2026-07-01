import { stat } from 'node:fs/promises';

const budgets = [
  { file: 'dist/moonglade-editor.js', maxBytes: 650 * 1024 },
  { file: 'dist/moonglade-editor.global.js', maxBytes: 700 * 1024 },
  { file: 'dist/moonglade-editor.css', maxBytes: 12 * 1024 }
];

let failed = false;

for (const budget of budgets) {
  const { size } = await stat(budget.file);
  const label = `${formatBytes(size)} / ${formatBytes(budget.maxBytes)}`;
  console.log(`${budget.file}: ${label}`);

  if (size > budget.maxBytes) {
    failed = true;
  }
}

if (failed) {
  throw new Error('Bundle size budget exceeded.');
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)}kb`;
}
