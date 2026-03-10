/**
 * 通用文件分发模块
 *
 * 提供远程下载或本地复制的通用分发逻辑，支持 README 生成和子目录预创建
 */

import * as fs from 'fs';
import * as path from 'path';
import { Context } from '../types';
import { Logger } from './logger';
import { ManagedFileTracker, copyManagedFile, writeManagedFile } from './install-sync';
import { readRemoteAsset } from './remote-content-pack';

export interface DistributeItemsOptions {
  targetSubDir: string;
  items: Array<{ sourcePath: string; destFile: string }>;
  label: string;
  readme?: string;
  preCreateDirs?: string[];
  tracker?: ManagedFileTracker;
}

/**
 * 通用文件分发：远程下载或本地复制，支持 README 生成和子目录预创建
 */
export async function distributeItems(
  ctx: Readonly<Context>,
  logger: Logger,
  targetDir: string,
  projectRoot: string,
  options: DistributeItemsOptions,
): Promise<string[]> {
  const distributed: string[] = [];
  const localDir = path.join(targetDir, options.targetSubDir);

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  if (options.preCreateDirs) {
    for (const sub of options.preCreateDirs) {
      const subPath = path.join(localDir, sub);
      if (!fs.existsSync(subPath)) fs.mkdirSync(subPath, { recursive: true });
    }
  }

  for (const item of options.items) {
    const destPath = path.join(localDir, item.destFile);

    if (ctx.isRemote) {
      try {
        const content = await readRemoteAsset(ctx, logger, item.sourcePath);
        if (options.tracker) {
          writeManagedFile(options.tracker, destPath, content);
        } else {
          fs.writeFileSync(destPath, content);
        }
        distributed.push(item.destFile);
        logger.verbose(`已下载 ${options.label}: ${item.destFile}`);
      } catch (e) {
        logger.warn(`${options.label} 下载失败: ${item.destFile} - ${(e as Error).message}`);
      }
    } else {
      const srcPath = path.join(projectRoot, item.sourcePath);
      if (!fs.existsSync(srcPath)) {
        logger.warn(`${options.label} 文件不存在: ${srcPath}`);
        continue;
      }
      try {
        if (options.tracker) {
          copyManagedFile(options.tracker, srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
        distributed.push(item.destFile);
        logger.verbose(`已复制 ${options.label}: ${item.destFile}`);
      } catch (e) {
        logger.warn(`${options.label} 复制失败: ${item.destFile} - ${(e as Error).message}`);
      }
    }
  }

  if (distributed.length > 0 && options.readme) {
    const readmePath = path.join(localDir, 'README.md');
    if (options.tracker) {
      writeManagedFile(options.tracker, readmePath, options.readme);
    } else {
      fs.writeFileSync(readmePath, options.readme, 'utf-8');
    }
  }

  return distributed;
}
