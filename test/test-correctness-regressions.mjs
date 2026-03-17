import assert from 'node:assert/strict';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const agentRuntimeDistPath = path.join(repoRoot, 'scripts', 'dist', 'agent-runtime.js');
const mcpServerDistPath = path.join(repoRoot, 'mcp-server', 'dist', 'index.js');
const distributionProfilesDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'distribution-profiles.js');
const taskBookManagerDistPath = path.join(repoRoot, 'scripts', 'dist', 'taskbook-manager.js');
const taskExecutorDistPath = path.join(repoRoot, 'scripts', 'dist', 'task-executor.js');
const taskOrchestratorDistPath = path.join(repoRoot, 'scripts', 'dist', 'task-orchestrator.js');
const toolConverterDistPath = path.join(repoRoot, 'scripts', 'dist', 'tool-converter.js');
const tempRoot = path.join(repoRoot, 'temp', 'test-correctness-regressions');

function assertBuiltArtifactExists(filePath, hintCommand) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing built artifact: ${filePath}\nrun: ${hintCommand}`);
  }
}

async function writeText(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, 'utf-8');
}

async function writeJson(filePath, data) {
  await writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function testAgentRuntimeLoadsInstalledRules() {
  assertBuiltArtifactExists(agentRuntimeDistPath, 'npm run build:scripts');
  const { createAgentRuntime } = require(agentRuntimeDistPath);

  const projectRoot = path.join(
    tempRoot,
    `agent-runtime-project-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(projectRoot, { recursive: true });

  const installState = {
    schemaVersion: '1.2.0',
    version: 'test',
    installedAt: new Date().toISOString(),
    mode: 'local',
    profile: 'analysis',
    enableOrchestrator: false,
    contentHash: 'test',
    source: {
      remoteBaseUrl: null,
      manifestVersion: null,
    },
    options: {
      taskType: null,
      ruleLevel: 'summary',
      strictRemotePack: false,
      relevanceThreshold: 0.3,
      workspaceDiscovery: true,
      workspaceScope: 'workspace-union',
      targetProject: null,
      targetRole: null,
    },
    outputs: {
      rulesFile: '.codebuddy/rules/project-rules.md',
      workspaceIndexFile: null,
      agentsRootDir: '.codebuddy/agent-snapshots/current',
      agentsSnapshotRetention: 3,
      skillsRootDir: null,
      skillsSnapshotRetention: null,
    },
    managedFiles: [],
    stats: {
      layer1Rules: 2,
      layer2Indexes: 0,
      layer3Indexes: 1,
      skills: 0,
      agents: 1,
      scripts: 0,
      workflows: 0,
      taskbooks: 0,
      agentCalls: 0,
      commands: 0,
      workspaceProjects: 1,
    },
  };

  await writeJson(path.join(projectRoot, '.codebuddy', 'install.json'), installState);
  await writeText(
    path.join(projectRoot, '.codebuddy', 'agent-snapshots', 'current', 'sample-agent', 'AGENT.md'),
    [
      '---',
      'name: sample-agent',
      'description: sample runtime agent',
      'permissions:',
      '  tools:',
      '    - read_file',
      'dependencies:',
      '  layer1_base:',
      '    - clean-code',
      '    - architecture/feature-based-structure',
      '  layer3_action:',
      '    - testing',
      '---',
      '',
      '# Sample Agent',
      '',
      'Used for correctness regression coverage.',
      '',
    ].join('\n'),
  );
  await writeText(
    path.join(projectRoot, '.codebuddy', 'rules_cache', 'layer1_reference', 'code-quality', 'clean-code.md'),
    '# Clean Code\n\nLoaded from installed cache.\n',
  );
  await writeText(
    path.join(projectRoot, '.codebuddy', 'rules_cache', 'layer1_reference', 'architecture', 'feature-based-structure.md'),
    '# Feature Based Structure\n\nLoaded from nested installed cache.\n',
  );
  await writeText(
    path.join(projectRoot, '.codebuddy', 'rules_cache', 'layer3_action', 'testing.md'),
    '# Testing\n\nLoaded from action cache.\n',
  );

  assert.equal(fs.existsSync(path.join(projectRoot, 'rules')), false, 'test fixture must not contain source rules directory');

  const runtime = createAgentRuntime({
    projectRoot,
    agentsDir: '.codebuddy/agent-snapshots/current',
  });

  runtime.loadAll();
  const agent = runtime.getAgent('sample-agent');
  assert(agent, 'sample-agent should be loaded from installed agents root');
  assert.match(agent.rules['layer1_base/clean-code'] || '', /Loaded from installed cache/);
  assert.match(agent.rules['layer1_base/architecture\/feature-based-structure'] || '', /Loaded from nested installed cache/);
  assert.match(agent.rules['layer3_action/testing'] || '', /Loaded from action cache/);
}

async function testMcpAnalyzeProjectStructure() {
  assertBuiltArtifactExists(mcpServerDistPath, 'npm run build --prefix mcp-server');
  const moduleUrl = pathToFileURL(mcpServerDistPath).href;
  const imported = await import(moduleUrl);

  assert.equal(typeof imported.resolveBundledScriptPath, 'function');

  const resolvedScriptPath = imported.resolveBundledScriptPath('../../scripts/dist/structure-analyzer.js');
  assert.equal(
    path.normalize(resolvedScriptPath),
    path.normalize(path.join(repoRoot, 'scripts', 'dist', 'structure-analyzer.js')),
  );
  assert.equal(fs.existsSync(resolvedScriptPath), true, 'resolved structure-analyzer script should exist');
}

async function testScriptDistributionIncludesRuntimeLibs() {
  assertBuiltArtifactExists(distributionProfilesDistPath, 'npm run build:scripts');
  const { getScriptArtifactsForProfile } = require(distributionProfilesDistPath);

  const fullArtifacts = getScriptArtifactsForProfile('full');
  const expectedArtifacts = [
    'skill-validator.js',
    'agent-registry.js',
    'agent-runtime.js',
    'result-aggregator.js',
    'taskbook-manager.js',
    'task-executor.js',
    'lib/cli-entry.js',
    'lib/frontmatter-utils.js',
    'lib/install-roots.js',
    'lib/install-sync.js',
    'lib/project-detection.js',
    'lib/worker-executor.js',
    'lib/workflow-routing.js',
    'lib/workflow-routing-selection.js',
    'lib/execution-metrics.js',
    'types/module-mapper.js',
    'types/structure-analyzer.js',
  ];

  for (const expectedArtifact of expectedArtifacts) {
    assert.equal(
      fullArtifacts.includes(expectedArtifact),
      true,
      `full profile should distribute ${expectedArtifact}`,
    );
  }
}

async function testTaskExecutorPersistsHandoffs() {
  assertBuiltArtifactExists(agentRuntimeDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskExecutorDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const { createTaskExecutor } = require(taskExecutorDistPath);
  const { createAgentRuntime } = require(agentRuntimeDistPath);

  const projectRoot = path.join(
    tempRoot,
    `task-executor-handoffs-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'agent-calls'), { recursive: true });
  await writeText(path.join(projectRoot, 'agents', 'code-reviewer', 'AGENT.md'), [
    '---',
    'name: code-reviewer',
    'description: reviews implementation changes with upstream context',
    '---',
    '',
    '# Code Reviewer',
    '',
    'Please review the implementation and use all incoming task handoffs before commenting.',
    '',
  ].join('\n'));

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'handoff regression',
    description: 'ensure dependent tasks receive handoff metadata',
    taskType: 'new-feature',
  });

  manager.addTask(taskBook.id, {
    title: 'Implement the feature',
    type: 'implement',
    priority: 'high',
    acceptanceCriteria: ['feature implemented'],
    scope: { files: ['src/feature.ts'] },
  });
  manager.addTask(taskBook.id, {
    title: 'Review the implementation',
    type: 'review',
    dependencies: ['task-1'],
    acceptanceCriteria: ['review completed'],
    scope: { files: ['src/feature.ts'] },
  });
  manager.updateStatus(taskBook.id, 'confirmed');

  const runtime = createAgentRuntime({
    projectRoot,
    agentsDir: 'agents',
  });
  const executor = createTaskExecutor(manager, { maxParallel: 1, runtime });
  const originalCwd = process.cwd();
  let firstRun;
  let secondRun;
  let reviewRun;
  try {
    process.chdir(projectRoot);
    firstRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['implement'],
      maxParallel: 1,
    });

    assert.equal(firstRun.status, 'blocked');
    const agentCallsDir = path.join(projectRoot, '.codebuddy', 'agent-calls');
    const promptFiles = (await fsp.readdir(agentCallsDir)).filter(name => name.endsWith('.prompt.md'));
    assert.equal(promptFiles.length, 1);

    const requestId = promptFiles[0].replace(/\.prompt\.md$/, '');
    await writeJson(path.join(agentCallsDir, `${requestId}.result.json`), {
      requestId,
      kind: 'manual-task',
      status: 'success',
      output: {
        actualWork: 'Implemented feature with regression coverage.',
      },
      completedAt: new Date().toISOString(),
    });

    secondRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['implement'],
      maxParallel: 1,
    });

    reviewRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['review'],
      maxParallel: 1,
    });
  } finally {
    process.chdir(originalCwd);
  }

  assert.equal(secondRun.status, 'completed');
  assert.equal(reviewRun.status, 'blocked');
  const saved = manager.load(taskBook.id);
  assert(saved, 'taskbook should still be available after partial execution');

  const implementTask = saved.tasks.find(task => task.id === 'task-1');
  assert(implementTask, 'implement task should exist');
  assert.equal(implementTask.status, 'done');
  assert.equal(implementTask.executedBy, 'tdd-driver');
  assert.equal(Array.isArray(implementTask.handoffs), true);
  assert.equal(implementTask.handoffs.length, 1);
  assert.equal(implementTask.handoffs[0].from, 'tdd-driver');
  assert.equal(implementTask.handoffs[0].to, 'code-reviewer');
  assert.equal(implementTask.handoffs[0].type, 'standard');
  assert.deepEqual(implementTask.handoffs[0].deliverables, ['src/feature.ts']);
  assert.match(implementTask.handoffs[0].context || '', /Review the implementation/);

  const agentCallsDir = path.join(projectRoot, '.codebuddy', 'agent-calls');
  const promptFiles = (await fsp.readdir(agentCallsDir)).filter(name => name.endsWith('.prompt.md'));
  const promptContents = await Promise.all(
    promptFiles.map(async name => ({
      name,
      content: await fsp.readFile(path.join(agentCallsDir, name), 'utf-8'),
    })),
  );
  const reviewPrompt = promptContents.find(item =>
    /"agentId":\s*"code-reviewer"/.test(item.content)
    && /## AgentRuntime Rendered Prompt/.test(item.content),
  );
  assert(reviewPrompt, 'review task prompt should be generated');
  assert.match(reviewPrompt.content, /## Incoming Handoffs/);
  assert.match(reviewPrompt.content, /Implement the feature/);
  assert.match(reviewPrompt.content, /src\/feature\.ts/);
  assert.match(reviewPrompt.content, /tdd-driver/);
}

async function testBuildFixGateFailuresCreateFailureHandoffs() {
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskExecutorDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const { runWorkflow } = require(taskExecutorDistPath);

  const projectRoot = path.join(
    tempRoot,
    `build-fix-failure-handoffs-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'workflows'), { recursive: true });
  await writeJson(path.join(projectRoot, 'package.json'), {
    name: 'build-fix-failure-fixture',
    version: '1.0.0',
  });

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'build-fix failure regression',
    description: 'ensure gate failures persist qa_fail and escalation handoffs',
    taskType: 'debugging',
  });

  manager.addTask(taskBook.id, {
    title: 'Repair the broken build',
    type: 'build-fix',
    priority: 'high',
    acceptanceCriteria: ['build passes'],
    scope: { files: ['src/app.ts'] },
  });
  manager.updateTaskStatus(taskBook.id, 'task-1', 'done', 'Initial build-fix attempt recorded.');
  manager.updateTask(taskBook.id, 'task-1', { executedBy: 'build-fix' });
  manager.updateStatus(taskBook.id, 'confirmed');

  const workflowPath = path.join(projectRoot, '.codebuddy', 'workflows', 'build-fix.workflow.json');
  await writeJson(workflowPath, {
    id: 'build-fix-regression',
    version: '1.0.0',
    steps: [
      {
        id: 'build_and_fix',
        type: 'build_and_fix',
        title: 'Build and fix',
        gates: ['build-check'],
      },
    ],
    gates: [
      {
        id: 'build-check',
        type: 'checks',
        required: true,
        params: {
          commands: ['node -e "process.exit(1)"'],
          writeEvidence: true,
        },
      },
    ],
    policies: {
      buildFix: {
        maxRounds: 1,
        retryFromStep: 'build_and_fix',
        escalateToHuman: true,
      },
    },
  });

  const originalCwd = process.cwd();
  let workflowResult;
  try {
    process.chdir(projectRoot);
    workflowResult = await runWorkflow(taskBook.id, { workflowPath });
  } finally {
    process.chdir(originalCwd);
  }

  assert(workflowResult.taskBook, 'workflow should return the current taskbook snapshot');
  assert.notEqual(workflowResult.taskBook.status, 'completed');

  const saved = manager.load(taskBook.id);
  assert(saved, 'taskbook should still exist after workflow failure');
  const buildFixTask = saved.tasks.find(task => task.id === 'task-1');
  assert(buildFixTask, 'build-fix task should exist');
  assert.equal(Array.isArray(buildFixTask.handoffs), true);
  const handoffTypes = buildFixTask.handoffs.map(handoff => handoff.type);
  assert.deepEqual(handoffTypes, ['qa_fail', 'escalation']);
  assert.equal(buildFixTask.handoffs[0].from, 'quality-gate');
  assert.equal(buildFixTask.handoffs[0].to, 'build-fix');
  assert.equal(buildFixTask.handoffs[1].to, 'task-orchestrator');
  assert.match(buildFixTask.handoffs[0].context || '', /build-check/);
  assert.match(buildFixTask.handoffs[1].context || '', /Retries exhausted/);
  assert.deepEqual(buildFixTask.handoffs[1].deliverables, ['src/app.ts']);
}

async function testReviewAgentFailuresCreateQaFailAndDeduplicate() {
  assertBuiltArtifactExists(agentRuntimeDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskExecutorDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const { createTaskExecutor } = require(taskExecutorDistPath);
  const { createAgentRuntime } = require(agentRuntimeDistPath);

  const projectRoot = path.join(
    tempRoot,
    `review-failure-handoffs-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'agent-calls'), { recursive: true });
  await writeText(path.join(projectRoot, 'agents', 'code-reviewer', 'AGENT.md'), [
    '---',
    'name: code-reviewer',
    'description: review agent fixture',
    '---',
    '',
    '# Review Agent',
    '',
    'Review implementation changes.',
    '',
  ].join('\n'));
  await writeText(path.join(projectRoot, 'agents', 'tdd-driver', 'AGENT.md'), [
    '---',
    'name: tdd-driver',
    'description: implement agent fixture',
    '---',
    '',
    '# TDD Driver',
    '',
    'Implement requested changes using downstream review feedback.',
    '',
  ].join('\n'));

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'review failure regression',
    description: 'ensure failed review results create qa_fail handoffs once',
    taskType: 'code-review',
  });

  manager.addTask(taskBook.id, {
    title: 'Implement the feature',
    type: 'implement',
    priority: 'high',
    acceptanceCriteria: ['feature implemented'],
    scope: { files: ['src/feature.ts'] },
  });
  manager.updateTaskStatus(taskBook.id, 'task-1', 'done', 'Implementation completed.');
  manager.updateTask(taskBook.id, 'task-1', { executedBy: 'tdd-driver' });
  manager.addTask(taskBook.id, {
    title: 'Review the feature',
    type: 'review',
    dependencies: ['task-1'],
    acceptanceCriteria: ['review completed'],
    scope: { files: ['src/feature.ts'] },
  });
  manager.updateStatus(taskBook.id, 'confirmed');

  const runtime = createAgentRuntime({ projectRoot, agentsDir: 'agents' });
  const executor = createTaskExecutor(manager, { maxParallel: 1, runtime });

  const originalCwd = process.cwd();
  let requestId;
  try {
    process.chdir(projectRoot);
    const agentCallsDir = path.join(projectRoot, '.codebuddy', 'agent-calls');

    const firstRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['review'],
      maxParallel: 1,
    });
    assert.equal(firstRun.status, 'blocked');

    const promptFiles = (await fsp.readdir(agentCallsDir)).filter(name => name.endsWith('.prompt.md'));
    assert.equal(promptFiles.length, 1);
    requestId = promptFiles[0].replace(/\.prompt\.md$/, '');
    await writeJson(path.join(agentCallsDir, `${requestId}.result.json`), {
      requestId,
      kind: 'manual-task',
      status: 'failed',
      error: {
        message: 'Missing regression coverage for src/feature.ts',
      },
      completedAt: new Date().toISOString(),
    });

    const secondRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['review'],
      maxParallel: 1,
    });
    const thirdRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['review'],
      maxParallel: 1,
    });

    assert.equal(secondRun.status, 'waiting');
    assert.equal(thirdRun.status, 'waiting');

    const implementRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['implement'],
      maxParallel: 1,
    });
    assert.equal(implementRun.status, 'blocked');

    const savedAfterReflow = manager.load(taskBook.id);
    assert(savedAfterReflow, 'taskbook should still exist after failed review result');
    const implementTaskAfterReflow = savedAfterReflow.tasks.find(task => task.id === 'task-1');
    const reviewTaskAfterReflow = savedAfterReflow.tasks.find(task => task.id === 'task-2');
    assert(implementTaskAfterReflow, 'implement task should exist');
    assert(reviewTaskAfterReflow, 'review task should exist');
    assert.equal(implementTaskAfterReflow.status, 'blocked');
    assert.equal(reviewTaskAfterReflow.status, 'pending');
    assert.equal(Array.isArray(reviewTaskAfterReflow.handoffs), true);
    assert.equal(reviewTaskAfterReflow.handoffs.length, 1);
    assert.equal(reviewTaskAfterReflow.handoffs[0].type, 'qa_fail');
    assert.equal(reviewTaskAfterReflow.handoffs[0].from, 'code-reviewer');
    assert.equal(reviewTaskAfterReflow.handoffs[0].to, 'tdd-driver');
    assert.match(reviewTaskAfterReflow.handoffs[0].context || '', /Missing regression coverage/);
    assert.equal(reviewTaskAfterReflow.blockedReason || '', '');

    const promptFilesAfterReflow = (await fsp.readdir(agentCallsDir))
      .filter(name => name.endsWith('.prompt.md'));
    const implementPromptFile = promptFilesAfterReflow.find(name => /^req-task-1-.*\.prompt\.md$/.test(name));
    assert(implementPromptFile, 'implement prompt should exist after review qa_fail reflow');
    const implementPrompt = await fsp.readFile(
      path.join(agentCallsDir, implementPromptFile),
      'utf-8',
    );
    assert.match(implementPrompt, /## Incoming Handoffs/);
    assert.match(implementPrompt, /Review the feature/);
    assert.match(implementPrompt, /qa_fail/);
    assert.match(implementPrompt, /Missing regression coverage/);

    const implementRequestId = implementPromptFile.replace(/\.prompt\.md$/, '');
    await writeJson(path.join(agentCallsDir, `${implementRequestId}.result.json`), {
      requestId: implementRequestId,
      kind: 'manual-task',
      status: 'success',
      output: {
        actualWork: 'Added regression coverage.',
      },
      completedAt: new Date().toISOString(),
    });

    const implementApplyRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['implement'],
      maxParallel: 1,
    });
    assert.equal(implementApplyRun.status, 'completed');

    const reviewRerun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['review'],
      maxParallel: 1,
    });
    assert.equal(reviewRerun.status, 'blocked');

    const reviewPromptRequestIds = (await fsp.readdir(agentCallsDir))
      .filter(name => /^req-task-2-.*\.prompt\.md$/.test(name))
      .map(name => name.replace(/\.prompt\.md$/, ''));
    assert.equal(reviewPromptRequestIds.some(id => id !== requestId), true);
  } finally {
    process.chdir(originalCwd);
  }

  const saved = manager.load(taskBook.id);
  assert(saved, 'taskbook should still exist after review rerun');
  const implementTask = saved.tasks.find(task => task.id === 'task-1');
  const reviewTask = saved.tasks.find(task => task.id === 'task-2');
  assert(implementTask, 'implement task should exist');
  assert(reviewTask, 'review task should exist');
  assert.equal(implementTask.status, 'done');
  assert.equal(reviewTask.status, 'blocked');
  assert.match(reviewTask.blockedReason || '', /\[agent-call\]/);
  assert.doesNotMatch(reviewTask.blockedReason || '', new RegExp(requestId));
}

async function testImplementAgentFailuresEscalateAndDeduplicate() {
  assertBuiltArtifactExists(agentRuntimeDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskExecutorDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const { createTaskExecutor } = require(taskExecutorDistPath);
  const { createAgentRuntime } = require(agentRuntimeDistPath);

  const projectRoot = path.join(
    tempRoot,
    `implement-failure-handoffs-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'agent-calls'), { recursive: true });
  await writeText(path.join(projectRoot, 'agents', 'tdd-driver', 'AGENT.md'), [
    '---',
    'name: tdd-driver',
    'description: implement agent fixture',
    '---',
    '',
    '# TDD Driver',
    '',
    'Implement requested changes.',
    '',
  ].join('\n'));

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'implement failure regression',
    description: 'ensure failed implement results escalate once',
    taskType: 'debugging',
  });

  manager.addTask(taskBook.id, {
    title: 'Implement the feature',
    type: 'implement',
    priority: 'high',
    acceptanceCriteria: ['feature implemented'],
    scope: { files: ['src/feature.ts'] },
  });
  manager.updateStatus(taskBook.id, 'confirmed');

  const runtime = createAgentRuntime({ projectRoot, agentsDir: 'agents' });
  const executor = createTaskExecutor(manager, { maxParallel: 1, runtime });

  const originalCwd = process.cwd();
  try {
    process.chdir(projectRoot);
    const firstRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['implement'],
      maxParallel: 1,
    });
    assert.equal(firstRun.status, 'blocked');

    const agentCallsDir = path.join(projectRoot, '.codebuddy', 'agent-calls');
    const promptFiles = (await fsp.readdir(agentCallsDir)).filter(name => name.endsWith('.prompt.md'));
    assert.equal(promptFiles.length, 1);
    const requestId = promptFiles[0].replace(/\.prompt\.md$/, '');
    await writeJson(path.join(agentCallsDir, `${requestId}.result.json`), {
      requestId,
      kind: 'manual-task',
      status: 'failed',
      error: {
        message: 'Need architectural decision before implementation',
      },
      completedAt: new Date().toISOString(),
    });

    const secondRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['implement'],
      maxParallel: 1,
    });
    const thirdRun = await executor.executeTasks(taskBook.id, {
      allowedTaskTypes: ['implement'],
      maxParallel: 1,
    });

    assert.equal(secondRun.status, 'blocked');
    assert.equal(thirdRun.status, 'blocked');
  } finally {
    process.chdir(originalCwd);
  }

  const saved = manager.load(taskBook.id);
  assert(saved, 'taskbook should still exist after failed implement result');
  const implementTask = saved.tasks.find(task => task.id === 'task-1');
  assert(implementTask, 'implement task should exist');
  assert.equal(implementTask.status, 'blocked');
  assert.equal(Array.isArray(implementTask.handoffs), true);
  assert.equal(implementTask.handoffs.length, 1);
  assert.equal(implementTask.handoffs[0].type, 'escalation');
  assert.equal(implementTask.handoffs[0].from, 'tdd-driver');
  assert.equal(implementTask.handoffs[0].to, 'task-orchestrator');
  assert.match(implementTask.handoffs[0].context || '', /Need architectural decision/);
  assert.match(implementTask.blockedReason || '', /Agent result \(failed\): Need architectural decision/);
  assert.equal((implementTask.blockedReason || '').match(/\[agent-call-result\]/g)?.length || 0, 1);
}

async function testWorkflowReflowsToImplementAfterReviewQaFail() {
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskExecutorDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const { runWorkflow } = require(taskExecutorDistPath);

  const projectRoot = path.join(
    tempRoot,
    `workflow-review-reflow-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'agent-calls'), { recursive: true });
  await fsp.mkdir(path.join(projectRoot, 'agents', 'tdd-driver'), { recursive: true });
  await writeText(path.join(projectRoot, 'agents', 'tdd-driver', 'AGENT.md'), [
    '---',
    'name: tdd-driver',
    'description: implement agent fixture',
    '---',
    '',
    '# TDD Driver',
    '',
    'Implement requested changes.',
    '',
  ].join('\n'));

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'workflow review reflow regression',
    description: 'ensure workflow jumps back to implement after review qa_fail',
    taskType: 'code-review',
  });

  manager.addTask(taskBook.id, {
    title: 'Implement the feature',
    type: 'implement',
    priority: 'high',
    acceptanceCriteria: ['feature implemented'],
    scope: { files: ['src/feature.ts'] },
  });
  manager.updateTaskStatus(taskBook.id, 'task-1', 'done', 'Implementation completed.');
  manager.updateTask(taskBook.id, 'task-1', { executedBy: 'tdd-driver' });
  manager.addTask(taskBook.id, {
    title: 'Review the feature',
    type: 'review',
    dependencies: ['task-1'],
    acceptanceCriteria: ['review completed'],
    scope: { files: ['src/feature.ts'] },
  });
  manager.updateTask(taskBook.id, 'task-2', {
    status: 'blocked',
    blockedReason: [
      'MANUAL_REQUIRED: pending review result',
      '[agent-call] {"requestId":"req-review-reflow","agentId":"code-reviewer","kind":"manual-task","taskBookId":"' + taskBook.id + '","taskId":"task-2","promptPath":".codebuddy/agent-calls/req-review-reflow.prompt.md","resultPath":".codebuddy/agent-calls/req-review-reflow.result.json","createdAt":"' + new Date().toISOString() + '"}',
    ].join('\n'),
  });
  manager.updateStatus(taskBook.id, 'confirmed');

  await writeJson(path.join(projectRoot, '.codebuddy', 'agent-calls', 'req-review-reflow.result.json'), {
    requestId: 'req-review-reflow',
    kind: 'manual-task',
    status: 'failed',
    error: {
      message: 'Review rejected the implementation',
    },
    completedAt: new Date().toISOString(),
  });

  const workflowPath = path.join(projectRoot, 'workflow-review-reflow.json');
  await writeJson(workflowPath, {
    id: 'workflow-review-reflow',
    version: '1.0.0',
    steps: [
      {
        id: 'implement',
        type: 'tdd_implement',
        title: 'Implement',
      },
      {
        id: 'review',
        type: 'code_review',
        title: 'Review',
      },
    ],
    edges: [
      { from: 'implement', to: 'review' },
    ],
    gates: [
      {
        id: 'review-pass',
        type: 'review',
        required: true,
      },
    ],
  });

  const originalCwd = process.cwd();
  let workflowResult;
  try {
    process.chdir(projectRoot);
    workflowResult = await runWorkflow(taskBook.id, { workflowPath });
  } finally {
    process.chdir(originalCwd);
  }

  assert(workflowResult.taskBook, 'workflow should return current taskbook after reflow');
  const saved = manager.load(taskBook.id);
  assert(saved, 'taskbook should still exist after workflow reflow');
  const implementTask = saved.tasks.find(task => task.id === 'task-1');
  const reviewTask = saved.tasks.find(task => task.id === 'task-2');
  assert(implementTask, 'implement task should exist');
  assert(reviewTask, 'review task should exist');
  assert.equal(implementTask.status, 'blocked');
  assert.equal(reviewTask.status, 'pending');
  assert.equal(saved.changelog.some(entry => entry.reason === 'review reflow -> implement'), true);
}

async function testOrchestratorWorkflowRoutingWritesReportsAndKeepsExplicitNonSticky() {
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskOrchestratorDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const { resolveWorkflowSelection, workflowRoutingReportPath } = require(taskOrchestratorDistPath);

  const projectRoot = path.join(
    tempRoot,
    `orchestrator-routing-report-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'workflows'), { recursive: true });
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'micro.workflow.json'), { id: 'micro' });
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'sprint.workflow.json'), { id: 'sprint' });
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'default.workflow.json'), { id: 'default' });
  await writeJson(path.join(projectRoot, 'package.json'), {
    name: 'orchestrator-routing-report-fixture',
    version: '1.0.0',
  });

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'micro hotfix routing',
    description: 'single-file hotfix should route to micro by default',
    taskType: 'debugging',
  });
  manager.addTask(taskBook.id, {
    title: 'Apply small hotfix',
    type: 'implement',
    priority: 'high',
    acceptanceCriteria: ['hotfix applied'],
    scope: { files: ['src/app.ts'], modules: ['app'] },
  });
  manager.updateStatus(taskBook.id, 'confirmed');

  const firstTaskBook = manager.load(taskBook.id);
  assert(firstTaskBook, 'taskbook should exist for routing report regression');

  const autoSelection = resolveWorkflowSelection({
    projectRoot,
    taskBook: firstTaskBook,
  });
  assert.equal(autoSelection.decision.selectedWorkflowId, 'micro');
  assert.equal(autoSelection.decision.mode, 'auto');

  const reportPath = workflowRoutingReportPath(projectRoot, taskBook.id);
  assert.equal(fs.existsSync(reportPath), true, 'workflow routing report should be written');
  const firstReport = JSON.parse(await fsp.readFile(reportPath, 'utf-8'));
  assert.equal(firstReport.decision.selectedWorkflowId, 'micro');
  assert.equal(firstReport.decision.mode, 'auto');

  const reusedSelection = resolveWorkflowSelection({
    projectRoot,
    taskBook: firstTaskBook,
  });
  assert.equal(reusedSelection.decision.selectedWorkflowId, 'micro');
  assert.equal(reusedSelection.decision.mode, 'reused');
  assert.equal(reusedSelection.decision.reusedFromTaskBook, true);

  const explicitPath = path.join('.codebuddy', 'workflows', 'default.workflow.json');
  const explicitSelection = resolveWorkflowSelection({
    projectRoot,
    taskBook: firstTaskBook,
    explicitWorkflowPath: explicitPath,
  });
  assert.equal(explicitSelection.decision.mode, 'explicit');
  assert.equal(explicitSelection.workflowPath, explicitPath);

  const autoAfterExplicit = resolveWorkflowSelection({
    projectRoot,
    taskBook: firstTaskBook,
  });
  assert.equal(autoAfterExplicit.decision.selectedWorkflowId, 'micro');
  assert.equal(autoAfterExplicit.decision.mode, 'auto');

  const finalReport = JSON.parse(await fsp.readFile(reportPath, 'utf-8'));
  assert.equal(finalReport.decision.selectedWorkflowId, 'micro');
  assert.equal(finalReport.decision.mode, 'auto');
}

async function testOrchestratorRunOnceAutoRoutesWorkflowIntoExecutor() {
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskOrchestratorDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const { runOrchestratorOnce } = require(taskOrchestratorDistPath);
  const childProcess = require('child_process');

  const projectRoot = path.join(
    tempRoot,
    `orchestrator-run-once-routing-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'scripts'), { recursive: true });
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'workflows'), { recursive: true });
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'micro.workflow.json'), { id: 'micro' });
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'sprint.workflow.json'), { id: 'sprint' });
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'default.workflow.json'), { id: 'default' });
  await writeJson(path.join(projectRoot, 'package.json'), {
    name: 'orchestrator-run-once-routing-fixture',
    version: '1.0.0',
  });

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'auto route executor',
    description: 'single-file hotfix should be forwarded to micro workflow',
    taskType: 'debugging',
  });
  manager.addTask(taskBook.id, {
    title: 'Patch one file',
    type: 'implement',
    priority: 'high',
    acceptanceCriteria: ['patch applied'],
    scope: { files: ['src/app.ts'], modules: ['app'] },
  });
  manager.updateStatus(taskBook.id, 'confirmed');

  await writeText(path.join(projectRoot, '.codebuddy', 'scripts', 'taskbook-manager.js'), [
    '#!/usr/bin/env node',
    'process.exit(0);',
    '',
  ].join('\n'));
  await writeText(path.join(projectRoot, '.codebuddy', 'scripts', 'task-executor.js'), [
    '#!/usr/bin/env node',
    'process.exit(0);',
    '',
  ].join('\n'));

  const originalSpawnSync = childProcess.spawnSync;
  childProcess.spawnSync = (command, args, options = {}) => {
    const scriptPath = Array.isArray(args) ? String(args[0] || '') : '';
    if (scriptPath.endsWith(`${path.sep}taskbook-manager.js`)) {
      const taskBookPath = path.join(projectRoot, '.codebuddy', 'taskbooks', 'active', `${taskBook.id}.json`);
      return {
        status: 0,
        stdout: fs.readFileSync(taskBookPath, 'utf-8'),
        stderr: '',
      };
    }

    if (scriptPath.endsWith(`${path.sep}task-executor.js`)) {
      const outputPath = path.join(projectRoot, '.codebuddy', 'reports', 'last-executor-call.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify({ command, args: args.slice(1), cwd: options.cwd }, null, 2), 'utf-8');
      return {
        status: 0,
        stdout: '',
        stderr: '',
      };
    }

    return {
      status: 0,
      stdout: '',
      stderr: '',
    };
  };

  let run;
  try {
    run = runOrchestratorOnce({
      projectRoot,
      json: true,
      noAutoConfirm: false,
      stopAfterPlan: false,
      tasksOnly: false,
      workflowPath: undefined,
      showWorkflowRoute: true,
      approve: [],
      maxParallel: undefined,
      taskBookId: taskBook.id,
      type: 'debugging',
      title: undefined,
      description: undefined,
    }, false);
  } finally {
    childProcess.spawnSync = originalSpawnSync;
  }

  assert.equal(run.exitCode, 0);
  assert.equal(run.outcome.status, 'completed');
  assert.equal(run.outcome.taskBookId, taskBook.id);
  assert.equal(run.outcome.details?.workflowRoute?.workflowId, 'micro');

  const executorCall = JSON.parse(await fsp.readFile(
    path.join(projectRoot, '.codebuddy', 'reports', 'last-executor-call.json'),
    'utf-8',
  ));
  assert.deepEqual(executorCall.args, [
    taskBook.id,
    '--workflow',
    path.join('.codebuddy', 'workflows', 'micro.workflow.json'),
  ]);
  assert.equal(executorCall.cwd, projectRoot);
}

async function testTaskBookManagerArchivesEvenWhenActiveCleanupIsLocked() {
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const builtinFs = require('fs');

  const projectRoot = path.join(
    tempRoot,
    `taskbook-archive-lock-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(projectRoot, { recursive: true });

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'archive lock regression',
    description: 'history snapshot should survive active cleanup EPERM',
    taskType: 'debugging',
  });
  manager.updateStatus(taskBook.id, 'confirmed');

  const activeFilePath = path.join(projectRoot, '.codebuddy', 'taskbooks', 'active', `${taskBook.id}.json`);
  const historyFilePath = path.join(projectRoot, '.codebuddy', 'taskbooks', 'history', `${taskBook.id}.json`);

  const originalUnlinkSync = builtinFs.unlinkSync;
  const originalRmSync = builtinFs.rmSync;
  builtinFs.unlinkSync = (targetPath, ...args) => {
    if (path.normalize(String(targetPath)) === path.normalize(activeFilePath)) {
      const error = new Error('locked active taskbook');
      error.code = 'EPERM';
      throw error;
    }
    return originalUnlinkSync(targetPath, ...args);
  };
  builtinFs.rmSync = (targetPath, ...args) => {
    if (path.normalize(String(targetPath)) === path.normalize(activeFilePath)) {
      const error = new Error('locked active taskbook');
      error.code = 'EPERM';
      throw error;
    }
    return originalRmSync(targetPath, ...args);
  };

  try {
    const archived = manager.updateStatus(taskBook.id, 'completed');
    assert(archived, 'updateStatus should still return the archived taskbook');
    assert.equal(archived.status, 'completed');
  } finally {
    builtinFs.unlinkSync = originalUnlinkSync;
    builtinFs.rmSync = originalRmSync;
  }

  assert.equal(fs.existsSync(historyFilePath), true, 'history snapshot should be written even when active cleanup fails');
  assert.equal(fs.existsSync(activeFilePath), true, 'active snapshot may remain when the filesystem keeps the file locked');

  const loaded = manager.load(taskBook.id);
  assert(loaded, 'load should resolve the latest archived snapshot');
  assert.equal(loaded.status, 'completed');
  assert.equal(manager.listActive().some(item => item.id === taskBook.id), false, 'stale active snapshots should not appear in active list');
}

async function testTaskBookManagerClearsDeadProcessLocksImmediately() {
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);

  const projectRoot = path.join(
    tempRoot,
    `taskbook-dead-lock-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(projectRoot, { recursive: true });

  const deadPid = Math.max(process.pid + 100000, 999999);
  const lockPayloads = [
    {
      label: 'current pid field',
      slug: 'pid',
      payload: {
        pid: deadPid,
      },
    },
    {
      label: 'legacy ownerPid field',
      slug: 'owner',
      payload: {
        ownerPid: deadPid,
      },
    },
  ];

  for (const { label, slug, payload } of lockPayloads) {
    const caseRoot = path.join(projectRoot, slug);
    await fsp.mkdir(caseRoot, { recursive: true });
    const manager = new TaskBookManager(caseRoot, {
      lockTimeoutMs: 400,
      lockRetryMs: 20,
    });
    const taskBook = manager.create({
      title: `dead lock ${slug} regression`,
      description: 'dead pid lock files should be reclaimed immediately',
      taskType: 'debugging',
    });

    const lockPath = path.join(caseRoot, '.codebuddy', 'taskbooks', '.locks', `${taskBook.id}.lock`);
    await writeJson(lockPath, {
      ...payload,
      createdAt: new Date().toISOString(),
      taskBookId: taskBook.id,
    });

    const startedAt = Date.now();
    const updated = manager.addTask(taskBook.id, {
      title: 'Recovered after dead lock',
      type: 'analysis',
      scope: { files: ['package.json'] },
    });
    const durationMs = Date.now() - startedAt;

    assert(updated, `addTask should succeed after reclaiming a dead-process lock (${label})`);
    assert.equal(updated.tasks.length, 1);
    assert.equal(fs.existsSync(lockPath), false, `dead-process lock file should be removed (${label})`);
    assert.equal(durationMs < 1000, true, `dead-process lock reclaim should be immediate (${label}, duration=${durationMs}ms)`);
  }
}

async function testTaskExecutorAutoWorkflowRoutesAndRecordsMetrics() {
  assertBuiltArtifactExists(taskBookManagerDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskExecutorDistPath, 'npm run build:scripts');
  const { TaskBookManager } = require(taskBookManagerDistPath);
  const { runWorkflow } = require(taskExecutorDistPath);

  const projectRoot = path.join(
    tempRoot,
    `task-executor-auto-workflow-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'scripts'), { recursive: true });
  await fsp.mkdir(path.join(projectRoot, '.codebuddy', 'workflows'), { recursive: true });
  await writeJson(path.join(projectRoot, 'package.json'), {
    name: 'task-executor-auto-workflow-fixture',
    version: '1.0.0',
  });
  await writeText(path.join(projectRoot, '.codebuddy', 'scripts', 'module-mapper.js'), 'process.exit(0);\n');
  await writeText(path.join(projectRoot, '.codebuddy', 'scripts', 'structure-analyzer.js'), 'process.exit(0);\n');
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'micro.workflow.json'), {
    id: 'micro',
    version: '1.0.0',
    steps: [
      { id: 'implement', type: 'tdd_implement', title: 'Implement' },
      { id: 'acceptance', type: 'acceptance_and_archive', title: 'Accept', gates: ['full_passed'] },
    ],
    edges: [{ from: 'implement', to: 'acceptance' }],
    gates: [{ id: 'full_passed', type: 'checks', required: true, params: { commands: ['node -e "process.exit(0)"'] } }],
  });
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'sprint.workflow.json'), {
    id: 'sprint',
    version: '1.0.0',
    steps: [
      { id: 'implement', type: 'tdd_implement', title: 'Implement' },
      { id: 'review', type: 'code_review', title: 'Review', gates: ['review_passed'] },
      { id: 'acceptance', type: 'acceptance_and_archive', title: 'Accept' },
    ],
    edges: [{ from: 'implement', to: 'review' }, { from: 'review', to: 'acceptance' }],
    gates: [{ id: 'review_passed', type: 'review', required: true }],
  });
  await writeJson(path.join(projectRoot, '.codebuddy', 'workflows', 'default.workflow.json'), {
    id: 'default',
    version: '1.0.0',
    steps: [
      { id: 'implement', type: 'tdd_implement', title: 'Implement' },
      { id: 'build_fix', type: 'build_and_fix', title: 'Build fix', gates: ['build_passed'] },
      { id: 'acceptance', type: 'acceptance_and_archive', title: 'Accept' },
    ],
    edges: [{ from: 'implement', to: 'build_fix' }, { from: 'build_fix', to: 'acceptance' }],
    gates: [{ id: 'build_passed', type: 'checks', required: true, params: { commands: ['node -e "process.exit(0)"'] } }],
  });

  const manager = new TaskBookManager(projectRoot);
  const taskBook = manager.create({
    title: 'executor auto route',
    description: 'single-file hotfix should choose micro',
    taskType: 'debugging',
  });
  manager.updateStatus(taskBook.id, 'confirmed');

  const originalCwd = process.cwd();
  let workflowResult;
  try {
    process.chdir(projectRoot);
    workflowResult = await runWorkflow(taskBook.id, {
      workflowPath: 'auto',
      showWorkflowRoute: true,
    });
  } finally {
    process.chdir(originalCwd);
  }

  assert(workflowResult.taskBook, 'workflow result should include taskbook snapshot');
  assert.equal(workflowResult.taskBook.status, 'completed');
  assert.equal(workflowResult.workflowRoute?.workflowId, 'micro');
  assert.equal(workflowResult.workflowRoute?.mode, 'auto');

  const routingReportPath = path.join(projectRoot, '.codebuddy', 'reports', 'workflow-routing', `${taskBook.id}.routing.json`);
  assert.equal(fs.existsSync(routingReportPath), true, 'task-executor auto route should write routing report');
  const metricsSummaryPath = path.join(projectRoot, '.codebuddy', 'reports', 'metrics', 'latest-summary.json');
  assert.equal(fs.existsSync(metricsSummaryPath), true, 'task-executor auto route should write metrics summary');
  const metricsSummary = JSON.parse(await fsp.readFile(metricsSummaryPath, 'utf-8'));
  assert.equal(metricsSummary?.totals?.workflowRoutesSelected > 0, true);
  assert.equal(metricsSummary?.workflowRoutesById?.micro > 0, true);
  assert.equal(metricsSummary?.workflowRoutesByMode?.auto > 0, true);
}

async function testToolConverterBuildsOutputs() {
  assertBuiltArtifactExists(toolConverterDistPath, 'npm run build:scripts');
  const { convert } = require(toolConverterDistPath);

  const fixtureRoot = path.join(
    tempRoot,
    `tool-converter-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  const outputDir = path.join(fixtureRoot, 'output');

  await writeText(path.join(fixtureRoot, 'agents', 'demo-agent', 'AGENT.md'), [
    '---',
    'name: Demo Agent',
    'description: demo agent fixture',
    '---',
    '',
    '# Demo Agent',
    '',
    'Agent body.',
    '',
  ].join('\n'));

  await writeText(path.join(fixtureRoot, 'rules', 'layer1_base', 'demo-rule.md'), [
    '---',
    'name: Demo Rule',
    'description: demo rule fixture',
    'tags:',
    '  - ts',
    '---',
    '',
    '# Demo Rule',
    '',
    'Rule body.',
    '',
  ].join('\n'));

  await writeText(path.join(fixtureRoot, 'custom-skills', 'demo-skill', 'SKILL.md'), [
    '---',
    'name: Demo Skill',
    'description: demo skill fixture',
    'triggers:',
    '  - refactor',
    '---',
    '',
    '# Demo Skill',
    '',
    'Skill body.',
    '',
  ].join('\n'));

  const results = convert({
    tool: 'all',
    sourceRoot: fixtureRoot,
    outputDir,
  });

  assert.deepEqual(results.map(item => item.filesWritten), [3, 3, 3]);
  assert.equal(fs.existsSync(path.join(outputDir, 'claude-code', '.claude', 'rules', 'demo-agent.md')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'cursor', '.cursor', 'rules', 'demo-rule.mdc')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'windsurf', '.windsurf', 'rules', 'demo-skill.md')), true);

  const cursorRule = await fsp.readFile(
    path.join(outputDir, 'cursor', '.cursor', 'rules', 'demo-rule.mdc'),
    'utf-8',
  );
  assert.match(cursorRule, /description: demo rule fixture/);
  assert.match(cursorRule, /globs: "\*\*\/\*\.ts"/);
}

async function main() {
  const tests = [
    ['AgentRuntime loads installed rules cache', testAgentRuntimeLoadsInstalledRules],
    ['MCP analyze_project_structure runs under ESM build', testMcpAnalyzeProjectStructure],
    ['script distribution includes runtime lib dependencies', testScriptDistributionIncludesRuntimeLibs],
    ['TaskExecutor persists handoff metadata for dependent tasks', testTaskExecutorPersistsHandoffs],
    ['build-fix gate failures create qa_fail and escalation handoffs', testBuildFixGateFailuresCreateFailureHandoffs],
    ['failed review agent results create qa_fail once', testReviewAgentFailuresCreateQaFailAndDeduplicate],
    ['failed implement agent results escalate once', testImplementAgentFailuresEscalateAndDeduplicate],
    ['workflow reflows to implement after review qa_fail', testWorkflowReflowsToImplementAfterReviewQaFail],
    ['orchestrator workflow routing writes report and keeps explicit selection non-sticky', testOrchestratorWorkflowRoutingWritesReportsAndKeepsExplicitNonSticky],
    ['orchestrator runOnce auto-routes workflow into executor', testOrchestratorRunOnceAutoRoutesWorkflowIntoExecutor],
    ['taskbook-manager archives to history even when active cleanup is locked', testTaskBookManagerArchivesEvenWhenActiveCleanupIsLocked],
    ['taskbook-manager clears dead-process locks immediately', testTaskBookManagerClearsDeadProcessLocksImmediately],
    ['task-executor auto workflow routes and records metrics', testTaskExecutorAutoWorkflowRoutesAndRecordsMetrics],
    ['tool-converter generates multi-tool outputs', testToolConverterBuildsOutputs],
  ];

  const filterArgIndex = process.argv.indexOf('--filter');
  const filterValue = filterArgIndex >= 0 ? process.argv[filterArgIndex + 1] : process.env.CORRECTNESS_FILTER;
  const normalizedFilter = typeof filterValue === 'string' ? filterValue.trim().toLowerCase() : '';
  const selectedTests = normalizedFilter
    ? tests.filter(([name]) => name.toLowerCase().includes(normalizedFilter))
    : tests;

  if (normalizedFilter && selectedTests.length === 0) {
    console.error(`FAIL No correctness tests matched filter: ${filterValue}`);
    process.exit(1);
  }

  if (normalizedFilter) {
    console.log(`INFO Running ${selectedTests.length}/${tests.length} correctness tests with filter: ${filterValue}`);
  }

  let failed = 0;
  for (const [name, testFn] of selectedTests) {
    try {
      await testFn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(`FAIL ${name}\n${message}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

await main();
