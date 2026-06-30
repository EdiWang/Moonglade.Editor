import { copyFile, mkdir } from 'node:fs/promises';
import { context, build } from 'esbuild';

const watch = process.argv.includes('--watch');

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  target: 'es2020',
  logLevel: 'info'
};

const builds = [
  {
    ...shared,
    outfile: 'dist/moonglade-editor.js',
    format: 'esm'
  },
  {
    ...shared,
    outfile: 'dist/moonglade-editor.global.js',
    format: 'iife',
    globalName: 'MoongladeEditor'
  }
];

await mkdir('dist', { recursive: true });
await copyFile('src/styles.css', 'dist/moonglade-editor.css');

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('Watching Moonglade.Editor source files...');
} else {
  await Promise.all(builds.map((options) => build(options)));
}
