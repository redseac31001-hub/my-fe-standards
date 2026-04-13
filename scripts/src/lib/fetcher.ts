/**
 * 网络请求模块
 *
 * 提供 HTTP/HTTPS 请求能力，支持重定向、重试和超时
 */

import * as https from 'https';
import * as http from 'http';
import { Context } from '../types';
import { Logger } from './logger';

const DEFAULT_PUBLIC_GITHUB_RAW_MIRROR_PREFIXES = [
  'https://mirror.ghproxy.com/',
  'https://ghproxy.com/',
];
const MAX_REDIRECTS = 5;

function buildRequestHeaders(ctx: Readonly<Context>, url: string): Record<string, string> {
  if (!ctx.remoteBearerToken || !ctx.remoteBaseUrl) {
    return {};
  }

  try {
    const remoteOrigin = new URL(ctx.remoteBaseUrl).origin;
    const requestOrigin = new URL(url).origin;
    if (remoteOrigin !== requestOrigin) {
      return {};
    }
  } catch {
    return {};
  }

  return {
    Authorization: `Bearer ${ctx.remoteBearerToken}`,
  };
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

export function buildFetchCandidateUrls(ctx: Readonly<Context>, url: string): string[] {
  if (ctx.remoteBearerToken || !url.startsWith('https://raw.githubusercontent.com/')) {
    return [url];
  }

  return dedupeUrls([
    url,
    ...getConfiguredMirrorPrefixes().map(prefix => `${prefix}${url}`),
  ]);
}

function fetchSingleUrlBuffer(
  ctx: Readonly<Context>,
  logger: Logger,
  url: string,
  retries: number,
  redirectsLeft: number,
): Promise<Buffer> {
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

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        logger.verbose(`Fetched ${data.length} bytes from ${url}`);
        resolve(data);
      });
    });

    request.on('error', (e: NodeJS.ErrnoException) => {
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

async function fetchWithCandidates(
  ctx: Readonly<Context>,
  logger: Logger,
  url: string,
  retries: number,
  redirectsLeft: number,
): Promise<Buffer> {
  const candidates = buildFetchCandidateUrls(ctx, url);
  let lastError: Error | null = null;

  for (let index = 0; index < candidates.length; index++) {
    const candidateUrl = candidates[index];
    try {
      if (index > 0) {
        logger.warn(`Primary fetch failed, trying fallback: ${candidateUrl}`);
      }
      return await fetchSingleUrlBuffer(ctx, logger, candidateUrl, retries, redirectsLeft);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

export function fetchUrlBuffer(
  ctx: Readonly<Context>,
  logger: Logger,
  url: string,
  retries: number = 3,
): Promise<Buffer> {
  return fetchWithCandidates(ctx, logger, url, retries, MAX_REDIRECTS);
}

export async function fetchUrl(
  ctx: Readonly<Context>,
  logger: Logger,
  url: string,
  retries: number = 3,
): Promise<string> {
  const buffer = await fetchUrlBuffer(ctx, logger, url, retries);
  return buffer.toString('utf-8');
}
