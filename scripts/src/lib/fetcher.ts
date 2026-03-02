/**
 * 网络请求模块
 *
 * 提供 HTTP/HTTPS 请求能力，支持重定向、重试和超时
 */

import * as https from 'https';
import * as http from 'http';
import { Context } from '../types';
import { Logger } from './logger';

export function fetchUrl(ctx: Readonly<Context>, logger: Logger, url: string, retries: number = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    logger.verbose(`Fetching: ${url} (Retries left: ${retries})`);

    const request = client.get(url, (res) => {
      // 处理重定向
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        logger.verbose(`Redirecting to: ${res.headers.location}`);
        fetchUrl(ctx, logger, res.headers.location, retries).then(resolve).catch(reject);
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

      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
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
