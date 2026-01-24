#!/usr/bin/env node
/**
 * Manifest 生成器 - CodeBuddy 版
 *
 * 扫描 rules/ 和 custom-skills/ 目录，生成 manifest.json
 * 用于远程加载模式
 *
 * 用法：
 *   node generate-manifest.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { ManifestFile, Manifest, LoaderConfig } from './types';

const PROJECT_ROOT: string = path.resolve(__dirname, '../..');
const RULES_ROOT: string = path.join(PROJECT_ROOT, 'rules');
const SKILLS_ROOT: string = path.join(PROJECT_ROOT, 'custom-skills');
const CONFIG_PATH: string = path.join(PROJECT_ROOT, 'config', 'loader-config.json');
const OUTPUT_PATH: string = path.join(PROJECT_ROOT, 'manifest.json');

function log(message: string): void {
  console.log(`[Manifest] ${message}`);
}

/**
 * 递归扫描目录，收集所有 .md 文件
 */
function scanDirectory(dir: string, basePath: string = ''): ManifestFile[] {
  const files: ManifestFile[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    // 跳过 _meta 目录
    if (item === '_meta') continue;

    const fullPath = path.join(dir, item);
    const relativePath = basePath ? `${basePath}/${item}` : item;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...scanDirectory(fullPath, relativePath));
    } else if (item.endsWith('.md')) {
      files.push({
        path: relativePath,
        name: item.replace('.md', ''),
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      });
    }
  }

  return files;
}

/**
 * 主函数
 */
function main(): void {
  log('开始生成 manifest.json...');

  // 1. 加载配置
  let config: Partial<LoaderConfig> = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as LoaderConfig;
      log('已加载配置文件');
    } catch (e) {
      log(`错误: 配置文件格式无效 - ${(e as Error).message}`);
      process.exit(1);
    }
  } else {
    log('警告: 配置文件不存在，使用默认配置');
  }

  // 2. 扫描规则文件
  log('扫描 rules/ 目录...');
  const ruleFiles: ManifestFile[] = scanDirectory(RULES_ROOT).map(f => ({
    ...f,
    path: `rules/${f.path}`,
  }));
  log(`  找到 ${ruleFiles.length} 个规则文件`);

  // 3. 扫描技能文件
  log('扫描 custom-skills/ 目录...');
  const skillFiles: ManifestFile[] = scanDirectory(SKILLS_ROOT).map(f => ({
    ...f,
    path: `custom-skills/${f.path}`,
  }));
  log(`  找到 ${skillFiles.length} 个技能文件`);

  // 4. 构建 manifest
  const manifest: Manifest = {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    aiTool: 'CodeBuddy',
    model: 'GLM-4.7',
    config: {
      layers: config.layers || {},
      skills: config.skills || { enabled: false, path: '' },
      tasks: config.tasks || {},
      output: config.output || { dirName: '', fileName: '' },
      frontmatter: config.frontmatter || {},
    },
    files: [...ruleFiles, ...skillFiles],
    stats: {
      totalFiles: ruleFiles.length + skillFiles.length,
      ruleFiles: ruleFiles.length,
      skillFiles: skillFiles.length,
    },
  };

  // 5. 写入文件
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

  log('');
  log('═══════════════════════════════════════════════════════════════════');
  log(`✅ 成功! manifest.json 已生成`);
  log(`   规则文件: ${ruleFiles.length} 个`);
  log(`   技能文件: ${skillFiles.length} 个`);
  log(`   总计: ${manifest.stats.totalFiles} 个文件`);
  log('═══════════════════════════════════════════════════════════════════');
}

main();
