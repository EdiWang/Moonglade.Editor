import { cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
const packageVersion = assertPackageVersion(packageJson.version);
const outputDirectory = path.resolve(repoRoot, process.env.NUGET_OUTPUT || path.join('artifacts', 'nuget'));
const distDirectory = path.join(repoRoot, 'dist');
const stagingDirectory = path.join(repoRoot, 'wwwroot', 'moonglade-editor');
const requiredAssets = [
  'moonglade-editor.global.js',
  'moonglade-editor.js',
  'moonglade-editor.rich-html.js',
  'moonglade-editor.code.js',
  'moonglade-editor.css',
  'moonglade-editor.formatter.markdown.js',
  'moonglade-editor.formatter.html.js',
  'moonglade-editor.formatter.css.js'
];
const browserAssetPattern = /\.(?:js|css)(?:\.map)?$/;

assertInsideRepo(outputDirectory);
assertInsideRepo(stagingDirectory);

const npmCommand = process.env.npm_execpath ? process.execPath : 'npm';
const npmArguments = process.env.npm_execpath ? [process.env.npm_execpath, 'run', 'build'] : ['run', 'build'];

await run(npmCommand, npmArguments);
await stageStaticAssets();

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await run('dotnet', [
  'pack',
  'Moonglade.Editor.StaticAssets.csproj',
  '--configuration',
  'Release',
  '--output',
  outputDirectory,
  `/p:Version=${packageVersion}`,
  `/p:PackageVersion=${packageVersion}`,
  `/p:MoongladeEditorPackageVersion=${packageVersion}`
]);

console.log(`Packed Moonglade.Editor.StaticAssets ${packageVersion} to ${outputDirectory}`);

async function stageStaticAssets() {
  await rm(stagingDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });

  const copiedAssets = new Set();

  await copyBrowserAssets(distDirectory, stagingDirectory, copiedAssets);

  for (const requiredAsset of requiredAssets) {
    if (!copiedAssets.has(requiredAsset)) {
      throw new Error(`Missing required built asset: dist/${requiredAsset}`);
    }
  }
}

async function copyBrowserAssets(sourceDirectory, targetDirectory, copiedAssets, relativeDirectory = '') {
  await mkdir(targetDirectory, { recursive: true });

  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      await copyBrowserAssets(sourcePath, targetPath, copiedAssets, relativePath);
      continue;
    }

    if (!entry.isFile() || !browserAssetPattern.test(entry.name)) {
      continue;
    }

    await cp(sourcePath, targetPath);
    copiedAssets.add(relativePath.replaceAll(path.sep, '/'));
  }
}

function assertInsideRepo(targetPath) {
  const relativePath = path.relative(repoRoot, targetPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to write outside the repository: ${targetPath}`);
  }
}

function assertPackageVersion(version) {
  if (typeof version === 'string' && version.trim()) {
    return version.trim();
  }

  throw new Error('package.json version is required to pack Moonglade.Editor.StaticAssets.');
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}
