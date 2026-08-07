import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { watch as watchFile } from 'node:fs';
import { context, build, transform } from 'esbuild';

const watch = process.argv.includes('--watch');
const styleSources = ['src/styles.css', 'src/code-styles.css'];
const styleOutput = 'dist/moonglade-editor.css';

const shared = {
  bundle: true,
  minify: !watch,
  sourcemap: true,
  target: 'es2020',
  logLevel: 'info'
};

const builds = [
  {
    ...shared,
    entryPoints: {
      'moonglade-editor': 'src/index.ts',
      'moonglade-editor.rich-html': 'src/rich-html.ts',
      'moonglade-editor.code': 'src/code.ts'
    },
    outdir: 'dist',
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    format: 'esm',
    splitting: true
  },
  {
    ...shared,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/moonglade-editor.global.js',
    format: 'iife',
    globalName: 'MoongladeEditor'
  },
  {
    ...shared,
    entryPoints: ['src/code-formatter-runtime.ts'],
    outfile: 'dist/moonglade-editor.formatter.js',
    format: 'esm'
  }
];

await mkdir('dist', { recursive: true });
await copyStyles({ minify: !watch });

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  const styleWatchers = styleSources.map((styleSource) =>
    watchFile(styleSource, async () => {
      try {
        await copyStyles({ minify: false });
        console.log(`Copied ${styleOutput}`);
      } catch (error) {
        console.error(error);
      }
    })
  );
  const stop = async () => {
    for (const styleWatcher of styleWatchers) {
      styleWatcher.close();
    }
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
  const css = (await Promise.all(styleSources.map((styleSource) => readFile(styleSource, 'utf8')))).join('\n\n');

  if (!minify) {
    await writeFile(styleOutput, css);
    return;
  }

  const result = await transform(css, {
    loader: 'css',
    minify: true,
    target: 'es2020'
  });

  await writeFile(styleOutput, result.code);
}
