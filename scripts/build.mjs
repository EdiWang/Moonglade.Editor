import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { watch as watchFile } from 'node:fs';
import { context, build, transform } from 'esbuild';

const watch = process.argv.includes('--watch');
const styleSource = 'src/styles.css';
const styleOutput = 'dist/moonglade-editor.css';

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: !watch,
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
await copyStyles({ minify: !watch });

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  const styleWatcher = watchFile(styleSource, async () => {
    try {
      await copyStyles({ minify: false });
      console.log(`Copied ${styleOutput}`);
    } catch (error) {
      console.error(error);
    }
  });
  const stop = async () => {
    styleWatcher.close();
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
    process.exit(0);
  };
  process.once('SIGINT', () => {
    void stop();
  });
  process.once('SIGTERM', () => {
    void stop();
  });
  console.log('Watching Moonglade.Editor source files...');
} else {
  await Promise.all(builds.map((options) => build(options)));
}

async function copyStyles({ minify }) {
  if (!minify) {
    await copyFile(styleSource, styleOutput);
    return;
  }

  const css = await readFile(styleSource, 'utf8');
  const result = await transform(css, {
    loader: 'css',
    minify: true,
    target: 'es2020'
  });

  await writeFile(styleOutput, result.code);
}
