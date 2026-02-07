#!/usr/bin/env node
/**
 * 规则加载器集成测试脚本
 *
 * 测试不同类型的模拟业务项目是否能正确生成规则文件
 */

const { execSync, spawnSync, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SLEEP_INT32 = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms) {
  Atomics.wait(SLEEP_INT32, 0, 0, ms);
}

function httpRequestJson({ method, url, headers = {}, body = '', timeoutMs = 5000 }) {
  const script = `
const http = require('http');
const https = require('https');
const { URL } = require('url');

const method = process.env.REQ_METHOD || 'GET';
const url = new URL(process.env.REQ_URL || 'http://127.0.0.1/');
const headers = JSON.parse(process.env.REQ_HEADERS || '{}');
const body = process.env.REQ_BODY || '';

const lib = url.protocol === 'https:' ? https : http;
const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
const timeoutMs = Number(process.env.REQ_TIMEOUT_MS || '5000');
let timer = null;

const req = lib.request({
  method,
  hostname: url.hostname,
  port,
  path: url.pathname + url.search,
  headers: {
    ...headers,
    ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
  },
}, (res) => {
  let data = '';
  res.setEncoding('utf-8');
  res.on('data', (c) => { data += c; });
  res.on('end', () => {
    if (timer) clearTimeout(timer);
    console.log(JSON.stringify({ statusCode: res.statusCode, body: data }, null, 2));
    process.exit(0);
  });
});

req.on('error', (e) => {
  if (timer) clearTimeout(timer);
  console.error(String(e && e.message ? e.message : e));
  process.exit(2);
});

if (body) req.write(body);
req.end();

timer = setTimeout(() => {
  try { req.destroy(); } catch {}
  console.error('timeout');
  process.exit(3);
}, timeoutMs);
`;

  const res = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf-8',
    stdio: 'pipe',
    env: {
      ...process.env,
      REQ_METHOD: method,
      REQ_URL: url,
      REQ_HEADERS: JSON.stringify(headers),
      REQ_BODY: body,
      REQ_TIMEOUT_MS: String(timeoutMs),
    },
  });

  if (res.status !== 0) {
    throw new Error(`httpRequest failed (exit=${res.status}): ${res.stderr || res.stdout}`);
  }

  return JSON.parse(res.stdout);
}

function startAgentCallServer(projectDir) {
  const token = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const host = '127.0.0.1';
  const script = '.codebuddy/scripts/agent-call-manager.js';

  for (let attempt = 0; attempt < 12; attempt++) {
    const port = 30000 + Math.floor(Math.random() * 20000);
    const proc = spawn(process.execPath, [script, 'serve', '--host', host, '--port', String(port), '--token', token], {
      cwd: projectDir,
      stdio: 'ignore',
    });

    // Give it a moment to bind.
    sleepSync(120);
    if (proc.exitCode !== null) {
      continue;
    }

    const baseUrl = `http://${host}:${port}`;

    // Wait health ready.
    let ok = false;
    for (let i = 0; i < 40; i++) {
      try {
        const health = httpRequestJson({ method: 'GET', url: `${baseUrl}/health`, timeoutMs: 1500 });
        if (health.statusCode === 200) {
          ok = true;
          break;
        }
      } catch {
        // ignore and retry
      }
      sleepSync(120);
    }

    if (!ok) {
      try { proc.kill(); } catch {}
      continue;
    }

    return { proc, token, baseUrl };
  }

  throw new Error('failed to start agent-call-manager serve');
}

function runOrchestratorWatch({ projectDir, taskBookId, requestId, resultAbsPath, timeoutMs = 30000 }) {
  const script = `
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = process.env.PROJECT_DIR;
const taskBookId = process.env.TASK_BOOK_ID;
const requestId = process.env.REQUEST_ID;
const resultAbsPath = process.env.RESULT_ABS_PATH;
const timeoutMs = Number(process.env.WATCH_TIMEOUT_MS || '30000');

if (!projectDir || !taskBookId || !requestId || !resultAbsPath) {
  console.error('missing env');
  process.exit(2);
}

function writePlannerResult() {
  fs.mkdirSync(path.dirname(resultAbsPath), { recursive: true });
  const plannerResult = {
    requestId,
    kind: 'planner',
    status: 'success',
    output: {
      tasks: [
        { planId: 'T1', title: 'Analyze only 1', type: 'analysis', priority: 'critical' },
        { planId: 'T2', title: 'Analyze only 2', type: 'analysis', dependencies: ['T1'] },
      ],
    },
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync(resultAbsPath, JSON.stringify(plannerResult, null, 2), 'utf-8');
}

const child = spawn(process.execPath, [
  '.codebuddy/scripts/task-orchestrator.js',
  '--taskbook', taskBookId,
  '--tasks-only',
  '--watch',
  '--watch-timeout-ms', String(timeoutMs),
  '--json',
], { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] });

let stdout = '';
let stderr = '';
child.stdout.setEncoding('utf-8');
child.stderr.setEncoding('utf-8');
child.stdout.on('data', (c) => { stdout += c; });
child.stderr.on('data', (c) => { stderr += c; });

const writeTimer = setTimeout(writePlannerResult, 200);
const hardTimer = setTimeout(() => {
  try { child.kill(); } catch {}
}, timeoutMs + 5000);

child.on('error', (e) => {
  clearTimeout(writeTimer);
  clearTimeout(hardTimer);
  console.error(String(e && e.message ? e.message : e));
  process.exit(3);
});

child.on('close', (code) => {
  clearTimeout(writeTimer);
  clearTimeout(hardTimer);
  console.log(JSON.stringify({ exitCode: code, stdout, stderr }, null, 2));
  process.exit(0);
});
`;

  const res = spawnSync(process.execPath, ['-e', script], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: 'pipe',
    env: {
      ...process.env,
      PROJECT_DIR: projectDir,
      TASK_BOOK_ID: taskBookId,
      REQUEST_ID: requestId,
      RESULT_ABS_PATH: resultAbsPath,
      WATCH_TIMEOUT_MS: String(timeoutMs),
    },
  });

  if (res.status !== 0) {
    throw new Error(`watch wrapper failed (exit=${res.status}): ${res.stderr || res.stdout}`);
  }

  return JSON.parse(res.stdout);
}

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
  const ruleValidatorFile = path.join(scriptsDir, 'rule-validator.js');
  const skillValidatorFile = path.join(scriptsDir, 'skill-validator.js');
  const agentRegistryFile = path.join(scriptsDir, 'agent-registry.js');
  const agentCallManagerFile = path.join(scriptsDir, 'agent-call-manager.js');
  const taskOrchestratorFile = path.join(scriptsDir, 'task-orchestrator.js');
  const workflowDir = path.join(projectDir, '.codebuddy', 'workflows');
  const workflowFile = path.join(workflowDir, 'default.workflow.json');
  const workflowSchemaFile = path.join(workflowDir, 'workflow.schema.json');
  const taskbooksDir = path.join(projectDir, '.codebuddy', 'taskbooks');
  const taskbookSchemaFile = path.join(taskbooksDir, 'taskbook.schema.json');
  const reportsDir = path.join(projectDir, '.codebuddy', 'reports');
  const commandsDir = path.join(projectDir, '.codebuddy', 'commands');
  const agentCallCommandFile = path.join(commandsDir, 'agent-call.md');
  const agentCallsDir = path.join(projectDir, '.codebuddy', 'agent-calls');
  const agentCallSchemaFile = path.join(agentCallsDir, 'agent-call.schema.json');

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
  if (fs.existsSync(agentCallsDir)) {
    fs.rmSync(agentCallsDir, { recursive: true, force: true });
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

    if (!fs.existsSync(ruleValidatorFile)) {
      logError(`rule-validator 脚本不存在: ${ruleValidatorFile}`);
      return false;
    }
    logSuccess('已生成 scripts: rule-validator.js');

    if (!fs.existsSync(skillValidatorFile)) {
      logError(`skill-validator 脚本不存在: ${skillValidatorFile}`);
      return false;
    }
    logSuccess('已生成 scripts: skill-validator.js');

    if (!fs.existsSync(agentRegistryFile)) {
      logError(`agent-registry 脚本不存在: ${agentRegistryFile}`);
      return false;
    }
    logSuccess('已生成 scripts: agent-registry.js');

    if (!fs.existsSync(taskOrchestratorFile)) {
      logError(`task-orchestrator 脚本不存在: ${taskOrchestratorFile}`);
      return false;
    }
    logSuccess('已生成 scripts: task-orchestrator.js');

    if (!fs.existsSync(agentCallManagerFile)) {
      logError(`agent-call-manager 脚本不存在: ${agentCallManagerFile}`);
      return false;
    }
    logSuccess('已生成 scripts: agent-call-manager.js');

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

    // 检查 commands 是否分发成功
    if (!fs.existsSync(agentCallCommandFile)) {
      logError(`agent-call command 文件不存在: ${agentCallCommandFile}`);
      return false;
    }
    logSuccess('已生成 commands: agent-call.md');

    // 检查 agent-calls schema 是否分发成功
    if (!fs.existsSync(agentCallSchemaFile)) {
      logError(`agent-call schema 文件不存在: ${agentCallSchemaFile}`);
      return false;
    }
    logSuccess('已生成 agent-calls 配置: agent-call.schema.json');

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

    // E2E: agent-registry list/show
    try {
      const listRaw = execSync(
        'node ".codebuddy/scripts/agent-registry.js" list --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const list = JSON.parse(listRaw);
      const agents = Array.isArray(list.agents) ? list.agents : [];
      const planner = agents.find(a => a && a.id === 'planner');
      if (!list || list.ok !== true || typeof list.agentCount !== 'number' || list.agentCount !== agents.length || !planner) {
        throw new Error(`agent-registry list 输出无效: ${listRaw.slice(0, 1200)}`);
      }

      const showRaw = execSync(
        'node ".codebuddy/scripts/agent-registry.js" show planner --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const show = JSON.parse(showRaw);
      if (!show || show.ok !== true || !show.agent || show.agent.id !== 'planner') {
        throw new Error(`agent-registry show 输出无效: ${showRaw.slice(0, 1200)}`);
      }

      let notFoundFailed = false;
      try {
        execSync(
          'node ".codebuddy/scripts/agent-registry.js" show __no_such_agent__ --json',
          { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
        );
      } catch {
        notFoundFailed = true;
      }
      if (!notFoundFailed) {
        throw new Error('agent-registry show not_found 应返回非 0 exitCode');
      }

      logSuccess('agent-registry list/show 通过');
    } catch (e) {
      logError(`agent-registry E2E 失败: ${e.message}`);
      allPassed = false;
    }

    // E2E: rule-validator / skill-validator（确保脚本可在业务项目运行）
    try {
      const ruleRaw = execSync('node ".codebuddy/scripts/rule-validator.js" check --json', {
        cwd: projectDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      const ruleReport = JSON.parse(ruleRaw);
      if (!ruleReport || ruleReport.ok !== true || typeof ruleReport.checkedFileCount !== 'number') {
        throw new Error(`rule-validator 输出无效: ${ruleRaw.slice(0, 1200)}`);
      }

      const skillRaw = execSync('node ".codebuddy/scripts/skill-validator.js" check --json', {
        cwd: projectDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      const skillReport = JSON.parse(skillRaw);
      if (!skillReport || skillReport.ok !== true || typeof skillReport.checkedSkillCount !== 'number') {
        throw new Error(`skill-validator 输出无效: ${skillRaw.slice(0, 1200)}`);
      }

      logSuccess('rule-validator / skill-validator 通过');
    } catch (e) {
      logError(`validator E2E 失败: ${e.message}`);
      allPassed = false;
    }

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

    // E2E: planner -> apply-plan (文件协议)
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Planner" --description "mock e2e planner" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;
      const revision = typeof taskBook.revision === 'number' ? taskBook.revision : 0;

      const planRaw = execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" plan ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const plan = JSON.parse(planRaw);
      const requestId = plan.requestId;

      if (!requestId || !plan.promptPath || !plan.resultPath) {
        throw new Error('planner plan 输出缺少 requestId/promptPath/resultPath');
      }
      if (!fs.existsSync(plan.promptPath)) {
        throw new Error(`planner prompt.md 不存在: ${plan.promptPath}`);
      }

      const result = {
        requestId,
        status: 'success',
        output: {
          tasks: [
            { planId: 'T1', title: 'Analyze requirement', type: 'analysis' },
            { planId: 'T2', title: 'Design approach', type: 'design', dependencies: ['T1'] },
            { planId: 'T3', title: 'Implement changes', type: 'implement', dependencies: ['T2'] },
          ],
        },
        completedAt: new Date().toISOString(),
      };

      fs.writeFileSync(plan.resultPath, JSON.stringify(result, null, 2), 'utf-8');

      const applyRaw = execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" apply-plan ${taskBookId} ${requestId} --if-rev ${revision} --json`,
        {
          cwd: projectDir,
          stdio: 'pipe',
          encoding: 'utf-8',
          env: { ...process.env, CODEBUDDY_TASKBOOK_REQUIRE_IF_REV: '1' },
        }
      );

      const applied = JSON.parse(applyRaw);
      const tb = applied.taskBook;
      const map = applied.planIdToTaskId;

      if (!tb || !Array.isArray(tb.tasks)) {
        throw new Error('apply-plan 未返回 taskBook');
      }
      if (!map || typeof map !== 'object') {
        throw new Error('apply-plan 未返回 planIdToTaskId');
      }

      const t1 = tb.tasks.find(t => t.id === map.T1);
      const t2 = tb.tasks.find(t => t.id === map.T2);
      const t3 = tb.tasks.find(t => t.id === map.T3);

      if (!t1 || !t2 || !t3) {
        throw new Error('apply-plan: 任务映射不完整');
      }
      if (!Array.isArray(t2.dependencies) || t2.dependencies[0] !== t1.id) {
        throw new Error('apply-plan: T2 dependencies 映射错误');
      }
      if (!Array.isArray(t3.dependencies) || t3.dependencies[0] !== t2.id) {
        throw new Error('apply-plan: T3 dependencies 映射错误');
      }
      if (typeof tb.revision === 'number' && tb.revision !== revision + 1) {
        throw new Error(`apply-plan: revision 未按预期增长 (expected ${revision + 1}, got ${tb.revision})`);
      }

      logSuccess('planner -> apply-plan 闭环通过（含 --if-rev 并发保护）');
    } catch (e) {
      logError(`planner E2E 失败: ${e.message}`);
      allPassed = false;
    }

    // E2E: MANUAL_REQUIRED -> agent-call prompt/result -> resume
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E AgentCall" --description "mock e2e agent-call" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Do implementation" --type implement --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const first = spawnSync(process.execPath, ['.codebuddy/scripts/task-executor.js', taskBookId, '--tasks-only'], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (first.status !== 2) {
        throw new Error(`首次执行应为 blocked (exit=2)，实际 exit=${first.status}, stderr=${first.stderr}`);
      }

      const activeTbFile = path.join(taskbooksDir, 'active', `${taskBookId}.json`);
      if (!fs.existsSync(activeTbFile)) {
        throw new Error(`TaskBook active 文件不存在: ${activeTbFile}`);
      }

      const tb1 = JSON.parse(fs.readFileSync(activeTbFile, 'utf-8'));
      const blocked = tb1.tasks.find(t => t && t.status === 'blocked');
      if (!blocked || !blocked.blockedReason) {
        throw new Error('未找到 blocked 任务或 blockedReason 为空');
      }

      const metaLine = String(blocked.blockedReason).split(/\r?\n/).map(s => s.trim()).find(s => s.startsWith('[agent-call]'));
      if (!metaLine) {
        throw new Error('blockedReason 未包含 [agent-call] 元数据');
      }
      const meta = JSON.parse(metaLine.slice('[agent-call]'.length).trim());
      if (!meta.requestId || !meta.promptPath || !meta.resultPath) {
        throw new Error('agent-call 元数据缺少 requestId/promptPath/resultPath');
      }

      const promptPath = path.join(projectDir, meta.promptPath);
      const resultPath = path.join(projectDir, meta.resultPath);
      if (!fs.existsSync(promptPath)) {
        throw new Error(`agent-call prompt 不存在: ${promptPath}`);
      }

      const promptMd = fs.readFileSync(promptPath, 'utf-8');
      const headerMatch = promptMd.match(/```json\s*([\s\S]*?)\s*```/);
      if (!headerMatch) {
        throw new Error('agent-call prompt 缺少 header JSON code block');
      }
      const header = JSON.parse(headerMatch[1]);
      if (!header || typeof header.taskBookRevision !== 'number' || header.taskBookRevision < 0) {
        throw new Error('agent-call prompt header 缺少 taskBookRevision（或格式错误）');
      }
      if (typeof header.agentVersion !== 'string' || !header.agentVersion.trim()) {
        throw new Error('agent-call prompt header 缺少 agentVersion（或格式错误）');
      }

      const result = {
        requestId: meta.requestId,
        status: 'success',
        output: { actualWork: 'Implemented feature X; ran tests Y; verified Z.' },
        completedAt: new Date().toISOString(),
      };
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');

      const second = spawnSync(process.execPath, ['.codebuddy/scripts/task-executor.js', taskBookId, '--tasks-only'], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (second.status !== 0) {
        throw new Error(`写回 result.json 后应完成 (exit=0)，实际 exit=${second.status}, stderr=${second.stderr}`);
      }

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      if (!fs.existsSync(historyTbFile)) {
        throw new Error(`TaskBook history 文件不存在: ${historyTbFile}`);
      }

      const tb2 = JSON.parse(fs.readFileSync(historyTbFile, 'utf-8'));
      const done = tb2.tasks.find(t => t && t.type === 'implement');
      if (!done || done.status !== 'done') {
        throw new Error('agent-call apply 后 implement 任务未变为 done');
      }
      if (!done.actualWork || !String(done.actualWork).includes('Implemented feature')) {
        throw new Error('agent-call apply 后 actualWork 未写入');
      }

      const reportRaw = execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" report ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const report = JSON.parse(reportRaw);
      if (!report || !Array.isArray(report.agentCalls) || report.agentCalls.length === 0) {
        throw new Error('acceptance report 未包含 agentCalls[]');
      }
      const appliedEvent = report.agentCalls.find(a => a && a.requestId === meta.requestId && a.action === 'applied');
      if (!appliedEvent) {
        throw new Error('acceptance report 未包含 agent-call applied 事件');
      }

      logSuccess('MANUAL_REQUIRED -> agent-call -> resume 闭环通过');
    } catch (e) {
      logError(`agent-call E2E 失败: ${e.message}`);
      allPassed = false;
    }

    // E2E: priority scheduling (higher priority first)
    try {
      const tbRaw = execSync(
        'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Priority" --description "mock e2e priority" --type new-feature --json',
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      const taskBook = JSON.parse(tbRaw);
      const taskBookId = taskBook.id;

      // Deliberately create in non-priority order to verify scheduler sorting.
      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Low priority analysis" --type analysis --priority low --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Medium priority analysis" --type analysis --priority medium --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );
      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" add-task ${taskBookId} --title "Critical priority analysis" --type analysis --priority critical --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      execSync(
        `node ".codebuddy/scripts/taskbook-manager.js" confirm ${taskBookId} --json`,
        { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
      );

      const run = spawnSync(process.execPath, ['.codebuddy/scripts/task-executor.js', taskBookId, '--tasks-only', '--max-parallel', '1'], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      if (run.status !== 0) {
        throw new Error(`priority 执行失败: exit=${run.status}, stderr=${run.stderr}`);
      }

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      if (!fs.existsSync(historyTbFile)) {
        throw new Error(`priority: TaskBook history 文件不存在: ${historyTbFile}`);
      }

      const tb = JSON.parse(fs.readFileSync(historyTbFile, 'utf-8'));
      const tasks = Array.isArray(tb.tasks) ? tb.tasks : [];
      const analysisTasks = tasks.filter(t => t && t.type === 'analysis');
      if (analysisTasks.length !== 3) {
        throw new Error(`priority: analysis tasks 数量不对 (expected 3, got ${analysisTasks.length})`);
      }

      const startedSorted = [...analysisTasks].sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')));
      const firstTitle = startedSorted[0]?.title;
      if (firstTitle !== 'Critical priority analysis') {
        throw new Error(`priority: 未按优先级先执行 critical (first=${firstTitle})`);
      }

      logSuccess('priority 调度通过（critical 优先）');
    } catch (e) {
      logError(`priority E2E 失败: ${e.message}`);
      allPassed = false;
    }

    // E2E: task-orchestrator (one-command closed loop, tasks-only for speed)
    try {
      const firstRun = spawnSync(process.execPath, [
        '.codebuddy/scripts/task-orchestrator.js',
        'E2E Orchestrator requirement',
        '--type', 'new-feature',
        '--tasks-only',
        '--json',
      ], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (firstRun.status !== 2) {
        throw new Error(`orchestrator 首次应为 blocked(exit=2)，实际 exit=${firstRun.status}, stderr=${firstRun.stderr}`);
      }

      const blocked = JSON.parse(firstRun.stdout);
      if (!blocked || blocked.status !== 'blocked' || !blocked.taskBookId) {
        throw new Error('orchestrator blocked 输出无效');
      }

      const taskBookId = blocked.taskBookId;
      const details = blocked.details || {};
      const requestId = details.requestId;
      const resultPath = details.resultPath;

      if (!requestId || !resultPath) {
        throw new Error('orchestrator blocked 输出缺少 requestId/resultPath');
      }

      const resultAbsPath = path.isAbsolute(resultPath) ? resultPath : path.join(projectDir, resultPath);
      const plannerResult = {
        requestId,
        status: 'success',
        output: {
          tasks: [
            { planId: 'T1', title: 'Analyze only 1', type: 'analysis', priority: 'critical' },
            { planId: 'T2', title: 'Analyze only 2', type: 'analysis', dependencies: ['T1'] },
          ],
        },
        completedAt: new Date().toISOString(),
      };
      fs.writeFileSync(resultAbsPath, JSON.stringify(plannerResult, null, 2), 'utf-8');

      const secondRun = spawnSync(process.execPath, [
        '.codebuddy/scripts/task-orchestrator.js',
        '--taskbook', taskBookId,
        '--tasks-only',
        '--json',
      ], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (secondRun.status !== 0) {
        throw new Error(`orchestrator 继续执行应完成(exit=0)，实际 exit=${secondRun.status}, stderr=${secondRun.stderr}`);
      }

      const completed = JSON.parse(secondRun.stdout);
      if (!completed || completed.status !== 'completed' || completed.taskBookId !== taskBookId) {
        throw new Error('orchestrator completed 输出无效');
      }

      const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
      if (!fs.existsSync(historyTbFile)) {
        throw new Error(`orchestrator: TaskBook 未归档到 history: ${historyTbFile}`);
      }

      logSuccess('task-orchestrator 闭环通过（tasks-only）');
    } catch (e) {
      logError(`task-orchestrator E2E 失败: ${e.message}`);
      allPassed = false;
    }

    // E2E: task-orchestrator --watch (auto-resume without manual rerun; run once for speed)
    if (testCase.dir === 'vue3-project') {
      try {
        const tbRaw = execSync(
          'node ".codebuddy/scripts/taskbook-manager.js" create --title "E2E Watch" --description "mock e2e watch" --type new-feature --json',
          { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' }
        );
        const taskBookId = JSON.parse(tbRaw).id;

        const requestId = `req-planner-${crypto.createHash('sha1').update(taskBookId).digest('hex').slice(0, 10)}`;
        const resultAbsPath = path.join(projectDir, '.codebuddy', 'agent-calls', `${requestId}.result.json`);
        fs.mkdirSync(path.dirname(resultAbsPath), { recursive: true });

        const watched = runOrchestratorWatch({ projectDir, taskBookId, requestId, resultAbsPath, timeoutMs: 30000 });
        if (watched.exitCode !== 0) {
          throw new Error(`watch orchestrator exit!=0: exit=${watched.exitCode}, stderr=${String(watched.stderr || '').slice(0, 2000)}`);
        }

        const out = String(watched.stdout || '').trim();
        const completed = out ? JSON.parse(out) : null;
        if (!completed || completed.status !== 'completed' || completed.taskBookId !== taskBookId) {
          throw new Error(`watch orchestrator completed 输出无效: ${out}`);
        }

        const historyTbFile = path.join(taskbooksDir, 'history', `${taskBookId}.json`);
        if (!fs.existsSync(historyTbFile)) {
          throw new Error(`watch orchestrator: TaskBook 未归档到 history: ${historyTbFile}`);
        }

        logSuccess('task-orchestrator --watch 通过（自动恢复）');
      } catch (e) {
        logError(`task-orchestrator --watch E2E 失败: ${e.message}`);
        allPassed = false;
      }
    }

    // E2E: agent-call-manager serve (remote orchestrate + writeback)
    try {
      const server = startAgentCallServer(projectDir);
      try {
        const headers = { Authorization: `Bearer ${server.token}`, 'Content-Type': 'application/json' };

        const first = httpRequestJson({
          method: 'POST',
          url: `${server.baseUrl}/orchestrate`,
          headers,
          body: JSON.stringify({ requirement: 'E2E Remote Orchestrate', type: 'new-feature', tasksOnly: true }),
          timeoutMs: 30000,
        });
        const firstBody = JSON.parse(first.body);
        if (!firstBody || firstBody.ok !== true || firstBody.exitCode !== 2) {
          throw new Error(`remote orchestrate 首次应 blocked(exit=2): ${first.body}`);
        }

        const outcome1 = firstBody.outcome;
        if (!outcome1 || outcome1.status !== 'blocked' || !outcome1.taskBookId) {
          throw new Error(`remote orchestrate outcome 无效: ${first.body}`);
        }

        const taskBookId = outcome1.taskBookId;
        const requestId = outcome1.details && outcome1.details.requestId;
        if (!requestId) {
          throw new Error(`remote orchestrate 未返回 planner requestId: ${first.body}`);
        }

        const plannerResult = {
          requestId,
          kind: 'planner',
          status: 'success',
          output: {
            tasks: [
              { planId: 'T1', title: 'Analyze only 1', type: 'analysis', priority: 'critical' },
              { planId: 'T2', title: 'Analyze only 2', type: 'analysis', dependencies: ['T1'] },
            ],
          },
          completedAt: new Date().toISOString(),
        };

        const write = httpRequestJson({
          method: 'PUT',
          url: `${server.baseUrl}/agent-calls/${encodeURIComponent(requestId)}/result`,
          headers,
          body: JSON.stringify(plannerResult),
          timeoutMs: 15000,
        });
        const writeBody = JSON.parse(write.body);
        if (!writeBody || writeBody.ok !== true) {
          throw new Error(`remote writeback 失败: ${write.body}`);
        }

        const second = httpRequestJson({
          method: 'POST',
          url: `${server.baseUrl}/orchestrate`,
          headers,
          body: JSON.stringify({ taskBookId, tasksOnly: true }),
          timeoutMs: 30000,
        });
        const secondBody = JSON.parse(second.body);
        if (!secondBody || secondBody.ok !== true || secondBody.exitCode !== 0) {
          throw new Error(`remote orchestrate 继续应完成(exit=0): ${second.body}`);
        }
        const outcome2 = secondBody.outcome;
        if (!outcome2 || outcome2.status !== 'completed') {
          throw new Error(`remote orchestrate completed 输出无效: ${second.body}`);
        }

        logSuccess('agent-call-manager serve 远程闭环通过（orchestrate + writeback）');
      } finally {
        try { server.proc.kill(); } catch {}
      }
    } catch (e) {
      logError(`agent-call-manager serve E2E 失败: ${e.message}`);
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
