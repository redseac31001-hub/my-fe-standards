#!/usr/bin/env node

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

type ParsedArgs = {
  remoteBaseUrl: string | null;
  loaderUrl: string | null;
  loaderTimeoutMs: number;
  keepLoader: boolean;
  loaderOutPath: string | null;
  remoteBearerToken: string | null;
  passThroughArgs: string[];
};

type RemoteManifestSummary = {
  version?: string;
  generatedAt?: string;
  aiTool?: string;
  model?: string;
  stats?: {
    totalFiles?: number;
    ruleFiles?: number;
    skillFiles?: number;
    agentFiles?: number;
    workflowFiles?: number;
    taskbookFiles?: number;
  };
  packs?: Record<string, {
    file?: string;
    sha256?: string;
    entryCount?: number;
    generatedAt?: string;
  }>;
};

const DEFAULT_INSTALL_ARGS = ['--profile', 'analysis', '--rule-level', 'quick', '--pack-only'];
const DEFAULT_LOADER_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;
const DEFAULT_DOWNLOAD_RETRIES = 2;
const DEFAULT_PUBLIC_GITHUB_RAW_MIRROR_PREFIXES = [
  'https://mirror.ghproxy.com/',
  'https://ghproxy.com/',
];

function showHelp(): void {
  console.log(`
CodeBuddy Remote Installer

用法:
  node codebuddy-install.js --remote <URL> [loader options]

说明:
  - 这是一个跨平台安装包装器，适用于 Windows / macOS / Linux
  - 它会先下载远程 codebuddy-loader.bundle.js，再执行安装
  - 默认补齐安装参数: --profile analysis --rule-level quick --pack-only

安装器选项:
  --remote <URL>                  远程产物源根地址
  --loader-url <URL>              自定义 loader bundle 地址
  --loader-timeout <ms>           下载 loader 超时，默认 30000
  --loader-out <path>             保存下载到的 loader 文件，不使用临时目录
  --keep-loader                   保留下载后的 loader 文件
  --remote-bearer-token <token>   远程 Bearer Token（会透传给 loader）
  --full                          等价于 --profile full，适合多 Agent / Workflow 演示
  --help, -h                      显示帮助

示例:
  node codebuddy-install.js --remote https://example.com/my-fe-standards
  node codebuddy-install.js --remote https://example.com/my-fe-standards --full
  curl -fsSL https://example.com/my-fe-standards/scripts/dist/codebuddy-install.js | node - --remote https://example.com/my-fe-standards --full
  curl -fsSL https://example.com/my-fe-standards/scripts/dist/codebuddy-install.js | node - --remote https://example.com/my-fe-standards
  iwr https://example.com/my-fe-standards/scripts/dist/codebuddy-install.js -OutFile codebuddy-install.js
  node codebuddy-install.js --remote https://example.com/my-fe-standards --full
`.trim());
}

function fail(message: string): never {
  console.error(`[codebuddy-install] ${message}`);
  process.exit(1);
}

function parseInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`${flag} requires a positive number`);
  }
  return Math.trunc(parsed);
}

function isSameOrigin(urlA: string, urlB: string): boolean {
  try {
    return new URL(urlA).origin === new URL(urlB).origin;
  } catch {
    return false;
  }
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function hasFlagValue(args: string[], flag: string): boolean {
  const index = args.indexOf(flag);
  return index !== -1 && typeof args[index + 1] === 'string' && !args[index + 1].startsWith('-');
}

function getFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return typeof value === 'string' && !value.startsWith('-') ? value : null;
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) {
    return 'n/a';
  }
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 1000) {
    return `${Math.max(0, Math.round(durationMs))} ms`;
  }
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }

  return unique;
}

function getConfiguredMirrorPrefixes(): string[] {
  const configured = (process.env.CODEBUDDY_REMOTE_MIRRORS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.endsWith('/') ? item : `${item}/`);

  return dedupeUrls([
    ...configured,
    ...DEFAULT_PUBLIC_GITHUB_RAW_MIRROR_PREFIXES,
  ]);
}

export function buildDownloadUrlCandidates(url: string, remoteBearerToken: string | null): string[] {
  if (!url) {
    return [];
  }

  if (remoteBearerToken || !url.startsWith('https://raw.githubusercontent.com/')) {
    return [url];
  }

  return dedupeUrls([
    url,
    ...getConfiguredMirrorPrefixes().map(prefix => `${prefix}${url}`),
  ]);
}

export function shouldRunInstallerCli(
  mainModule: NodeJS.Module | undefined,
  currentModule: NodeJS.Module,
  argv: string[],
): boolean {
  if (mainModule === currentModule) {
    return true;
  }

  if (currentModule.id === '[stdin]') {
    return true;
  }

  return argv[1] === '-';
}

function parseArgs(argv: string[]): ParsedArgs {
  let remoteBaseUrl: string | null = null;
  let loaderUrl: string | null = null;
  let loaderTimeoutMs = DEFAULT_LOADER_TIMEOUT_MS;
  let keepLoader = false;
  let loaderOutPath: string | null = null;
  let remoteBearerToken: string | null = null;
  let remoteBearerTokenExplicit = false;
  const passThroughArgs: string[] = [];
  let useFullProfile = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }

    if (arg === '--loader-url') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        fail('--loader-url requires a URL value');
      }
      loaderUrl = value;
      i++;
      continue;
    }

    if (arg === '--loader-timeout') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        fail('--loader-timeout requires a number');
      }
      loaderTimeoutMs = parseInteger(value, '--loader-timeout');
      i++;
      continue;
    }

    if (arg === '--loader-out') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        fail('--loader-out requires a file path');
      }
      loaderOutPath = path.resolve(process.cwd(), value);
      i++;
      continue;
    }

    if (arg === '--keep-loader') {
      keepLoader = true;
      continue;
    }

    if (arg === '--full') {
      useFullProfile = true;
      continue;
    }

    if (!arg.startsWith('-')) {
      fail(`unexpected positional argument: ${arg}. This wrapper only handles install/sync; use the loader directly for other commands.`);
    }

    if (arg === '--remote') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        fail('--remote requires a URL value');
      }
      remoteBaseUrl = value.replace(/\/$/, '');
      passThroughArgs.push(arg, value);
      i++;
      continue;
    }

    if (arg === '--remote-bearer-token') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        fail('--remote-bearer-token requires a token value');
      }
      remoteBearerToken = value;
      remoteBearerTokenExplicit = true;
      passThroughArgs.push(arg, value);
      i++;
      continue;
    }

    if ((arg === '--profile' || arg === '--rule-level' || arg === '--task' || arg === '--threshold' || arg === '--timeout' || arg === '--role' || arg === '--workspace-scope' || arg === '--project' || arg === '--command') && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      passThroughArgs.push(arg, argv[i + 1]);
      i++;
      continue;
    }

    passThroughArgs.push(arg);
  }

  if (!remoteBearerTokenExplicit) {
    remoteBearerToken = process.env.CODEBUDDY_REMOTE_BEARER_TOKEN?.trim() || null;
  }
  if (!remoteBaseUrl) {
    remoteBaseUrl = process.env.CODEBUDDY_REMOTE_BASE?.trim()?.replace(/\/$/, '') || null;
    if (remoteBaseUrl && !hasFlagValue(passThroughArgs, '--remote')) {
      passThroughArgs.push('--remote', remoteBaseUrl);
    }
  }
  if (!loaderUrl) {
    loaderUrl = process.env.CODEBUDDY_INSTALLER_LOADER_URL?.trim() || null;
  }

  if (!remoteBaseUrl) {
    fail('missing --remote <URL> (or env CODEBUDDY_REMOTE_BASE)');
  }

  if (!loaderUrl) {
    loaderUrl = `${remoteBaseUrl}/scripts/dist/codebuddy-loader.bundle.js`;
  }

  if (useFullProfile) {
    if (hasFlagValue(passThroughArgs, '--profile')) {
      fail('--full cannot be used together with --profile');
    }
    passThroughArgs.push('--profile', 'full');
  }
  if (!hasFlagValue(passThroughArgs, '--profile')) {
    passThroughArgs.push('--profile', 'analysis');
  }
  if (!hasFlagValue(passThroughArgs, '--rule-level')) {
    passThroughArgs.push('--rule-level', 'quick');
  }
  if (!hasFlag(passThroughArgs, '--pack-only') && !hasFlag(passThroughArgs, '--strict-pack-only')) {
    passThroughArgs.push('--pack-only');
  }

  return {
    remoteBaseUrl,
    loaderUrl,
    loaderTimeoutMs,
    keepLoader,
    loaderOutPath,
    remoteBearerToken,
    passThroughArgs,
  };
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadFile(url: string, outputPath: string, headers: Record<string, string>, timeoutMs: number): Promise<void> {
  const tempOutputPath = `${outputPath}.download-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const cleanupTempFile = (): void => {
    try {
      fs.rmSync(tempOutputPath, { force: true });
    } catch {
      // ignore cleanup failure
    }
  };

  await new Promise<void>((resolve, reject) => {
    const visit = (targetUrl: string, redirectsLeft: number): void => {
      const client = targetUrl.startsWith('https://') ? https : http;
      const request = client.get(targetUrl, { headers }, (response) => {
        const statusCode = response.statusCode || 0;
        if ([301, 302, 307, 308].includes(statusCode)) {
          const location = response.headers.location;
          response.resume();
          if (!location) {
            reject(new Error(`redirect response missing location: ${targetUrl}`));
            return;
          }
          if (redirectsLeft <= 0) {
            reject(new Error(`too many redirects while fetching ${url}`));
            return;
          }
          visit(new URL(location, targetUrl).toString(), redirectsLeft - 1);
          return;
        }

        if (statusCode !== 200) {
          const chunks: Buffer[] = [];
          response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on('end', () => {
            const detail = Buffer.concat(chunks).toString('utf-8').trim();
            reject(new Error(`download failed (${statusCode}) for ${targetUrl}${detail ? `: ${detail}` : ''}`));
          });
          return;
        }

        ensureParentDir(tempOutputPath);
        const writer = fs.createWriteStream(tempOutputPath);
        response.pipe(writer);
        writer.on('finish', () => writer.close(() => {
          try {
            fs.rmSync(outputPath, { force: true });
            fs.renameSync(tempOutputPath, outputPath);
            resolve();
          } catch (error) {
            cleanupTempFile();
            reject(error);
          }
        }));
        writer.on('error', (error) => {
          cleanupTempFile();
          reject(error);
        });
      });

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`request timeout after ${timeoutMs}ms: ${targetUrl}`));
      });
      request.on('error', (error) => {
        cleanupTempFile();
        reject(error);
      });
    };

    visit(url, MAX_REDIRECTS);
  });
}

async function fetchText(url: string, headers: Record<string, string>, timeoutMs: number): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const visit = (targetUrl: string, redirectsLeft: number): void => {
      const client = targetUrl.startsWith('https://') ? https : http;
      const request = client.get(targetUrl, { headers }, (response) => {
        const statusCode = response.statusCode || 0;
        if ([301, 302, 307, 308].includes(statusCode)) {
          const location = response.headers.location;
          response.resume();
          if (!location) {
            reject(new Error(`redirect response missing location: ${targetUrl}`));
            return;
          }
          if (redirectsLeft <= 0) {
            reject(new Error(`too many redirects while fetching ${url}`));
            return;
          }
          visit(new URL(location, targetUrl).toString(), redirectsLeft - 1);
          return;
        }

        if (statusCode !== 200) {
          const chunks: Buffer[] = [];
          response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on('end', () => {
            const detail = Buffer.concat(chunks).toString('utf-8').trim();
            reject(new Error(`request failed (${statusCode}) for ${targetUrl}${detail ? `: ${detail}` : ''}`));
          });
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      });

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`request timeout after ${timeoutMs}ms: ${targetUrl}`));
      });
      request.on('error', reject);
    };

    visit(url, MAX_REDIRECTS);
  });
}

async function fetchJsonWithFallbacks<T>(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  remoteBearerToken: string | null,
): Promise<{ data: T; resolvedUrl: string }> {
  const candidates = buildDownloadUrlCandidates(url, remoteBearerToken);
  const failures: string[] = [];

  for (const candidateUrl of candidates) {
    try {
      const text = await fetchText(candidateUrl, headers, timeoutMs);
      return {
        data: JSON.parse(text) as T,
        resolvedUrl: candidateUrl,
      };
    } catch (error) {
      failures.push(`${candidateUrl} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const detail = failures.length > 0 ? `\n${failures.map(item => `  - ${item}`).join('\n')}` : '';
  throw new Error(`failed to fetch json from all candidates:${detail}`);
}

async function downloadFileWithFallbacks(
  url: string,
  outputPath: string,
  headers: Record<string, string>,
  timeoutMs: number,
  remoteBearerToken: string | null,
): Promise<string> {
  const candidates = buildDownloadUrlCandidates(url, remoteBearerToken);
  const failures: string[] = [];

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
    const candidateUrl = candidates[candidateIndex];

    for (let attempt = 0; attempt <= DEFAULT_DOWNLOAD_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.warn(`[codebuddy-install] retry download (${attempt}/${DEFAULT_DOWNLOAD_RETRIES}) via ${candidateUrl}`);
        } else if (candidateIndex > 0) {
          console.warn(`[codebuddy-install] fallback download via ${candidateUrl}`);
        }

        await downloadFile(candidateUrl, outputPath, headers, timeoutMs);
        return candidateUrl;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${candidateUrl} -> ${message}`);

        if (attempt >= DEFAULT_DOWNLOAD_RETRIES) {
          break;
        }
      }
    }
  }

  const detail = failures.length > 0 ? `\n${failures.map(item => `  - ${item}`).join('\n')}` : '';
  throw new Error(`failed to download loader from all candidates:${detail}`);
}

function createTempLoaderPath(): string {
  const fileName = `codebuddy-loader-${Date.now()}-${Math.random().toString(16).slice(2, 10)}.bundle.js`;
  return path.join(os.tmpdir(), fileName);
}

async function main(): Promise<void> {
  const installStartedAt = new Date();
  const parsed = parseArgs(process.argv.slice(2));
  const loaderPath = parsed.loaderOutPath || createTempLoaderPath();
  const shouldCleanup = !parsed.keepLoader && !parsed.loaderOutPath;
  const requestedProfile = getFlagValue(parsed.passThroughArgs, '--profile') || 'analysis';
  const requestedRuleLevel = getFlagValue(parsed.passThroughArgs, '--rule-level') || 'quick';
  const requestedPackMode = parsed.passThroughArgs.includes('--strict-pack-only')
    ? 'strict-pack-only'
    : (parsed.passThroughArgs.includes('--pack-only') ? 'pack-only' : 'fallback-allowed');

  const headers: Record<string, string> = {};
  if (parsed.remoteBearerToken && isSameOrigin(parsed.loaderUrl!, parsed.remoteBaseUrl!)) {
    headers.Authorization = `Bearer ${parsed.remoteBearerToken}`;
  }

  console.log('[codebuddy-install] CodeBuddy Remote Installer');
  console.log(`[codebuddy-install] session: ${installStartedAt.toISOString()}`);
  console.log(`[codebuddy-install] target: ${process.cwd()}`);
  console.log(`[codebuddy-install] remote: ${parsed.remoteBaseUrl}`);
  console.log(`[codebuddy-install] request: profile=${requestedProfile} | ruleLevel=${requestedRuleLevel} | packMode=${requestedPackMode}`);

  try {
    const manifestHeaders: Record<string, string> = {};
    if (parsed.remoteBearerToken) {
      manifestHeaders.Authorization = `Bearer ${parsed.remoteBearerToken}`;
    }
    const manifestUrl = `${parsed.remoteBaseUrl}/manifest.json`;
    const { data: manifest, resolvedUrl } = await fetchJsonWithFallbacks<RemoteManifestSummary>(
      manifestUrl,
      manifestHeaders,
      parsed.loaderTimeoutMs,
      parsed.remoteBearerToken,
    );
    console.log(
      `[codebuddy-install] release: ${manifest.version || 'n/a'}${manifest.generatedAt ? ` @ ${manifest.generatedAt}` : ''}${manifest.aiTool || manifest.model ? ` | ${[manifest.aiTool, manifest.model].filter(Boolean).join(' / ')}` : ''}`,
    );
    if (manifest.stats) {
      console.log(
        `[codebuddy-install] manifest: files=${manifest.stats.totalFiles || 0} | rules=${manifest.stats.ruleFiles || 0} | skills=${manifest.stats.skillFiles || 0} | agents=${manifest.stats.agentFiles || 0} | workflows=${manifest.stats.workflowFiles || 0} | taskbooks=${manifest.stats.taskbookFiles || 0}`,
      );
    }
    const selectedPack = manifest.packs?.[requestedProfile];
    if (selectedPack) {
      console.log(
        `[codebuddy-install] content-pack: ${selectedPack.file || requestedProfile} (${selectedPack.sha256?.slice(0, 12) || 'n/a'})${selectedPack.entryCount ? ` | files=${selectedPack.entryCount}` : ''}${selectedPack.generatedAt ? ` | generated=${selectedPack.generatedAt}` : ''}`,
      );
    }
    if (resolvedUrl !== manifestUrl) {
      console.log(`[codebuddy-install] manifest fallback: ${resolvedUrl}`);
    }
  } catch (error) {
    console.warn(`[codebuddy-install] manifest preflight unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('[codebuddy-install] step 1/2 download loader bundle');
  console.log(`[codebuddy-install] loader: ${parsed.loaderUrl}`);
  const resolvedLoaderUrl = await downloadFileWithFallbacks(
    parsed.loaderUrl!,
    loaderPath,
    headers,
    parsed.loaderTimeoutMs,
    parsed.remoteBearerToken,
  );
  if (resolvedLoaderUrl !== parsed.loaderUrl) {
    console.log(`[codebuddy-install] loader downloaded via fallback: ${resolvedLoaderUrl}`);
  }
  const loaderSize = fs.existsSync(loaderPath) ? fs.statSync(loaderPath).size : 0;
  console.log(`[codebuddy-install] loader saved: ${loaderPath} (${formatBytes(loaderSize)})`);
  console.log('[codebuddy-install] step 2/2 launch loader');
  console.log(`[codebuddy-install] run: node ${path.basename(loaderPath)} ${parsed.passThroughArgs.join(' ')}`.trim());

  const result = spawnSync(process.execPath, [loaderPath, ...parsed.passThroughArgs], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(parsed.remoteBearerToken ? { CODEBUDDY_REMOTE_BEARER_TOKEN: parsed.remoteBearerToken } : {}),
    },
  });

  if (shouldCleanup) {
    try {
      fs.rmSync(loaderPath, { force: true });
    } catch {
      // ignore cleanup failure
    }
  }

  if (result.error) {
    throw result.error;
  }

  console.log(`[codebuddy-install] finished: exit=${result.status ?? 1} | duration=${formatDurationMs(Date.now() - installStartedAt.getTime())}`);
  process.exit(result.status ?? 1);
}

if (shouldRunInstallerCli(require.main, module, process.argv)) {
  main().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
