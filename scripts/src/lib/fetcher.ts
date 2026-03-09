/**
 * 网络请求模块
 *
 * 提供 HTTP/HTTPS 请求能力，支持重定向、重试和超时
 */

import * as https from 'https';
import * as http from 'http';
import { Context } from '../types';
import { Logger } from './logger';

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

export function fetchUrl(ctx: Readonly<Context>, logger: Logger, url: string, retries: number = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const headers = buildRequestHeaders(ctx, url);

    logger.verbose(`Fetching: ${url} (Retries left: ${retries})`);

    const request = client.get(url, { headers }, (res) => {
      // 处理重定向
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        res.resume();
        logger.verbose(`Redirecting to: ${redirectUrl}`);
        fetchUrl(ctx, logger, redirectUrl, retries).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        if (res.statusCode && res.statusCode >= 500 && retries > 0) {
          res.resume();
          logger.warn(`HTTP ${res.statusCode}. Retrying...`);
          setTimeout(() => {
            fetchUrl(ctx, logger, url, retries - 1).then(resolve).catch(reject);
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
        const data = Buffer.concat(chunks).toString('utf-8');
        logger.verbose(`Fetched ${data.length} bytes from ${url}`);
        resolve(data);
      });
    });

    request.on('error', (e: NodeJS.ErrnoException) => {
      if (retries > 0) {
        logger.warn(`Network Error (${e.code}). Retrying...`);
        setTimeout(() => {
          fetchUrl(ctx, logger, url, retries - 1).then(resolve).catch(reject);
        }, 1000);
        return;
      }
      reject(new Error(`Network Error: ${e.message} (URL: ${url})`));
    });

    request.setTimeout(ctx.requestTimeout, () => {
      request.destroy();
      if (retries > 0) {
        logger.warn(`Request Timeout. Retrying...`);
        setTimeout(() => {
          fetchUrl(ctx, logger, url, retries - 1).then(resolve).catch(reject);
        }, 1000);
        return;
      }
      reject(new Error(`Request Timeout: ${url}`));
    });
  });
}
