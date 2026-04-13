#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDownloadUrlCandidates = buildDownloadUrlCandidates;
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const DEFAULT_INSTALL_ARGS = ['--profile', 'analysis', '--rule-level', 'quick', '--pack-only'];
const DEFAULT_LOADER_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;
const DEFAULT_DOWNLOAD_RETRIES = 2;
const DEFAULT_PUBLIC_GITHUB_RAW_MIRROR_PREFIXES = [
    'https://mirror.ghproxy.com/',
    'https://ghproxy.com/',
];
function showHelp() {
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
function fail(message) {
    console.error(`[codebuddy-install] ${message}`);
    process.exit(1);
}
function parseInteger(value, flag) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        fail(`${flag} requires a positive number`);
    }
    return Math.trunc(parsed);
}
function isSameOrigin(urlA, urlB) {
    try {
        return new URL(urlA).origin === new URL(urlB).origin;
    }
    catch (_a) {
        return false;
    }
}
function hasFlag(args, flag) {
    return args.includes(flag);
}
function hasFlagValue(args, flag) {
    const index = args.indexOf(flag);
    return index !== -1 && typeof args[index + 1] === 'string' && !args[index + 1].startsWith('-');
}
function dedupeUrls(urls) {
    const seen = new Set();
    const unique = [];
    for (const url of urls) {
        if (!url || seen.has(url))
            continue;
        seen.add(url);
        unique.push(url);
    }
    return unique;
}
function getConfiguredMirrorPrefixes() {
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
function buildDownloadUrlCandidates(url, remoteBearerToken) {
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
function parseArgs(argv) {
    var _a, _b, _c, _d;
    let remoteBaseUrl = null;
    let loaderUrl = null;
    let loaderTimeoutMs = DEFAULT_LOADER_TIMEOUT_MS;
    let keepLoader = false;
    let loaderOutPath = null;
    let remoteBearerToken = null;
    let remoteBearerTokenExplicit = false;
    const passThroughArgs = [];
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
        remoteBearerToken = ((_a = process.env.CODEBUDDY_REMOTE_BEARER_TOKEN) === null || _a === void 0 ? void 0 : _a.trim()) || null;
    }
    if (!remoteBaseUrl) {
        remoteBaseUrl = ((_c = (_b = process.env.CODEBUDDY_REMOTE_BASE) === null || _b === void 0 ? void 0 : _b.trim()) === null || _c === void 0 ? void 0 : _c.replace(/\/$/, '')) || null;
        if (remoteBaseUrl && !hasFlagValue(passThroughArgs, '--remote')) {
            passThroughArgs.push('--remote', remoteBaseUrl);
        }
    }
    if (!loaderUrl) {
        loaderUrl = ((_d = process.env.CODEBUDDY_INSTALLER_LOADER_URL) === null || _d === void 0 ? void 0 : _d.trim()) || null;
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
function ensureParentDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
async function downloadFile(url, outputPath, headers, timeoutMs) {
    const tempOutputPath = `${outputPath}.download-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const cleanupTempFile = () => {
        try {
            fs.rmSync(tempOutputPath, { force: true });
        }
        catch (_a) {
            // ignore cleanup failure
        }
    };
    await new Promise((resolve, reject) => {
        const visit = (targetUrl, redirectsLeft) => {
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
                    const chunks = [];
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
                    }
                    catch (error) {
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
async function downloadFileWithFallbacks(url, outputPath, headers, timeoutMs, remoteBearerToken) {
    const candidates = buildDownloadUrlCandidates(url, remoteBearerToken);
    const failures = [];
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
        const candidateUrl = candidates[candidateIndex];
        for (let attempt = 0; attempt <= DEFAULT_DOWNLOAD_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    console.warn(`[codebuddy-install] retry download (${attempt}/${DEFAULT_DOWNLOAD_RETRIES}) via ${candidateUrl}`);
                }
                else if (candidateIndex > 0) {
                    console.warn(`[codebuddy-install] fallback download via ${candidateUrl}`);
                }
                await downloadFile(candidateUrl, outputPath, headers, timeoutMs);
                return candidateUrl;
            }
            catch (error) {
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
function createTempLoaderPath() {
    const fileName = `codebuddy-loader-${Date.now()}-${Math.random().toString(16).slice(2, 10)}.bundle.js`;
    return path.join(os.tmpdir(), fileName);
}
async function main() {
    var _a;
    const parsed = parseArgs(process.argv.slice(2));
    const loaderPath = parsed.loaderOutPath || createTempLoaderPath();
    const shouldCleanup = !parsed.keepLoader && !parsed.loaderOutPath;
    const headers = {};
    if (parsed.remoteBearerToken && isSameOrigin(parsed.loaderUrl, parsed.remoteBaseUrl)) {
        headers.Authorization = `Bearer ${parsed.remoteBearerToken}`;
    }
    console.log(`[codebuddy-install] download loader: ${parsed.loaderUrl}`);
    const resolvedLoaderUrl = await downloadFileWithFallbacks(parsed.loaderUrl, loaderPath, headers, parsed.loaderTimeoutMs, parsed.remoteBearerToken);
    if (resolvedLoaderUrl !== parsed.loaderUrl) {
        console.log(`[codebuddy-install] loader downloaded via fallback: ${resolvedLoaderUrl}`);
    }
    console.log(`[codebuddy-install] run loader: node ${path.basename(loaderPath)} ${parsed.passThroughArgs.join(' ')}`.trim());
    const result = (0, child_process_1.spawnSync)(process.execPath, [loaderPath, ...parsed.passThroughArgs], {
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
        }
        catch (_b) {
            // ignore cleanup failure
        }
    }
    if (result.error) {
        throw result.error;
    }
    process.exit((_a = result.status) !== null && _a !== void 0 ? _a : 1);
}
if (require.main === module) {
    main().catch((error) => {
        fail(error instanceof Error ? error.message : String(error));
    });
}
