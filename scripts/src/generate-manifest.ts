#!/usr/bin/env node
/**
 * Manifest Generator for Remote Fetch Mode
 *
 * 遍历 rules 目录，生成 manifest.json 清单文件。
 * 供 rule-loader.ts 在远程模式下通过 HTTP 读取文件列表。
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ManifestFile, Manifest, RawLoaderConfig } from './types';

// --- 路径配置 ---
const RULES_ROOT = path.resolve(__dirname, '../../rules');
const CONFIG_PATH = path.resolve(__dirname, '../../config/loader-config.json');
const OUTPUT_PATH = path.resolve(__dirname, '../../manifest.json');

/**
 * 递归扫描目录，收集所有 Markdown 文件
 * @param dir 要扫描的目录
 * @param relativeTo 相对路径的基准目录
 * @returns 文件信息数组
 */
function scanDirectory(dir: string, relativeTo: string): ManifestFile[] {
  let results: ManifestFile[] = [];

  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(relativeTo, fullPath).replace(/\\/g, '/'); // 统一为 POSIX 路径
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(scanDirectory(fullPath, relativeTo));
    } else if (file.endsWith('.md')) {
      results.push({
        path: relativePath,
        size: stat.size,
        name: file,
      });
    }
  });

  return results;
}

/**
 * 主函数
 */
function main(): void {
  console.log('[Manifest] Scanning rules directory...');

  // 1. 读取所有规则文件
  const files = scanDirectory(RULES_ROOT, path.resolve(__dirname, '../..'));

  // 2. 读取 Loader 配置
  const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const config: RawLoaderConfig = JSON.parse(configContent);

  // 3. 构造 Manifest 对象
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    config: config,
    files: files,
  };

  // 4. 写入文件
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2));
  console.log(`[Manifest] Generated at ${OUTPUT_PATH}`);
  console.log(`[Manifest] Total files: ${files.length}`);
}

main();
