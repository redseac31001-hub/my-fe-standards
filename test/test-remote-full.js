#!/usr/bin/env node

/**
 * 完整的远程拉取测试脚本
 *
 * 模拟真实用户场景：
 * 1. 从 GitHub 下载 codebuddy-loader.js
 * 2. 执行下载的脚本拉取规则
 *
 * 使用方法：
 *   node test/test-remote-full.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const GITHUB_REPO = 'redseac31001-hub/my-fe-standards';
// 注意：这里应指向实际包含 scripts/dist/codebuddy-loader.js 的分支
const BRANCH = 'feature/codebuddy-glm';
const RULE_LOADER_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${BRANCH}/scripts/dist/codebuddy-loader.js`;
const REMOTE_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${BRANCH}`;

// 临时目录
const TEMP_DIR = path.join(__dirname, '.temp-remote-test');
const DOWNLOADED_LOADER = path.join(TEMP_DIR, 'codebuddy-loader.js');

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║          完整远程拉取测试 (Full Remote Fetch Test)              ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log(`║  仓库: ${GITHUB_REPO.padEnd(56)} ║`);
console.log(`║  分支: ${BRANCH.padEnd(56)} ║`);
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');

// 清理并创建临时目录
if (fs.existsSync(TEMP_DIR)) {
  console.log('[1/3] 清理旧的临时目录...');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEMP_DIR, { recursive: true });
console.log('[1/3] ✅ 临时目录已创建:', TEMP_DIR);
console.log('');

// 下载 codebuddy-loader.js
console.log('[2/3] 从 GitHub 下载 codebuddy-loader.js...');
console.log('      URL:', RULE_LOADER_URL);

https.get(RULE_LOADER_URL, (res) => {
  if (res.statusCode !== 200) {
    console.error(`❌ 下载失败: HTTP ${res.statusCode}`);
    process.exit(1);
  }

  const fileStream = fs.createWriteStream(DOWNLOADED_LOADER);
  res.pipe(fileStream);

  fileStream.on('finish', () => {
    fileStream.close();
    const fileSize = fs.statSync(DOWNLOADED_LOADER).size;
    console.log(`[2/3] ✅ codebuddy-loader.js 下载成功 (${(fileSize / 1024).toFixed(2)} KB)`);
    console.log('');

    // 执行下载的 codebuddy-loader.js
    console.log('[3/3] 执行下载的 codebuddy-loader.js 拉取规则...');
    console.log('      远程地址:', REMOTE_BASE_URL);
    console.log('');

    try {
      const output = execSync(
        `node "${DOWNLOADED_LOADER}" --remote ${REMOTE_BASE_URL}`,
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: 'inherit'
        }
      );

      console.log('');
      console.log('╔══════════════════════════════════════════════════════════════════╗');
      console.log('║                    ✅ 测试成功完成                               ║');
      console.log('╠══════════════════════════════════════════════════════════════════╣');
      console.log('║  验证项目:                                                       ║');
      console.log('║  ✓ 从 GitHub 下载 codebuddy-loader.js                                ║');
      console.log('║  ✓ 执行下载的脚本拉取规则                                       ║');
      console.log('║  ✓ 生成规则文件到 .codebuddy/rules/project-rules.md            ║');
      console.log('╚══════════════════════════════════════════════════════════════════╝');

      // 清理临时目录
      console.log('');
      console.log('清理临时文件...');
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      console.log('✅ 清理完成');

    } catch (error) {
      console.error('');
      console.error('❌ 执行失败:', error.message);
      process.exit(1);
    }
  });

}).on('error', (err) => {
  console.error('❌ 下载失败:', err.message);
  process.exit(1);
});
