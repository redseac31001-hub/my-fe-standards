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
const RULE_LOADER_PATH = path.join(__dirname, '..', 'scripts', 'dist', 'codebuddy-loader.js');

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
  const outputDir = path.join(projectDir, '.codebuddy', 'rules');
  const outputFile = path.join(outputDir, 'project-rules.md');
  const scriptsDir = path.join(projectDir, '.codebuddy', 'scripts');
  const contractValidatorFile = path.join(scriptsDir, 'contract-validator.js');
  const workflowDir = path.join(projectDir, '.codebuddy', 'workflows');
  const workflowFile = path.join(workflowDir, 'default.workflow.json');
  const workflowSchemaFile = path.join(workflowDir, 'workflow.schema.json');
  const taskbooksDir = path.join(projectDir, '.codebuddy', 'taskbooks');
  const taskbookSchemaFile = path.join(taskbooksDir, 'taskbook.schema.json');
  const reportsDir = path.join(projectDir, '.codebuddy', 'reports');

  log(`\n${colors.bold}测试: ${testCase.name}${colors.reset}`);
  log(`目录: ${projectDir}`);

  // 清理之前的输出
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  if (fs.existsSync(scriptsDir)) {
    fs.rmSync(scriptsDir, { recursive: true, force: true });
  }
  if (fs.existsSync(workflowDir)) {
    fs.rmSync(workflowDir, { recursive: true, force: true });
  }
  if (fs.existsSync(taskbooksDir)) {
    fs.rmSync(taskbooksDir, { recursive: true, force: true });
  }
  if (fs.existsSync(reportsDir)) {
    fs.rmSync(reportsDir, { recursive: true, force: true });
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

    // 检查 scripts 是否分发成功（合约校验器）
    if (!fs.existsSync(contractValidatorFile)) {
      logError(`contract-validator 脚本不存在: ${contractValidatorFile}`);
      return false;
    }
    logSuccess('已生成 scripts: contract-validator.js');

    // 检查 workflows 是否分发成功
    if (!fs.existsSync(workflowFile)) {
      logError(`workflow 文件不存在: ${workflowFile}`);
      return false;
    }
    if (!fs.existsSync(workflowSchemaFile)) {
      logError(`workflow schema 文件不存在: ${workflowSchemaFile}`);
      return false;
    }
    logSuccess('已生成 workflows 配置: default.workflow.json + workflow.schema.json');

    // 检查 TaskBook schema 是否分发成功
    if (!fs.existsSync(taskbookSchemaFile)) {
      logError(`taskbook schema 文件不存在: ${taskbookSchemaFile}`);
      return false;
    }
    logSuccess('已生成 taskbooks 配置: taskbook.schema.json');

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

    // E2E: 模拟业务项目交互流程（加载 -> 创建 TaskBook -> 执行 workflow -> 验收归档）
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Workflow" --description "mock e2e" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Analyze project" --type analysis --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/task-executor.js" ${taskBookId} --approve review_passed`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const activeTbFile = path.join(taskbooksDir, 'active', `${taskBookId}.json`);
      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      const acceptanceFile = path.join(reportsDir, 'taskbooks', `${taskBookId}.acceptance.json`);
      const archReport = path.join(reportsDir, 'architecture', 'latest.json');
      const modulesReport = path.join(reportsDir, 'modules', 'latest.json');

      if (fs.existsSync(activeTbFile)) {
        logError(`TaskBook 未归档（active 仍存在）: ${activeTbFile}`);
        allPassed = false;
      }
      if (!fs.existsSync(historyTbFile)) {
        logError(`TaskBook 归档文件不存在: ${historyTbFile}`);
        allPassed = false;
      }
      if (!fs.existsSync(acceptanceFile)) {
        logError(`验收报告不存在: ${acceptanceFile}`);
        allPassed = false;
      }
      if (!fs.existsSync(archReport)) {
        logError(`architecture report 不存在: ${archReport}`);
        allPassed = false;
      }
      if (!fs.existsSync(modulesReport)) {
        logError(`modules report 不存在: ${modulesReport}`);
        allPassed = false;
      }

      if (allPassed) {
        logSuccess('workflow 单任务闭环通过（含 gates + 验收归档）');
      }
    } catch (e) {
      logError(`workflow E2E 失败: ${e.message}`);
      allPassed = false;
    }

    // E2E: batching - multiple tasks -> multiple batches -> multiple smoke gates
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Batching" --description "mock e2e batching" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      const batchTasks = [
        { title: 'Batch task 1', files: ['src/batch/a1.ts', 'src/batch/a2.ts', 'src/batch/a3.ts'] },
        { title: 'Batch task 2', files: ['src/batch/b1.ts', 'src/batch/b2.ts', 'src/batch/b3.ts'] },
        { title: 'Batch task 3', files: ['src/batch/c1.ts', 'src/batch/c2.ts', 'src/batch/c3.ts'] },
        { title: 'Batch task 4', files: ['src/batch/d1.ts', 'src/batch/d2.ts', 'src/batch/d3.ts'] },
      ];

      for (const t of batchTasks) {
        execSync(
          `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title \"${t.title}\" --type analysis --files \"${t.files.join(',')}\" --json`,
          { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
        );
      }

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/task-executor.js" ${taskBookId} --approve review_passed`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      const acceptanceFile = path.join(reportsDir, 'taskbooks', `${taskBookId}.acceptance.json`);

      if (!fs.existsSync(historyTbFile)) {
        logError(`Batching: TaskBook 归档文件不存在: ${historyTbFile}`);
        allPassed = false;
      } else {
        const tb = JSON.parse(fs.readFileSync(historyTbFile, 'utf-8'));
        const changelog = Array.isArray(tb.changelog) ? tb.changelog : [];

        const smokeGateEvents = changelog.filter(e => e && e.after && e.after.event === 'gate' && e.after.gateId === 'smoke_passed' && e.after.stepId === 'implement');
        const batchEvents = changelog.filter(e => e && e.after && e.after.event === 'batch' && e.after.stepId === 'implement');

        if (smokeGateEvents.length < 2) {
          logError(`Batching: smoke_passed gate events too few (expected >=2, got ${smokeGateEvents.length})`);
          allPassed = false;
        } else {
          logSuccess(`Batching: smoke_passed gate events = ${smokeGateEvents.length}`);
        }

        if (batchEvents.length < 4) {
          logError(`Batching: batch events too few (expected >=4, got ${batchEvents.length})`);
          allPassed = false;
        } else {
          logSuccess(`Batching: batch events = ${batchEvents.length}`);
        }
      }

      if (!fs.existsSync(acceptanceFile)) {
        logError(`Batching: 验收报告不存在: ${acceptanceFile}`);
        allPassed = false;
      }

      if (allPassed) {
        logSuccess('workflow batching 通过（多 batch + 多次 smoke gate）');
      }
    } catch (e) {
      logError(`workflow batching E2E 失败: ${e.message}`);
      allPassed = false;
    }

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
  log(`${colors.bold}║           CodeBuddy Loader 集成测试                                ║${colors.reset}`);
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
