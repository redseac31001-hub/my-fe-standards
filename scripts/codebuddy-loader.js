#!/usr/bin/env node
/**
 * CodeBuddy 规则加载器 - 简化版
 *
 * 专为 CodeBuddy (GLM-4.7) 优化，直接复制整合规则文件
 *
 * 用法：
 *   node codebuddy-loader.js [目标项目路径]
 */

const fs = require('fs');
const path = require('path');

// 配置
const RULES_FILE = 'codebuddy-rules.md';
const OUTPUT_DIR = '.codebuddy/rules';
const OUTPUT_FILE = 'project-rules.md';

function log(message) {
  console.log(`[CodeBuddy] ${message}`);
}

function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] ? path.resolve(args[0]) : process.cwd();

  log('CodeBuddy 规则加载器 v1.0');
  log(`目标项目: ${targetDir}`);

  // 1. 读取规则文件
  const rulesPath = path.resolve(__dirname, '../rules', RULES_FILE);
  if (!fs.existsSync(rulesPath)) {
    console.error(`[错误] 规则文件不存在: ${rulesPath}`);
    process.exit(1);
  }

  let rulesContent = fs.readFileSync(rulesPath, 'utf-8');

  // 2. 添加 frontmatter
  const frontmatter = `---
description: 前端架构规范 - CodeBuddy GLM-4.7 专用版
alwaysApply: true
---

`;

  rulesContent = frontmatter + rulesContent;

  // 3. 创建输出目录
  const outputDir = path.join(targetDir, OUTPUT_DIR);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 4. 写入规则文件
  const outputPath = path.join(outputDir, OUTPUT_FILE);
  fs.writeFileSync(outputPath, rulesContent, 'utf-8');

  // 5. 更新 .gitignore
  updateGitignore(targetDir);

  log('');
  log('═══════════════════════════════════════════════════════════════════');
  log(`✅ 成功! 规则文件已写入: ${outputPath}`);
  log(`   文件大小: ${(rulesContent.length / 1024).toFixed(2)} KB`);
  log('═══════════════════════════════════════════════════════════════════');
}

function updateGitignore(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const entry = '.codebuddy/';

  try {
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
      if (content.includes(entry)) {
        return; // 已存在
      }
    }

    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    content += `\n# CodeBuddy 生成文件\n${entry}\n`;

    fs.writeFileSync(gitignorePath, content, 'utf-8');
    log('已更新 .gitignore');
  } catch (error) {
    console.warn(`[警告] 更新 .gitignore 失败: ${error.message}`);
  }
}

main();
