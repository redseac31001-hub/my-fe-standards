import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

interface ReleaseFileEntry {
  path: string;
  size: number;
  sha256: string;
}

interface ReleaseManifest {
  generatedAt: string;
  version: string;
  outputDir: string;
  files: ReleaseFileEntry[];
}

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'release', 'standards');
const RELEASE_FILES = [
  'manifest.json',
  'scripts/dist/codebuddy-install.js',
  'scripts/dist/codebuddy-loader.bundle.js',
  'packs/content-pack-core.json',
  'packs/content-pack-analysis.json',
  'packs/content-pack-orchestrator.json',
  'packs/content-pack-full.json',
];
const RELEASE_MANIFEST_FILE = 'release-manifest.json';

function parseOutputDir(args: string[]): string {
  const outIndex = args.indexOf('--out');
  if (outIndex === -1) {
    return DEFAULT_OUTPUT_DIR;
  }

  const value = args[outIndex + 1];
  if (!value || value.startsWith('-')) {
    throw new Error('--out requires a directory path');
  }

  return path.isAbsolute(value) ? value : path.resolve(PROJECT_ROOT, value);
}

function ensureSourceFilesExist(): void {
  const missing = RELEASE_FILES
    .map((relativePath) => path.join(PROJECT_ROOT, relativePath))
    .filter((absolutePath) => !fs.existsSync(absolutePath));

  if (missing.length > 0) {
    throw new Error([
      'release packaging requires build artifacts first',
      ...missing.map((filePath) => `missing: ${filePath}`),
      'run `npm run build` and retry',
    ].join('\n'));
  }
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readPreviousReleaseManifest(outputDir: string): ReleaseManifest | null {
  const manifestPath = path.join(outputDir, RELEASE_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ReleaseManifest;
  } catch {
    return null;
  }
}

function cleanupStaleReleaseFiles(outputDir: string, nextFiles: string[]): void {
  const previousManifest = readPreviousReleaseManifest(outputDir);
  if (!previousManifest) {
    return;
  }

  const nextFileSet = new Set(nextFiles.map((filePath) => filePath.replace(/\\/g, '/')));
  for (const previousFile of previousManifest.files) {
    const normalized = previousFile.path.replace(/\\/g, '/');
    if (nextFileSet.has(normalized)) {
      continue;
    }

    const absolutePath = path.join(outputDir, normalized);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    try {
      fs.rmSync(absolutePath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Skip stale release cleanup: ${normalized} (${(error as Error).message})`);
    }
  }
}

function copyReleaseFile(relativePath: string, outputDir: string): ReleaseFileEntry {
  const sourcePath = path.join(PROJECT_ROOT, relativePath);
  const destPath = path.join(outputDir, relativePath);
  const content = fs.readFileSync(sourcePath);

  ensureParentDir(destPath);
  fs.writeFileSync(destPath, content);

  return {
    path: relativePath.replace(/\\/g, '/'),
    size: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function getProjectVersion(): string {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { version?: string };
  return packageJson.version || '0.0.0';
}

function writeReleaseManifest(outputDir: string, files: ReleaseFileEntry[]): void {
  const manifest: ReleaseManifest = {
    generatedAt: new Date().toISOString(),
    version: getProjectVersion(),
    outputDir,
    files,
  };

  const manifestPath = path.join(outputDir, RELEASE_MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

function main(): void {
  const outputDir = parseOutputDir(process.argv.slice(2));

  ensureSourceFilesExist();
  fs.mkdirSync(outputDir, { recursive: true });
  cleanupStaleReleaseFiles(outputDir, RELEASE_FILES);

  const files = RELEASE_FILES.map((relativePath) => copyReleaseFile(relativePath, outputDir));
  writeReleaseManifest(outputDir, files);

  console.log(`Release package ready: ${outputDir}`);
  for (const file of files) {
    console.log(` - ${file.path}`);
  }
  console.log(` - ${RELEASE_MANIFEST_FILE}`);
}

main();
