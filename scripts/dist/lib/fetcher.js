"use strict";
/**
 * 网络请求模块
 *
 * 提供 HTTP/HTTPS 请求能力，支持重定向、重试和超时
 */
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
exports.buildFetchCandidateUrls = buildFetchCandidateUrls;
exports.fetchUrlBuffer = fetchUrlBuffer;
exports.fetchUrl = fetchUrl;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const DEFAULT_PUBLIC_GITHUB_RAW_MIRROR_PREFIXES = [
    'https://mirror.ghproxy.com/',
    'https://ghproxy.com/',
];
const MAX_REDIRECTS = 5;
function buildRequestHeaders(ctx, url) {
    if (!ctx.remoteBearerToken || !ctx.remoteBaseUrl) {
        return {};
    }
    try {
        const remoteOrigin = new URL(ctx.remoteBaseUrl).origin;
        const requestOrigin = new URL(url).origin;
        if (remoteOrigin !== requestOrigin) {
            return {};
        }
    }
    catch (_a) {
        return {};
    }
    return {
        Authorization: `Bearer ${ctx.remoteBearerToken}`,
    };
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
function buildFetchCandidateUrls(ctx, url) {
    if (ctx.remoteBearerToken || !url.startsWith('https://raw.githubusercontent.com/')) {
        return [url];
    }
    return dedupeUrls([
        url,
        ...getConfiguredMirrorPrefixes().map(prefix => `${prefix}${url}`),
    ]);
}
function fetchSingleUrlBuffer(ctx, logger, url, retries, redirectsLeft) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const headers = buildRequestHeaders(ctx, url);
        logger.verbose(`Fetching: ${url} (Retries left: ${retries})`);
        const request = client.get(url, { headers }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (redirectsLeft <= 0) {
                    res.resume();
                    reject(new Error(`Too many redirects while fetching ${url}`));
                    return;
                }
                const redirectUrl = new URL(res.headers.location, url).toString();
                res.resume();
                logger.verbose(`Redirecting to: ${redirectUrl}`);
                fetchWithCandidates(ctx, logger, redirectUrl, retries, redirectsLeft - 1).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                if (res.statusCode && (res.statusCode >= 500 || res.statusCode === 408 || res.statusCode === 429) && retries > 0) {
                    res.resume();
                    logger.warn(`HTTP ${res.statusCode}. Retrying...`);
                    setTimeout(() => {
                        fetchSingleUrlBuffer(ctx, logger, url, retries - 1, redirectsLeft).then(resolve).catch(reject);
                    }, 1000);
                    return;
                }
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${url}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            res.on('end', () => {
                const data = Buffer.concat(chunks);
                logger.verbose(`Fetched ${data.length} bytes from ${url}`);
                resolve(data);
            });
        });
        request.on('error', (e) => {
            if (retries > 0) {
                logger.warn(`Network Error (${e.code}). Retrying...`);
                setTimeout(() => {
                    fetchSingleUrlBuffer(ctx, logger, url, retries - 1, redirectsLeft).then(resolve).catch(reject);
                }, 1000);
                return;
            }
            reject(new Error(`Network Error: ${e.message} (URL: ${url})`));
        });
        request.setTimeout(ctx.requestTimeout, () => {
            request.destroy(new Error(`Request Timeout: ${url}`));
        });
    });
}
async function fetchWithCandidates(ctx, logger, url, retries, redirectsLeft) {
    const candidates = buildFetchCandidateUrls(ctx, url);
    let lastError = null;
    for (let index = 0; index < candidates.length; index++) {
        const candidateUrl = candidates[index];
        try {
            if (index > 0) {
                logger.warn(`Primary fetch failed, trying fallback: ${candidateUrl}`);
            }
            return await fetchSingleUrlBuffer(ctx, logger, candidateUrl, retries, redirectsLeft);
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }
    throw lastError || new Error(`Failed to fetch ${url}`);
}
function fetchUrlBuffer(ctx, logger, url, retries = 3) {
    return fetchWithCandidates(ctx, logger, url, retries, MAX_REDIRECTS);
}
async function fetchUrl(ctx, logger, url, retries = 3) {
    const buffer = await fetchUrlBuffer(ctx, logger, url, retries);
    return buffer.toString('utf-8');
}
