#!/usr/bin/env node
/**
 * 规则加载器集成测试脚本
 *
 * 测试不同类型的模拟业务项目是否能正确生成规则文件
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 测试配置
const MOCK_PROJECTS_DIR = path.join(__dirname, 'mock-projects');
const RULE_LOADER_PATH = path.join(__dirname, '..', 'scripts', 'dist', 'rule-loader.js');

// 测试用例
const TEST_CASES = [
  {
    name: 'Vue 3 项目',
    dir: 'vue3-project',
    expectedRules: ['vue3', 'architecture', 'typescript'],
    notExpectedRules: ['vue2'],
  },
  {
    name: 'Vue 2 项目',
    dir: 'vue2-project',
    expectedRules: ['vue2-general', 'architecture', 'typescript'],
    notExpectedRules: ['vue3', 'vue2-composition'],
  },
  {
    name: 'Vue 2 + Composition API 项目',
    dir: 'vue2-composition-project',
    expectedRules: ['vue2-composition', 'architecture', 'typescript'],
    notExpectedRules: ['vue3', 'vue2-general'],
  },
  {
    name: 'Ant Design Vue 项目',
    dir: 'antdv-project',
    expectedRules: ['vue3', 'architecture', 'typescript'],
    notExpectedRules: ['vue2'],
    // 注意: antdv 规则文件尚未创建，所以不检查
  },
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarn(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

/**
 * 运行单个测试用例
 */
function runTestCase(testCase) {
  const projectDir = path.join(MOCK_PROJECTS_DIR, testCase.dir);
  const outputDir = path.join(projectDir, '.codebuddy', '.rules');
  const outputFile = path.join(outputDir, 'project-rules.md');

  log(`\n${colors.bold}测试: ${testCase.name}${colors.reset}`);
  log(`目录: ${projectDir}`);

  // 清理之前的输出
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  try {
    // 执行规则加载器
    execSync(`node "${RULE_LOADER_PATH}"`, {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    // 检查输出文件是否存在
    if (!fs.existsSync(outputFile)) {
      logError(`输出文件不存在: ${outputFile}`);
      return false;
    }

    // 读取生成的规则文件
    const content = fs.readFileSync(outputFile, 'utf-8');

    // 检查预期的规则是否存在
    let allPassed = true;

    for (const rule of testCase.expectedRules) {
      if (content.includes(rule)) {
        logSuccess(`包含预期规则: ${rule}`);
      } else {
        logError(`缺少预期规则: ${rule}`);
        allPassed = false;
      }
    }

    // 检查不应该存在的规则
    for (const rule of testCase.notExpectedRules) {
      // 使用更精确的匹配，避免误判
      const rulePattern = new RegExp(`Source:.*${rule}`, 'i');
      if (rulePattern.test(content)) {
        logError(`包含不应存在的规则: ${rule}`);
        allPassed = false;
      } else {
        logSuccess(`正确排除规则: ${rule}`);
      }
    }

    // 检查文件大小
    const stats = fs.statSync(outputFile);
    logInfo(`生成文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

    return allPassed;

  } catch (e) {
    logError(`执行失败: ${e.message}`);
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  log(`\n${colors.bold}╔══════════════════════════════════════════════════════════════════╗${colors.reset}`);
  log(`${colors.bold}║           Architect Rule Loader 集成测试                          ║${colors.reset}`);
  log(`${colors.bold}╚══════════════════════════════════════════════════════════════════╝${colors.reset}`);

  // 检查规则加载器是否存在
  if (!fs.existsSync(RULE_LOADER_PATH)) {
    logError(`规则加载器不存在: ${RULE_LOADER_PATH}`);
    logInfo('请先运行: npm run build:scripts');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    const result = runTestCase(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  // 输出总结
  log(`\n${colors.bold}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  log(`${colors.bold}测试结果汇总${colors.reset}`);
  log(`═══════════════════════════════════════════════════════════════════`);
  logSuccess(`通过: ${passed}`);
  if (failed > 0) {
    logError(`失败: ${failed}`);
  }
  log(`总计: ${passed + failed}`);

  // 退出码
  process.exit(failed > 0 ? 1 : 0);
}

main();
