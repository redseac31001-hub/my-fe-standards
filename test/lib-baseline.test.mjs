import assert from 'node:assert/strict';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const frontmatterUtilsDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'frontmatter-utils.js');
const metadataParserDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'metadata-parser.js');
const distributionProfilesDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'distribution-profiles.js');
const contractValidatorDistPath = path.join(repoRoot, 'scripts', 'dist', 'contract-validator.js');
const contextTargetingDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'context-targeting.js');
const installHealthDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'install-health.js');
const installStateDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'install-state.js');
const installRootsDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'install-roots.js');
const projectDetectionDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'project-detection.js');
const workflowRoutingDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'workflow-routing.js');
const taskIntakeRoutingDistPath = path.join(repoRoot, 'scripts', 'dist', 'lib', 'task-intake-routing.js');
const ruleValidatorDistPath = path.join(repoRoot, 'scripts', 'dist', 'rule-validator.js');
const skillValidatorDistPath = path.join(repoRoot, 'scripts', 'dist', 'skill-validator.js');
const repoStateValidatorDistPath = path.join(repoRoot, 'scripts', 'dist', 'repo-state-validator.js');
const validatorGateDistPath = path.join(repoRoot, 'scripts', 'dist', 'validator-gate.js');
const reportManagerDistPath = path.join(repoRoot, 'scripts', 'dist', 'report-manager.js');
const taskIntakeRouterDistPath = path.join(repoRoot, 'scripts', 'dist', 'task-intake-router.js');
const runTestsPath = path.join(repoRoot, 'test', 'run-tests.js');

function assertBuiltArtifactExists(filePath, hintCommand) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing built artifact: ${filePath}\nrun: ${hintCommand}`);
  }
}

function createInstallState(overrides = {}) {
  return {
    schemaVersion: '1.2.0',
    version: 'test',
    installedAt: '2026-03-12T00:00:00.000Z',
    mode: 'local',
    profile: 'full',
    enableOrchestrator: true,
    contentHash: 'test',
    source: {
      remoteBaseUrl: null,
      manifestVersion: null,
    },
    options: {
      taskType: null,
      ruleLevel: 'full',
      strictRemotePack: false,
      relevanceThreshold: 0.5,
      workspaceDiscovery: true,
      workspaceScope: 'workspace-union',
      targetProject: null,
      targetRole: null,
    },
    outputs: {
      rulesFile: '.codebuddy/rules/project-rules.md',
      workspaceIndexFile: null,
      skillsRootDir: '.codebuddy/skill-snapshots/current',
      skillsSnapshotRetention: 5,
      agentsRootDir: '.codebuddy/agent-snapshots/current',
      agentsSnapshotRetention: 4,
    },
    managedFiles: [],
    stats: {
      layer1Rules: 2,
      layer2Indexes: 1,
      layer3Indexes: 1,
      skills: 3,
      agents: 2,
      scripts: 0,
      workflows: 0,
      taskbooks: 0,
      agentCalls: 0,
      commands: 0,
      workspaceProjects: 1,
    },
    ...overrides,
  };
}

function createLoaderContext(overrides = {}) {
  return {
    isRemote: false,
    isVerbose: false,
    remoteBaseUrl: '',
    remoteBearerToken: null,
    remoteManifest: null,
    remoteContentRoot: null,
    remoteContentPack: null,
    strictRemotePack: false,
    requestTimeout: 10000,
    taskType: null,
    relevanceThreshold: 0.5,
    ruleLevel: 'full',
    profile: 'analysis',
    enableOrchestrator: false,
    disableWorkspace: false,
    workspaceScope: 'workspace-union',
    targetProject: null,
    targetRole: null,
    ...overrides,
  };
}

function createTestLogger() {
  const messages = {
    log: [],
    verbose: [],
    warn: [],
    error: [],
  };

  return {
    messages,
    logger: {
      log(message) {
        messages.log.push(message);
      },
      verbose(message) {
        messages.verbose.push(message);
      },
      warn(message) {
        messages.warn.push(message);
      },
      error(message) {
        messages.error.push(message);
      },
    },
  };
}

async function writeRepositoryFactFixture(rootDir, overrides = {}) {
  const {
    roadmapLastUpdated = '2026-03-18',
    docsIndexLastUpdated = '2026-03-18',
    protocolLastUpdated = '2026-03-18',
    handoffLatestDate = '2026-03-18',
    includeDocsIndexProtocolLink = true,
  } = overrides;

  await fsp.mkdir(path.join(rootDir, 'docs', 'guides'), { recursive: true });
  await fsp.mkdir(path.join(rootDir, 'docs', 'reference'), { recursive: true });

  await fsp.writeFile(
    path.join(rootDir, 'README.md'),
    [
      '# Demo Repo',
      '',
      '- [Docs](./docs/README.md)',
      '- [Team Collaboration Protocol](./docs/guides/team-collaboration-protocol.md)',
      '- [Handoff](./docs/guides/HANDOFF.md)',
      '- [Roadmap](./ROADMAP.md)',
    ].join('\n'),
    'utf-8',
  );

  await fsp.writeFile(path.join(rootDir, 'PROJECT.md'), '# Project\n', 'utf-8');

  await fsp.writeFile(
    path.join(rootDir, 'ROADMAP.md'),
    [
      '# ROADMAP',
      '',
      `> Last updated: ${roadmapLastUpdated}`,
      '',
      '## Current Snapshot',
      '',
      '| Item | Status | Priority | Estimate | Goal | Next Action |',
      '|------|--------|----------|----------|------|-------------|',
      '| P11 | IN_PROGRESS | High | M | Keep repo facts aligned | Finish repo-state validator |',
    ].join('\n'),
    'utf-8',
  );

  await fsp.writeFile(
    path.join(rootDir, 'docs', 'README.md'),
    [
      '# Docs Index',
      '',
      `> Last updated: ${docsIndexLastUpdated}`,
      '',
      '## Start Here',
      '',
      '- [Handoff](./guides/HANDOFF.md)',
      ...(includeDocsIndexProtocolLink ? ['- [Team Collaboration Protocol](./guides/team-collaboration-protocol.md)'] : []),
    ].join('\n'),
    'utf-8',
  );

  await fsp.writeFile(
    path.join(rootDir, 'docs', 'guides', 'HANDOFF.md'),
    [
      '# Handoff',
      '',
      `- Latest verification: ${handoffLatestDate}`,
      '- Read `README.md`',
      '- Read `PROJECT.md`',
      '- Read `docs/guides/team-collaboration-protocol.md`',
      '',
      '## 1) 当前状态',
      '',
      '- Active work is in progress.',
      '',
      '## 5) 下一步建议',
      '',
      '- Continue from roadmap.',
    ].join('\n'),
    'utf-8',
  );

  await fsp.writeFile(
    path.join(rootDir, 'docs', 'guides', 'team-collaboration-protocol.md'),
    [
      '# Team Collaboration Protocol',
      '',
      `> Last updated: ${protocolLastUpdated}`,
      '',
      '## Canonical Sources',
      '',
      '- [Handoff](./HANDOFF.md)',
      '- [Roadmap](../../ROADMAP.md)',
      '- [README](../../README.md)',
      '- [PROJECT](../../PROJECT.md)',
      '- [Architecture Constraints](../reference/architecture-constraints.md)',
      '',
      '## Standard AI Session Bootstrap',
      '',
      'Please do not change code yet.',
    ].join('\n'),
    'utf-8',
  );

  await fsp.writeFile(
    path.join(rootDir, 'docs', 'reference', 'architecture-constraints.md'),
    '# Architecture Constraints\n',
    'utf-8',
  );
}

async function testFrontmatterUtils() {
  assertBuiltArtifactExists(frontmatterUtilsDistPath, 'npm run build:scripts');
  const {
    parseFrontmatterBlock,
    splitFrontmatterDocument,
    extractYamlScalar,
    extractYamlSection,
    extractYamlBlockScalar,
    listYamlKeys,
    parseYamlList,
  } = require(frontmatterUtilsDistPath);

  const markdown = [
    '---',
    'name: "demo-agent"',
    'description: simple parser fixture',
    'metadata:',
    '  triggers:',
    '    - plan',
    '    - review',
    'workflow_summary: |',
    '  Step 1',
    '  Step 2',
    'dependencies:',
    '  layer1_base:',
    '    - clean-code',
    '---',
    '',
    '# Demo',
    '',
    'Body section.',
  ].join('\n');

  const frontmatter = parseFrontmatterBlock(markdown);
  assert.equal(frontmatter.ok, true);
  assert.equal(extractYamlScalar(frontmatter.frontmatter, 'name'), 'demo-agent');
  assert.deepEqual(listYamlKeys(frontmatter.frontmatter), ['name', 'description', 'metadata', 'workflow_summary', 'dependencies']);

  const metadataSection = extractYamlSection(frontmatter.frontmatter, 'metadata');
  assert.equal(metadataSection !== null, true);
  assert.deepEqual(parseYamlList(metadataSection, 'triggers', 2), ['plan', 'review']);
  assert.equal(extractYamlBlockScalar(frontmatter.frontmatter, 'workflow_summary'), 'Step 1\nStep 2');

  const document = splitFrontmatterDocument(markdown);
  assert.equal(document.ok, true);
  assert.match(document.body, /# Demo/);

  const missingClosing = parseFrontmatterBlock('---\nname: broken\nbody');
  assert.equal(missingClosing.ok, false);
  assert.match(missingClosing.error, /not closed/i);
}

async function testMetadataParser() {
  assertBuiltArtifactExists(metadataParserDistPath, 'npm run build:scripts');
  const { parseSkillMetadata, parseAgentMetadata } = require(metadataParserDistPath);

  const skillMarkdown = [
    '---',
    'name: Test Skill',
    'description: Skill fixture',
    'triggers:',
    '  - legacy-trigger',
    'metadata:',
    '  triggers:',
    '    - modern-trigger',
    '  tools:',
    '    - read_file',
    '  related:',
    '    - planner',
    '  languages:',
    '    - TypeScript',
    '    - unknown',
    '    - invalid-lang',
    '  frameworks:',
    '    - Vue 3',
    '  roles:',
    '    - Frontend',
    '    - QA',
    '    - unsupported',
    '  scenarios:',
    '    - refactor',
    '  workspace_scope: Both',
    '---',
    '',
    '# Test Skill',
  ].join('\n');

  const skill = parseSkillMetadata('test-skill', skillMarkdown);
  assert.equal(skill?.id, 'test-skill');
  assert.deepEqual(skill?.triggers, ['modern-trigger']);
  assert.deepEqual(skill?.tools, ['read_file']);
  assert.deepEqual(skill?.related, ['planner']);
  assert.deepEqual(skill?.languages, ['typescript', 'unknown']);
  assert.deepEqual(skill?.roles, ['frontend', 'qa']);
  assert.deepEqual(skill?.frameworks, ['Vue 3']);
  assert.deepEqual(skill?.scenarios, ['refactor']);
  assert.equal(skill?.workspaceScope, 'both');

  const agentMarkdown = [
    '---',
    'name: Test Agent',
    'description: Agent fixture',
    'triggers:',
    '  - implement',
    'permissions:',
    '  tools:',
    '    - read_file',
    '    - edit_file',
    '  skills:',
    '    - frontend-testing',
    'dependencies:',
    '  layer1_base:',
    '    - clean-code',
    '  layer3_action:',
    '    - testing',
    'workflow_summary: |',
    '  RED',
    '  GREEN',
    '---',
    '',
    '```yaml',
    'implicit:',
    '  - pattern: "fix bug"',
    '    confidence: 0.8',
    '  - pattern: "write tests"',
    '    confidence: 0.6',
    '```',
  ].join('\n');

  const agent = parseAgentMetadata('test-agent', agentMarkdown);
  assert.equal(agent?.id, 'test-agent');
  assert.deepEqual(agent?.permissions, ['read_file', 'edit_file']);
  assert.deepEqual(agent?.relatedSkills, ['frontend-testing']);
  assert.deepEqual(agent?.relatedRules, ['clean-code', 'testing']);
  assert.equal(agent?.workflowSummary, 'RED\nGREEN');
  assert.deepEqual(agent?.implicitTriggers, [
    { pattern: 'fix bug', confidence: 0.8 },
    { pattern: 'write tests', confidence: 0.6 },
  ]);
}

async function testDistributionProfiles() {
  assertBuiltArtifactExists(distributionProfilesDistPath, 'npm run build:scripts');
  const {
    getScriptsForProfile,
    getScriptArtifactsForProfile,
  } = require(distributionProfilesDistPath);

  const coreScripts = getScriptsForProfile('core').map(item => item.file);
  assert.deepEqual(coreScripts, ['rule-validator.js', 'skill-validator.js', 'validator-gate.js']);
  const coreArtifacts = getScriptArtifactsForProfile('core');
  assert.equal(coreArtifacts.includes('repo-state-validator.js'), true);
  assert.equal(coreArtifacts.includes('lib/validator-gate-report.js'), true);
  assert.equal(coreArtifacts.includes('types/reports.js'), true);

  const analysisScripts = getScriptsForProfile('analysis').map(item => item.file);
  assert.equal(analysisScripts.includes('task-orchestrator.js'), false);
  assert.equal(analysisScripts.includes('report-manager.js'), true);
  const analysisArtifacts = getScriptArtifactsForProfile('analysis');
  assert.equal(analysisArtifacts.includes('lib/validator-gate-report.js'), true);
  assert.equal(analysisArtifacts.includes('lib/audit-report.js'), true);
  assert.equal(analysisArtifacts.includes('types/reports.js'), true);

  const fullArtifacts = getScriptArtifactsForProfile('full');
  assert.equal(fullArtifacts.includes('agent-registry.js'), true);
  assert.equal(fullArtifacts.includes('agent-runtime.js'), true);
  assert.equal(fullArtifacts.includes('result-aggregator.js'), true);
  assert.equal(fullArtifacts.includes('lib/cli-entry.js'), true);
  assert.equal(fullArtifacts.includes('lib/frontmatter-utils.js'), true);
  assert.equal(fullArtifacts.includes('lib/project-detection.js'), true);
  assert.equal(fullArtifacts.includes('lib/install-roots.js'), true);
  assert.equal(fullArtifacts.includes('lib/install-sync.js'), true);
  assert.equal(fullArtifacts.includes('lib/worker-executor.js'), true);
  assert.equal(fullArtifacts.includes('lib/workflow-routing.js'), true);
  assert.equal(fullArtifacts.includes('lib/workflow-routing-selection.js'), true);
  assert.equal(fullArtifacts.includes('lib/execution-metrics.js'), true);
  assert.equal(fullArtifacts.includes('types/module-mapper.js'), true);
  assert.equal(fullArtifacts.includes('types/structure-analyzer.js'), true);
  assert.equal(fullArtifacts.length, new Set(fullArtifacts).size, 'artifacts should be deduplicated');
}

async function testInstallRoots() {
  assertBuiltArtifactExists(installRootsDistPath, 'npm run build:scripts');
  const {
    resolveInstalledSkillsRootDir,
    resolveInstalledAgentsRootDir,
    resolveInstalledRulesCacheRootDir,
    getProjectAgentRootCandidates,
    getProjectSkillRootCandidatePaths,
    getProjectRuleRootCandidates,
    listAgentDefinitionCandidatePaths,
  } = require(installRootsDistPath);

  const installState = createInstallState();
  assert.equal(resolveInstalledSkillsRootDir(installState), '.codebuddy/skill-snapshots/current');
  assert.equal(resolveInstalledAgentsRootDir(installState), '.codebuddy/agent-snapshots/current');
  assert.equal(resolveInstalledRulesCacheRootDir(installState), '.codebuddy/rules_cache');
  assert.deepEqual(getProjectAgentRootCandidates('E:\\workspace', installState), [
    '.codebuddy/agent-snapshots/current',
    '.codebuddy/agents',
    'agents',
  ]);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-lib-test-'));
  try {
    await fsp.mkdir(path.join(tempDir, '.codebuddy'), { recursive: true });
    await fsp.writeFile(
      path.join(tempDir, '.codebuddy', 'install.json'),
      `${JSON.stringify(installState, null, 2)}\n`,
      'utf-8',
    );

    assert.deepEqual(getProjectRuleRootCandidates(tempDir), [
      '.codebuddy/rules_cache',
      'rules',
    ]);

    const skillPaths = getProjectSkillRootCandidatePaths(tempDir);
    assert.deepEqual(skillPaths, [
      path.join(tempDir, '.codebuddy', 'skill-snapshots', 'current'),
      path.join(tempDir, '.codebuddy', 'skills'),
      path.join(tempDir, '.codebuddy', 'custom-skills'),
      path.join(tempDir, 'custom-skills'),
    ]);

    const agentDefinitionCandidates = listAgentDefinitionCandidatePaths(tempDir, 'planner');
    assert.deepEqual(agentDefinitionCandidates, [
      path.join(tempDir, '.codebuddy', 'agent-snapshots', 'current', 'planner', 'AGENT.md'),
      path.join(tempDir, '.codebuddy', 'agents', 'planner', 'AGENT.md'),
      path.join(tempDir, 'agents', 'planner', 'AGENT.md'),
    ]);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testProjectDetection() {
  assertBuiltArtifactExists(projectDetectionDistPath, 'npm run build:scripts');
  const {
    checkVueProfile,
    createScopedWorkspaceInfo,
    detectProjectLangFromDir,
    detectProjectMetadata,
    discoverWorkspace,
    normalizeStackLabel,
    normalizeStackTag,
  } = require(projectDetectionDistPath);

  assert.deepEqual(checkVueProfile({ vue: '^3.5.0' }), { version: 3, type: 'standard' });
  assert.deepEqual(checkVueProfile({ vue: '^2.7.0', '@vue/composition-api': '^1.7.0' }), { version: 2, type: 'composition' });
  assert.equal(normalizeStackTag('Ant Design Vue'), 'antdesignvue');
  assert.equal(normalizeStackLabel('ASP.NET Core'), 'aspnetcore');

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-project-detection-'));
  try {
    await fsp.mkdir(path.join(tempDir, 'packages', 'web'), { recursive: true });
    await fsp.mkdir(path.join(tempDir, 'packages', 'api', 'src'), { recursive: true });
    await fsp.mkdir(path.join(tempDir, 'services', 'dotnet'), { recursive: true });
    await fsp.mkdir(path.join(tempDir, 'node_modules', 'ignored-package'), { recursive: true });

    await fsp.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'workspace-root',
      private: true,
      workspaces: ['packages/*', 'services/*'],
    }, null, 2), 'utf-8');

    await fsp.writeFile(path.join(tempDir, 'packages', 'web', 'package.json'), JSON.stringify({
      name: '@demo/web',
      dependencies: {
        vue: '^3.5.0',
        vite: '^6.0.0',
        'ant-design-vue': '^4.0.0',
      },
    }, null, 2), 'utf-8');
    await fsp.writeFile(path.join(tempDir, 'packages', 'web', 'tsconfig.json'), '{}\n', 'utf-8');
    await fsp.writeFile(path.join(tempDir, 'packages', 'web', 'pnpm-lock.yaml'), 'lockfileVersion: 9\n', 'utf-8');

    await fsp.writeFile(path.join(tempDir, 'packages', 'api', 'package.json'), JSON.stringify({
      name: '@demo/api',
      type: 'module',
      dependencies: {
        express: '^5.0.0',
      },
      scripts: {
        dev: 'node src/server.ts',
      },
    }, null, 2), 'utf-8');
    await fsp.writeFile(path.join(tempDir, 'packages', 'api', 'src', 'server.ts'), [
      'import express from "express";',
      'const app = express();',
      'app.listen(process.env.PORT || 3000);',
    ].join('\n'), 'utf-8');

    await fsp.writeFile(path.join(tempDir, 'services', 'dotnet', 'Demo.Api.csproj'), [
      '<Project Sdk="Microsoft.NET.Sdk.Web">',
      '  <ItemGroup>',
      '    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />',
      '  </ItemGroup>',
      '</Project>',
    ].join('\n'), 'utf-8');

    await fsp.writeFile(path.join(tempDir, 'node_modules', 'ignored-package', 'package.json'), JSON.stringify({
      name: 'ignored-package',
    }, null, 2), 'utf-8');

    assert.equal(detectProjectLangFromDir(path.join(tempDir, 'packages', 'web')), 'typescript');
    assert.equal(detectProjectLangFromDir(path.join(tempDir, 'services', 'dotnet')), 'dotnet');

    const apiPackageJson = JSON.parse(await fsp.readFile(path.join(tempDir, 'packages', 'api', 'package.json'), 'utf-8'));
    const apiMetadata = detectProjectMetadata(path.join(tempDir, 'packages', 'api'), 'javascript', apiPackageJson);
    assert.equal(apiMetadata.frameworkLabel, 'Express');
    assert.equal(apiMetadata.projectKind, 'backend');
    assert.equal(apiMetadata.stackTags.includes('express'), true);
    assert.equal(apiMetadata.stackTags.includes('esm'), true);

    const { logger, messages } = createTestLogger();
    const workspaceInfo = discoverWorkspace(logger, tempDir);
    assert.equal(workspaceInfo.isWorkspace, true);
    assert.equal(workspaceInfo.totalProjectCount, 4);
    assert.deepEqual(workspaceInfo.projects.map(project => project.relativePath).sort(), [
      '.',
      'packages/api',
      'packages/web',
      'services/dotnet',
    ]);

    const webProject = workspaceInfo.projects.find(project => project.relativePath === 'packages/web');
    assert.equal(webProject?.lang, 'typescript');
    assert.equal(webProject?.frameworkLabel, 'Vue 3');
    assert.equal(webProject?.projectKind, 'frontend');
    assert.deepEqual(webProject?.uiLibLabels, ['Ant Design Vue']);
    assert.equal(webProject?.stackTags.includes('pnpm'), true);
    assert.equal(webProject?.stackTags.includes('vue3'), true);

    const apiProject = workspaceInfo.projects.find(project => project.relativePath === 'packages/api');
    assert.equal(apiProject?.frameworkLabel, 'Express');
    assert.equal(apiProject?.projectKind, 'backend');
    assert.equal(apiProject?.stackTags.includes('express'), true);

    const dotnetProject = workspaceInfo.projects.find(project => project.relativePath === 'services/dotnet');
    assert.equal(dotnetProject?.lang, 'dotnet');
    assert.equal(dotnetProject?.frameworkLabel, 'ASP.NET Core');
    assert.equal(dotnetProject?.projectKind, 'backend');

    assert.equal(workspaceInfo.projects.some(project => project.relativePath.includes('ignored-package')), false);
    assert.equal(messages.warn.length, 0);
    assert.equal(messages.log.some(message => /Workspace/.test(message)), true);

    const targetedWorkspaceInfo = createScopedWorkspaceInfo(workspaceInfo, 'project-targeted', 'api');
    assert.equal(targetedWorkspaceInfo.scope, 'project-targeted');
    assert.equal(targetedWorkspaceInfo.selectedProject, 'packages/api');
    assert.deepEqual(targetedWorkspaceInfo.projects.map(project => project.relativePath), ['packages/api']);

    assert.throws(
      () => createScopedWorkspaceInfo(workspaceInfo, 'project-targeted', null),
      /--project <selector>/,
    );
    assert.throws(
      () => createScopedWorkspaceInfo(workspaceInfo, 'project-targeted', 'missing-project'),
      /未找到匹配的子项目/,
    );
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testContextTargeting() {
  assertBuiltArtifactExists(contextTargetingDistPath, 'npm run build:scripts');
  const {
    collectProjectFrameworkTags,
    matchesBusinessRuleSelector,
    matchesSkillRole,
    shouldIncludeSkill,
    collectMatchedBusinessRules,
  } = require(contextTargetingDistPath);

  const frontendProject = {
    name: '@demo/web',
    relativePath: 'packages/web',
    absolutePath: 'E:/workspace/packages/web',
    lang: 'typescript',
    vueProfile: { version: 3, type: 'standard' },
    dependencies: {
      vue: '^3.5.0',
      'ant-design-vue': '^4.0.0',
    },
    matchedLayer2Rules: [],
    frameworkLabel: 'Vue 3',
    uiLibLabels: ['Ant Design Vue'],
    projectKind: 'frontend',
    stackTags: ['typescript', 'vue3', 'antdesignvue', 'vite'],
  };
  const backendProject = {
    name: '@demo/api',
    relativePath: 'packages/api',
    absolutePath: 'E:/workspace/packages/api',
    lang: 'javascript',
    vueProfile: null,
    dependencies: {
      express: '^5.0.0',
    },
    matchedLayer2Rules: [],
    frameworkLabel: 'Express',
    uiLibLabels: [],
    projectKind: 'backend',
    stackTags: ['javascript', 'express', 'esm'],
  };
  const workspaceInfo = {
    isWorkspace: true,
    rootDir: 'E:/workspace',
    projects: [frontendProject, backendProject],
    discoveredAt: '2026-03-12T00:00:00.000Z',
    scope: 'workspace-union',
    selectedProject: null,
    totalProjectCount: 2,
  };

  assert.deepEqual([...collectProjectFrameworkTags(frontendProject)].sort(), [
    'antdesignvue',
    'typescript',
    'vite',
    'vue3',
  ]);

  assert.equal(shouldIncludeSkill({
    id: 'frontend-vue',
    name: 'Frontend Vue',
    description: 'frontend',
    triggers: [],
    languages: ['typescript'],
    frameworks: ['Spring Boot'],
  }, workspaceInfo, null), true);
  assert.equal(shouldIncludeSkill({
    id: 'backend-only',
    name: 'Backend Only',
    description: 'backend',
    triggers: [],
    languages: ['java'],
    frameworks: ['Express'],
  }, workspaceInfo, null), true);
  assert.equal(shouldIncludeSkill({
    id: 'java-only',
    name: 'Java Only',
    description: 'java',
    triggers: [],
    languages: ['java'],
  }, workspaceInfo, null), false);
  assert.equal(shouldIncludeSkill({
    id: 'workspace-union-only',
    name: 'Workspace Union',
    description: 'union',
    triggers: [],
    workspaceScope: 'workspace-union',
  }, workspaceInfo, null), true);
  assert.equal(shouldIncludeSkill({
    id: 'project-targeted-only',
    name: 'Project Targeted',
    description: 'targeted',
    triggers: [],
    workspaceScope: 'project-targeted',
  }, workspaceInfo, null), false);
  assert.equal(shouldIncludeSkill({
    id: 'backend-role',
    name: 'Backend Role',
    description: 'backend role',
    triggers: [],
    roles: ['backend'],
  }, workspaceInfo, 'fullstack'), true);
  assert.equal(matchesSkillRole({ roles: ['qa'] }, 'backend'), false);

  assert.equal(matchesBusinessRuleSelector(frontendProject, 'vue'), true);
  assert.equal(matchesBusinessRuleSelector(frontendProject, 'dep:vue'), true);
  assert.equal(matchesBusinessRuleSelector(frontendProject, 'package:vue'), true);
  assert.equal(matchesBusinessRuleSelector(frontendProject, 'stack:Vue 3'), true);
  assert.equal(matchesBusinessRuleSelector(frontendProject, 'framework:Ant Design Vue'), true);
  assert.equal(matchesBusinessRuleSelector(frontendProject, 'lang:typescript'), true);
  assert.equal(matchesBusinessRuleSelector(frontendProject, 'kind:frontend'), true);
  assert.equal(matchesBusinessRuleSelector(frontendProject, 'pkg:react'), false);
  assert.equal(matchesBusinessRuleSelector(frontendProject, 'unknown:value'), false);
  assert.equal(matchesBusinessRuleSelector(frontendProject, ''), false);

  const matchedRules = collectMatchedBusinessRules(frontendProject, {
    vue: ['vue-base', 'shared-ui'],
    'stack:Vue 3': ['vue-base', 'vue-advanced'],
    'framework:Ant Design Vue': ['shared-ui', 'antd-vue'],
    'lang:typescript': ['ts-common'],
    'kind:backend': ['backend-only'],
  });
  assert.deepEqual(matchedRules, [
    { selector: 'vue', rule: 'vue-base' },
    { selector: 'vue', rule: 'shared-ui' },
    { selector: 'stack:Vue 3', rule: 'vue-advanced' },
    { selector: 'framework:Ant Design Vue', rule: 'antd-vue' },
    { selector: 'lang:typescript', rule: 'ts-common' },
  ]);
}

async function testInstallStateHelpers() {
  assertBuiltArtifactExists(installStateDistPath, 'npm run build:scripts');
  const {
    createInstallSnapshotId,
    listSnapshotEntries,
    gcSnapshotEntries,
    buildInstallState,
    writeInstallState,
  } = require(installStateDistPath);

  const deterministicSnapshotId = createInstallSnapshotId({
    now: new Date('2026-03-12T01:02:03.000Z'),
    pid: 42,
    randomValue: 0.125,
    epochMs: 1234567890,
  });
  assert.match(deterministicSnapshotId, /^20260312T010203Z-[a-f0-9]{8}$/);
  assert.equal(deterministicSnapshotId, createInstallSnapshotId({
    now: new Date('2026-03-12T01:02:03.000Z'),
    pid: 42,
    randomValue: 0.125,
    epochMs: 1234567890,
  }));

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-install-state-'));
  try {
    const snapshotRoot = path.join(tempDir, '.codebuddy', 'skill-snapshots');
    const newestSnapshot = path.join(snapshotRoot, '20260312T010203Z-aaaa1111');
    const middleSnapshot = path.join(snapshotRoot, '20260311T010203Z-bbbb2222');
    const activeSnapshot = path.join(snapshotRoot, '20260310T010203Z-cccc3333');
    await fsp.mkdir(newestSnapshot, { recursive: true });
    await fsp.mkdir(middleSnapshot, { recursive: true });
    await fsp.mkdir(activeSnapshot, { recursive: true });
    await fsp.writeFile(path.join(newestSnapshot, 'skill.md'), '# newest\n', 'utf-8');
    await fsp.writeFile(path.join(middleSnapshot, 'skill.md'), '# middle\n', 'utf-8');
    await fsp.writeFile(path.join(activeSnapshot, 'skill.md'), '# active\n', 'utf-8');

    const snapshotEntries = listSnapshotEntries(tempDir, '.codebuddy/skill-snapshots');
    assert.deepEqual(snapshotEntries.map(entry => entry.name), [
      '20260312T010203Z-aaaa1111',
      '20260311T010203Z-bbbb2222',
      '20260310T010203Z-cccc3333',
    ]);

    const warnedMessages = [];
    const removedSnapshots = gcSnapshotEntries(
      tempDir,
      '.codebuddy/skill-snapshots',
      '.codebuddy/skill-snapshots/20260310T010203Z-cccc3333',
      2,
      { warn(message) { warnedMessages.push(message); } },
    );
    assert.deepEqual(removedSnapshots, ['.codebuddy/skill-snapshots/20260311T010203Z-bbbb2222']);
    assert.equal(fs.existsSync(newestSnapshot), true);
    assert.equal(fs.existsSync(activeSnapshot), true);
    assert.equal(fs.existsSync(middleSnapshot), false);
    assert.deepEqual(warnedMessages, []);

    const ctx = createLoaderContext({
      isRemote: true,
      remoteBaseUrl: 'https://example.com/standards',
      remoteManifest: { version: '9.9.9' },
      remoteContentPack: {
        file: 'packs/content-pack-analysis.json',
        format: 'content-pack-json-v1',
        sha256: 'pack-sha',
      },
      profile: 'analysis',
    });
    const workspaceIndexPath = path.join(tempDir, '.codebuddy', 'workspace-index.json');
    const outputPath = path.join(tempDir, '.codebuddy', 'rules', 'project-rules.md');
    const workspaceInfo = {
      isWorkspace: false,
      rootDir: tempDir,
      projects: [{ relativePath: '.' }],
      discoveredAt: '2026-03-12T00:00:00.000Z',
      scope: 'workspace-union',
      selectedProject: null,
      totalProjectCount: 1,
    };
    const buildParams = {
      version: '3.3.0',
      installedAt: '2026-03-12T00:00:00.000Z',
      ctx,
      targetDir: tempDir,
      outputPath,
      workspaceIndexPath,
      skillsRootDir: '.codebuddy/skill-snapshots/current',
      skillsSnapshotRetention: 3,
      agentsRootDir: '.codebuddy/agent-snapshots/current',
      agentsSnapshotRetention: 3,
      layer1RulesCount: 2,
      layer2IndexCount: 4,
      layer3IndexCount: 1,
      skillsCount: 5,
      agentsCount: 2,
      distributedScripts: ['report-manager.js', 'context-collector.js'],
      distributedWorkflows: [],
      distributedTaskBooks: [],
      distributedAgentCalls: [],
      distributedCommands: ['install.md'],
      managedFiles: [
        { path: '.codebuddy/rules/project-rules.md', sha256: 'rules-v1', size: 120 },
        { path: '.codebuddy/workspace-index.json', sha256: 'index-v1', size: 80 },
        { path: '.codebuddy/scripts/report-manager.js', sha256: 'script-v1', size: 42 },
      ],
      workspaceInfo,
    };

    const baselineInstallState = buildInstallState(buildParams);
    const rulesOnlyChangeInstallState = buildInstallState({
      ...buildParams,
      managedFiles: [
        { path: '.codebuddy/rules/project-rules.md', sha256: 'rules-v2', size: 140 },
        { path: '.codebuddy/workspace-index.json', sha256: 'index-v2', size: 96 },
        { path: '.codebuddy/scripts/report-manager.js', sha256: 'script-v1', size: 42 },
      ],
    });
    const runtimeChangeInstallState = buildInstallState({
      ...buildParams,
      managedFiles: [
        { path: '.codebuddy/rules/project-rules.md', sha256: 'rules-v1', size: 120 },
        { path: '.codebuddy/workspace-index.json', sha256: 'index-v1', size: 80 },
        { path: '.codebuddy/scripts/report-manager.js', sha256: 'script-v2', size: 42 },
      ],
    });

    assert.equal(baselineInstallState.contentHash, rulesOnlyChangeInstallState.contentHash);
    assert.notEqual(baselineInstallState.contentHash, runtimeChangeInstallState.contentHash);
    assert.equal(baselineInstallState.outputs.rulesFile, '.codebuddy/rules/project-rules.md');
    assert.equal(baselineInstallState.outputs.workspaceIndexFile, '.codebuddy/workspace-index.json');
    assert.deepEqual(baselineInstallState.managedFiles.map(file => file.path), [
      '.codebuddy/rules/project-rules.md',
      '.codebuddy/scripts/report-manager.js',
      '.codebuddy/workspace-index.json',
    ]);

    const installStatePath = writeInstallState(tempDir, baselineInstallState);
    assert.equal(installStatePath, path.join(tempDir, '.codebuddy', 'install.json'));
    const writtenInstallState = JSON.parse(await fsp.readFile(installStatePath, 'utf-8'));
    assert.equal(writtenInstallState.version, '3.3.0');
    assert.equal(writtenInstallState.source.contentPackFile, 'packs/content-pack-analysis.json');
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testWorkflowRoutingLibrary() {
  assertBuiltArtifactExists(workflowRoutingDistPath, 'npm run build:scripts');
  const {
    buildWorkflowRoutingInput,
    buildWorkflowCatalog,
    selectWorkflowRoutingDecision,
  } = require(workflowRoutingDistPath);

  function createTaskBookFixture(overrides = {}) {
    return {
      id: 'tb-routing-demo',
      title: 'Fix login hotfix',
      description: '修复登录按钮点击无响应',
      taskType: 'debugging',
      createdAt: '2026-03-14T00:00:00.000Z',
      status: 'confirmed',
      context: {
        relatedFiles: [],
        dependencies: [],
      },
      changelog: [],
      tasks: [
        {
          id: 'task-1',
          title: 'Patch login button handler',
          type: 'implement',
          status: 'pending',
          priority: 'high',
          dependencies: [],
          acceptanceCriteria: ['login button works'],
          scope: { files: ['src/features/login/index.ts'], modules: ['login'], tags: ['hotfix'] },
        },
        {
          id: 'task-2',
          title: 'Verify login flow',
          type: 'test',
          status: 'pending',
          priority: 'medium',
          dependencies: ['task-1'],
          acceptanceCriteria: ['tests pass'],
          scope: { files: ['test/login.test.ts'], modules: ['login'] },
        },
      ],
      ...overrides,
    };
  }

  const routingCatalog = buildWorkflowCatalog();

  const microInput = buildWorkflowRoutingInput(createTaskBookFixture());
  const microDecision = selectWorkflowRoutingDecision(microInput, { generatedAt: '2026-03-14T00:00:00.000Z' });
  assert.equal(microDecision.mode, 'auto');
  assert.equal(microDecision.selectedWorkflowId, 'micro');
  assert.equal(microDecision.canonicalWorkflowId, 'micro');
  assert.equal(microDecision.selectedWorkflowPath, routingCatalog.micro);

  const sprintTaskBook = createTaskBookFixture({
    id: 'tb-routing-sprint',
    title: '迭代用户资料编辑能力',
    description: '为用户资料页面补充编辑、保存、校验和 review',
    taskType: 'new-feature',
    tasks: [
      {
        id: 'task-1',
        title: 'Analyze profile module',
        type: 'analysis',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
        acceptanceCriteria: ['module boundaries documented'],
        scope: { files: ['src/features/profile/index.ts'], modules: ['profile'] },
      },
      {
        id: 'task-2',
        title: 'Implement profile editor',
        type: 'implement',
        status: 'pending',
        priority: 'high',
        dependencies: ['task-1'],
        acceptanceCriteria: ['editor renders', 'save works'],
        scope: { files: ['src/features/profile/editor.tsx'], modules: ['profile'] },
      },
      {
        id: 'task-3',
        title: 'Add validation tests',
        type: 'test',
        status: 'pending',
        priority: 'medium',
        dependencies: ['task-2'],
        acceptanceCriteria: ['tests cover validation'],
        scope: { files: ['test/profile.validation.test.ts'], modules: ['profile'] },
      },
      {
        id: 'task-4',
        title: 'Review the implementation',
        type: 'review',
        status: 'pending',
        priority: 'medium',
        dependencies: ['task-3'],
        acceptanceCriteria: ['review completed'],
        scope: { files: ['src/features/profile/editor.tsx'], modules: ['profile'] },
      },
    ],
  });
  const sprintInput = buildWorkflowRoutingInput(sprintTaskBook);
  const sprintDecision = selectWorkflowRoutingDecision(sprintInput, { generatedAt: '2026-03-14T00:00:01.000Z' });
  assert.equal(sprintDecision.mode, 'auto');
  assert.equal(sprintDecision.selectedWorkflowId, 'sprint');
  assert.equal(sprintDecision.canonicalWorkflowId, 'sprint');

  const defaultTaskBook = createTaskBookFixture({
    id: 'tb-routing-default',
    title: '新功能：跨模块订单中心',
    description: '需要 requirement、设计、实现、审查和 build-fix 闭环',
    taskType: 'new-feature',
    tasks: [
      {
        id: 'task-1',
        title: 'Clarify requirement',
        type: 'requirement',
        status: 'pending',
        priority: 'high',
        dependencies: [],
        acceptanceCriteria: ['requirement clarified'],
        scope: { modules: ['orders'] },
      },
      {
        id: 'task-2',
        title: 'Write PRD',
        type: 'prd',
        status: 'pending',
        priority: 'high',
        dependencies: ['task-1'],
        acceptanceCriteria: ['prd ready'],
        scope: { modules: ['orders'] },
      },
      {
        id: 'task-3',
        title: 'Design architecture',
        type: 'design',
        status: 'pending',
        priority: 'high',
        dependencies: ['task-2'],
        acceptanceCriteria: ['design approved'],
        scope: { modules: ['orders', 'payments', 'notifications'] },
      },
      {
        id: 'task-4',
        title: 'Implement order service',
        type: 'implement',
        status: 'pending',
        priority: 'critical',
        dependencies: ['task-3'],
        acceptanceCriteria: ['service works'],
        scope: { files: ['src/orders/service.ts'], modules: ['orders'] },
      },
      {
        id: 'task-5',
        title: 'Review changes',
        type: 'review',
        status: 'pending',
        priority: 'medium',
        dependencies: ['task-4'],
        acceptanceCriteria: ['review passed'],
        scope: { files: ['src/orders/service.ts'], modules: ['orders'] },
      },
      {
        id: 'task-6',
        title: 'Fix build regressions',
        type: 'build-fix',
        status: 'pending',
        priority: 'high',
        dependencies: ['task-5'],
        acceptanceCriteria: ['build passes'],
        scope: { files: ['src/orders/service.ts', 'src/payments/index.ts'], modules: ['orders', 'payments'] },
      },
    ],
  });
  const defaultInput = buildWorkflowRoutingInput(defaultTaskBook, {
    scope: 'workspace-union',
    selectedProject: null,
    totalProjectCount: 3,
    projects: [
      { projectKind: 'frontend' },
      { projectKind: 'backend' },
    ],
  });
  const defaultDecision = selectWorkflowRoutingDecision(defaultInput, { generatedAt: '2026-03-14T00:00:02.000Z' });
  assert.equal(defaultDecision.mode, 'auto');
  assert.equal(defaultDecision.selectedWorkflowId, 'default');
  assert.equal(defaultDecision.canonicalWorkflowId, 'default');

  const fallbackDecision = selectWorkflowRoutingDecision(microInput, {
    availableWorkflowIds: ['default', 'sprint'],
    generatedAt: '2026-03-14T00:00:03.000Z',
  });
  assert.equal(fallbackDecision.mode, 'fallback');
  assert.equal(fallbackDecision.selectedWorkflowId, 'default');
  assert.equal(fallbackDecision.fallbackReason, 'workflow_unavailable:micro');

  const explicitDecision = selectWorkflowRoutingDecision(microInput, {
    explicitWorkflowPath: '.codebuddy/workflows/legacy.workflow.json',
    existingDecision: defaultDecision,
    generatedAt: '2026-03-14T00:00:04.000Z',
  });
  assert.equal(explicitDecision.mode, 'explicit');
  assert.equal(explicitDecision.selectedWorkflowId, 'legacy');
  assert.equal(explicitDecision.selectedWorkflowPath, '.codebuddy/workflows/legacy.workflow.json');

  const reusedDecision = selectWorkflowRoutingDecision(microInput, {
    existingDecision: sprintDecision,
    generatedAt: '2026-03-14T00:00:05.000Z',
  });
  assert.equal(reusedDecision.mode, 'reused');
  assert.equal(reusedDecision.selectedWorkflowId, 'sprint');
  assert.equal(reusedDecision.reusedFromTaskBook, true);
}

async function testTaskIntakeRoutingLibrary() {
  assertBuiltArtifactExists(taskIntakeRoutingDistPath, 'npm run build:scripts');
  assertBuiltArtifactExists(taskIntakeRouterDistPath, 'npm run build:scripts');
  const {
    createDefaultTaskIntakeInput,
    routeTaskIntake,
  } = require(taskIntakeRoutingDistPath);
  const {
    parseTaskIntakeCliArgs,
    routeTaskIntakeCli,
  } = require(taskIntakeRouterDistPath);

  const directDecision = routeTaskIntake(createDefaultTaskIntakeInput({
    description: 'replace mock login API with the provided contract',
    contractState: 'explicit',
    uncertainty: 'low',
    estimatedFileCount: 4,
    estimatedModuleCount: 1,
    estimatedDomainCount: 1,
    estimatedEndpointCount: 2,
  }));
  assert.equal(directDecision.recommendedPath, 'direct');
  assert.equal(directDecision.inferredKind, 'api-adaptation');
  assert.equal(directDecision.hardEscalationTriggers.length, 0);
  assert.ok(directDecision.reasons.some(reason => reason.includes('small-change direct-execution boundary')));

  const orchestratedDecision = routeTaskIntake(createDefaultTaskIntakeInput({
    description: 'replace API layer across user and admin modules with staged review',
    contractState: 'partial',
    uncertainty: 'medium',
    estimatedFileCount: 12,
    estimatedModuleCount: 3,
    estimatedDomainCount: 2,
    requiresHandoff: true,
    changesStateModel: true,
  }));
  assert.equal(orchestratedDecision.recommendedPath, 'orchestrated');
  assert.ok(orchestratedDecision.hardEscalationTriggers.some(trigger => trigger.includes('estimatedModuleCount=3')));
  assert.ok(orchestratedDecision.hardEscalationTriggers.some(trigger => trigger.includes('staged handoff')));

  const parsedDirect = parseTaskIntakeCliArgs([
    '--description', 'replace mock login API with the provided contract',
    '--files', '4',
    '--contract', 'explicit',
    '--uncertainty', 'low',
  ]);
  const cliDirectDecision = routeTaskIntakeCli(parsedDirect);
  assert.equal(cliDirectDecision.recommendedPath, 'direct');

  const parsedEscalated = parseTaskIntakeCliArgs([
    '--description', 'feature redesign across checkout and account flows',
    '--modules', '2',
    '--tracking',
  ]);
  const cliEscalatedDecision = routeTaskIntakeCli(parsedEscalated);
  assert.equal(cliEscalatedDecision.recommendedPath, 'orchestrated');
  assert.ok(cliEscalatedDecision.hardEscalationTriggers.length >= 1);
}

async function testDoctorArchitectureWarnings() {
  assertBuiltArtifactExists(installHealthDistPath, 'npm run build:scripts');
  const { inspectInstallState, buildDoctorChecks } = require(installHealthDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-install-health-'));
  try {
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'rules'), { recursive: true });
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'workflows'), { recursive: true });
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'agent-calls'), { recursive: true });

    await fsp.writeFile(path.join(tempDir, '.codebuddy', 'rules', 'project-rules.md'), '# rules\n', 'utf-8');

    const workflow = {
      id: 'default',
      version: '2.0.0',
      steps: [
        { id: 'requirement', type: 'requirement_and_prd', title: 'Requirement' },
        { id: 'analyze', type: 'analyze_project', title: 'Analyze' },
        { id: 'plan', type: 'create_taskbook', title: 'Plan' },
        { id: 'implement', type: 'tdd_implement', title: 'Implement' },
        { id: 'review', type: 'code_review', title: 'Review' },
        { id: 'build', type: 'build_and_fix', title: 'Build' },
        { id: 'acceptance', type: 'acceptance_and_archive', title: 'Acceptance' },
        { id: 'verify', type: 'run_tests', title: 'Extra verify' },
      ],
    };
    await fsp.writeFile(
      path.join(tempDir, '.codebuddy', 'workflows', 'default.workflow.json'),
      `${JSON.stringify(workflow, null, 2)}\n`,
      'utf-8',
    );

    const requestId = 'req-demo-456';
    const promptHeader = {
      requestId,
      promptPath: '.codebuddy/prompts/req-demo-456.prompt.md',
      resultPath: '.codebuddy/results/req-demo-456.result.json',
    };
    await fsp.writeFile(
      path.join(tempDir, '.codebuddy', 'agent-calls', `${requestId}.prompt.md`),
      [
        '# Agent Call: manual-task',
        '',
        '## Header (JSON)',
        '```json',
        JSON.stringify(promptHeader, null, 2),
        '```',
        '',
      ].join('\n'),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(tempDir, '.codebuddy', 'agent-calls', `${requestId}.result.json`),
      `${JSON.stringify({ requestId, status: 'success', output: { actualWork: 'done' } }, null, 2)}\n`,
      'utf-8',
    );

    const installState = createInstallState({
      profile: 'full',
      enableOrchestrator: true,
      outputs: {
        rulesFile: '.codebuddy/rules/project-rules.md',
        workspaceIndexFile: null,
        skillsRootDir: null,
        skillsSnapshotRetention: null,
        agentsRootDir: null,
        agentsSnapshotRetention: null,
      },
      managedFiles: [
        { path: '.codebuddy/rules/project-rules.md', sha256: 'rules', size: 8 },
        { path: '.codebuddy/workflows/default.workflow.json', sha256: 'workflow', size: 32 },
        { path: `.codebuddy/agent-calls/${requestId}.prompt.md`, sha256: 'prompt', size: 64 },
        { path: `.codebuddy/agent-calls/${requestId}.result.json`, sha256: 'result', size: 32 },
      ],
      stats: {
        layer1Rules: 1,
        layer2Indexes: 0,
        layer3Indexes: 0,
        skills: 0,
        agents: 0,
        scripts: 0,
        workflows: 1,
        taskbooks: 0,
        agentCalls: 1,
        commands: 0,
        workspaceProjects: 1,
      },
    });

    const inspection = inspectInstallState(tempDir, installState, true);
    const checks = buildDoctorChecks(inspection);
    const architectureCheck = checks.find(check => check.id === 'architecture-constraints');
    assert.equal(architectureCheck?.status, 'warn');
    assert.equal(architectureCheck?.details?.some(detail => detail.includes('default workflow has 8 steps')), true);
    assert.equal(architectureCheck?.details?.some(detail => detail.includes('prompt header promptPath=')), true);
    assert.equal(architectureCheck?.details?.some(detail => detail.includes('prompt header resultPath=')), true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testDoctorValidatorGateWarnings() {
  assertBuiltArtifactExists(installHealthDistPath, 'npm run build:scripts');
  const { inspectInstallState, buildDoctorChecks } = require(installHealthDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-install-health-validator-'));
  try {
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'rules'), { recursive: true });
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'reports', 'validators', 'latest'), { recursive: true });
    await fsp.writeFile(path.join(tempDir, '.codebuddy', 'rules', 'project-rules.md'), '# rules\n', 'utf-8');
    await fsp.writeFile(
      path.join(tempDir, '.codebuddy', 'reports', 'validators', 'latest', 'validator-gate-summary.json'),
      `${JSON.stringify({
        ok: true,
        effectiveOk: false,
        strictMode: true,
        scope: 'all',
        generatedAt: '2026-03-17T12:00:00.000Z',
        errorCount: 0,
        warningCount: 3,
        issueCount: 3,
        outputDir: '.codebuddy/reports/validators/latest',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2)}\n`,
      'utf-8',
    );

    const installState = createInstallState({
      profile: 'core',
      enableOrchestrator: false,
      outputs: {
        rulesFile: '.codebuddy/rules/project-rules.md',
        workspaceIndexFile: null,
        skillsRootDir: null,
        skillsSnapshotRetention: null,
        agentsRootDir: null,
        agentsSnapshotRetention: null,
      },
      managedFiles: [
        { path: '.codebuddy/rules/project-rules.md', sha256: 'rules', size: 8 },
      ],
      stats: {
        layer1Rules: 1,
        layer2Indexes: 0,
        layer3Indexes: 0,
        skills: 0,
        agents: 0,
        scripts: 0,
        workflows: 0,
        taskbooks: 0,
        agentCalls: 0,
        commands: 0,
        workspaceProjects: 1,
      },
    });

    const inspection = inspectInstallState(tempDir, installState, true);
    const checks = buildDoctorChecks(inspection);
    const validatorCheck = checks.find(check => check.id === 'validator-gate-report');
    assert.equal(validatorCheck?.status, 'warn');
    assert.equal(validatorCheck?.message.includes('最近一次 validator gate 需关注'), true);
    assert.equal(validatorCheck?.details?.some(detail => detail.includes('scope=all')), true);
    assert.equal(validatorCheck?.details?.some(detail => detail.includes('warnings=3')), true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testDoctorIgnoresKnownOptionalStaticSupportFiles() {
  assertBuiltArtifactExists(installHealthDistPath, 'npm run build:scripts');
  const { inspectInstallState, buildDoctorChecks } = require(installHealthDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-install-health-static-support-'));
  try {
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'rules'), { recursive: true });
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'scripts', 'types'), { recursive: true });
    await fsp.writeFile(path.join(tempDir, '.codebuddy', 'rules', 'project-rules.md'), '# rules\n', 'utf-8');
    await fsp.writeFile(path.join(tempDir, '.codebuddy', 'scripts', 'agent-runtime.js'), '// helper\n', 'utf-8');
    await fsp.writeFile(path.join(tempDir, '.codebuddy', 'scripts', 'types', 'agent-runtime.js'), '// helper type\n', 'utf-8');
    await fsp.writeFile(path.join(tempDir, '.codebuddy', 'scripts', 'types', 'index.js'), '// helper type index\n', 'utf-8');

    const installState = createInstallState({
      profile: 'core',
      enableOrchestrator: false,
      outputs: {
        rulesFile: '.codebuddy/rules/project-rules.md',
        workspaceIndexFile: null,
        skillsRootDir: null,
        skillsSnapshotRetention: null,
        agentsRootDir: null,
        agentsSnapshotRetention: null,
      },
      managedFiles: [
        { path: '.codebuddy/rules/project-rules.md', sha256: 'rules', size: 8 },
      ],
      stats: {
        layer1Rules: 1,
        layer2Indexes: 0,
        layer3Indexes: 0,
        skills: 0,
        agents: 0,
        scripts: 0,
        workflows: 0,
        taskbooks: 0,
        agentCalls: 0,
        commands: 0,
        workspaceProjects: 1,
      },
    });

    const inspection = inspectInstallState(tempDir, installState, true);
    assert.deepEqual(inspection.unexpectedStaticFiles, []);
    const checks = buildDoctorChecks(inspection);
    const staticFilesCheck = checks.find(check => check.id === 'unexpected-static-files');
    assert.equal(staticFilesCheck?.status, 'pass');
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testDoctorWarnsOnValidatorGateRegressionEvenWhenLatestPasses() {
  assertBuiltArtifactExists(installHealthDistPath, 'npm run build:scripts');
  const { inspectInstallState, buildDoctorChecks } = require(installHealthDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-install-health-validator-regression-'));
  try {
    const latestDir = path.join(tempDir, '.codebuddy', 'reports', 'validators', 'latest');
    const historyRoot = path.join(tempDir, '.codebuddy', 'reports', 'validators', 'history');
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'rules'), { recursive: true });
    await fsp.mkdir(latestDir, { recursive: true });
    await fsp.mkdir(path.join(historyRoot, '2026-03-17T12-00-00-000Z'), { recursive: true });
    await fsp.mkdir(path.join(historyRoot, '2026-03-17T11-00-00-000Z'), { recursive: true });
    await fsp.writeFile(path.join(tempDir, '.codebuddy', 'rules', 'project-rules.md'), '# rules\n', 'utf-8');

    const latestGeneratedAt = '2026-03-17T12:00:00.000Z';
    const latestSummary = {
      ok: true,
      effectiveOk: true,
      strictMode: false,
      scope: 'all',
      generatedAt: latestGeneratedAt,
      errorCount: 0,
      warningCount: 2,
      issueCount: 2,
      outputDir: '.codebuddy/reports/validators/latest',
      historyDir: '.codebuddy/reports/validators/history/2026-03-17T12-00-00-000Z',
      reportFiles: ['validator-gate-summary.json'],
      reports: {},
    };

    await fsp.writeFile(
      path.join(latestDir, 'validator-gate-summary.json'),
      `${JSON.stringify(latestSummary, null, 2)}\n`,
      'utf-8',
    );
    await fsp.writeFile(
      path.join(historyRoot, '2026-03-17T12-00-00-000Z', 'validator-gate-summary.json'),
      `${JSON.stringify(latestSummary, null, 2)}\n`,
      'utf-8',
    );
    await fsp.writeFile(
      path.join(historyRoot, '2026-03-17T11-00-00-000Z', 'validator-gate-summary.json'),
      `${JSON.stringify({
        ok: true,
        effectiveOk: true,
        strictMode: false,
        scope: 'all',
        generatedAt: '2026-03-17T11:00:00.000Z',
        errorCount: 0,
        warningCount: 0,
        issueCount: 0,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-03-17T11-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2)}\n`,
      'utf-8',
    );

    const installState = createInstallState({
      profile: 'core',
      enableOrchestrator: false,
      outputs: {
        rulesFile: '.codebuddy/rules/project-rules.md',
        workspaceIndexFile: null,
        skillsRootDir: null,
        skillsSnapshotRetention: null,
        agentsRootDir: null,
        agentsSnapshotRetention: null,
      },
      managedFiles: [
        { path: '.codebuddy/rules/project-rules.md', sha256: 'rules', size: 8 },
      ],
      stats: {
        layer1Rules: 1,
        layer2Indexes: 0,
        layer3Indexes: 0,
        skills: 0,
        agents: 0,
        scripts: 0,
        workflows: 0,
        taskbooks: 0,
        agentCalls: 0,
        commands: 0,
        workspaceProjects: 1,
      },
    });

    const inspection = inspectInstallState(tempDir, installState, true);
    const checks = buildDoctorChecks(inspection);
    const validatorCheck = checks.find(check => check.id === 'validator-gate-report');
    assert.equal(validatorCheck?.status, 'warn');
    assert.equal(validatorCheck?.message.includes('相对上一轮有回退'), true);
    assert.equal(validatorCheck?.details?.some(detail => detail.includes('validator gate trend: regressed')), true);
    assert.equal(validatorCheck?.details?.some(detail => detail.includes('warnings=+2')), true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testContractValidatorArchitectureWarnings() {
  assertBuiltArtifactExists(contractValidatorDistPath, 'npm run build:scripts');
  const { runContractValidation } = require(contractValidatorDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-contract-validator-'));
  try {
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'workflows'), { recursive: true });
    await fsp.mkdir(path.join(tempDir, '.codebuddy', 'agent-calls'), { recursive: true });

    const workflow = {
      id: 'default',
      version: '2.0.0',
      steps: [
        { id: 'requirement', type: 'requirement_and_prd', title: 'Requirement' },
        { id: 'analyze', type: 'analyze_project', title: 'Analyze' },
        { id: 'plan', type: 'create_taskbook', title: 'Plan' },
        { id: 'implement', type: 'tdd_implement', title: 'Implement' },
        { id: 'review', type: 'code_review', title: 'Review' },
        { id: 'build', type: 'build_and_fix', title: 'Build' },
        { id: 'acceptance', type: 'acceptance_and_archive', title: 'Acceptance' },
        { id: 'verify', type: 'run_tests', title: 'Extra verify' },
      ],
      edges: [
        { from: 'requirement', to: 'analyze' },
        { from: 'analyze', to: 'plan' },
        { from: 'plan', to: 'implement' },
        { from: 'implement', to: 'review' },
        { from: 'review', to: 'build' },
        { from: 'build', to: 'acceptance' },
        { from: 'acceptance', to: 'verify' },
      ],
    };
    await fsp.writeFile(
      path.join(tempDir, '.codebuddy', 'workflows', 'default.workflow.json'),
      `${JSON.stringify(workflow, null, 2)}\n`,
      'utf-8',
    );

    const requestId = 'req-demo-123';
    const promptHeader = {
      requestId,
      agentId: 'code-reviewer',
      taskBookId: 'tb-demo',
      taskId: 'task-1',
      taskType: 'review',
      timestamp: '2026-03-14T00:00:00.000Z',
      promptPath: '.codebuddy/prompts/req-demo-123.prompt.md',
      resultPath: '.codebuddy/results/req-demo-123.result.json',
    };
    await fsp.writeFile(
      path.join(tempDir, '.codebuddy', 'agent-calls', `${requestId}.prompt.md`),
      [
        '# Agent Call: manual-task',
        '',
        '## Header (JSON)',
        '```json',
        JSON.stringify(promptHeader, null, 2),
        '```',
        '',
      ].join('\n'),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(tempDir, '.codebuddy', 'agent-calls', `${requestId}.result.json`),
      `${JSON.stringify({
        requestId,
        kind: 'manual-task',
        status: 'success',
        output: { actualWork: 'Reviewed changes.' },
        completedAt: '2026-03-14T00:01:00.000Z',
      }, null, 2)}\n`,
      'utf-8',
    );

    const withoutFlagReport = runContractValidation(['--workflows', '--agent-calls', '--json'], tempDir);
    assert.equal(withoutFlagReport.ok, true);
    assert.equal(withoutFlagReport.issues.some(issue => String(issue.message || '').includes('Architecture constraints:')), false);

    const withFlagReport = runContractValidation(['--workflows', '--agent-calls', '--check-architecture-constraints', '--json'], tempDir);
    assert.equal(withFlagReport.ok, true);
    assert.equal(withFlagReport.issues.some(issue => String(issue.message || '').includes('default workflow has 8 steps')), true);
    assert.equal(withFlagReport.issues.some(issue => String(issue.message || '').includes('prompt header promptPath=')), true);
    assert.equal(withFlagReport.issues.some(issue => String(issue.message || '').includes('prompt header resultPath=')), true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testRuleValidatorMetadataWarnings() {
  assertBuiltArtifactExists(ruleValidatorDistPath, 'npm run build:scripts');
  const { validateRulesDir, finalizeRuleValidation } = require(ruleValidatorDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-rule-validator-'));
  try {
    const rulesDir = path.join(tempDir, 'rules');
    await fsp.mkdir(path.join(rulesDir, 'layer1'), { recursive: true });
    await fsp.writeFile(
      path.join(rulesDir, 'layer1', 'missing-metadata.md'),
      [
        '# Missing metadata',
        '',
        '## Context',
        '',
        'Used to verify soft warnings for missing tags/priority metadata.',
        '',
        '## The Rule',
        '',
        'Do the thing.',
        '',
        '## Reasoning',
        '',
        'Because consistency matters.',
        '',
        '## Examples',
        '',
        '```ts',
        'export const demo = true;',
        '```',
      ].join('\n'),
      'utf-8',
    );

    const report = validateRulesDir(rulesDir);
    assert.equal(report.ok, true);
    assert.equal(report.errorCount, 0);
    assert.equal(report.issues.some(issue => String(issue.message || '').includes('> Tags:')), true);
    assert.equal(report.issues.some(issue => String(issue.message || '').includes('> Priority:')), true);

    const nonStrictReport = finalizeRuleValidation(report, false);
    assert.equal(nonStrictReport.strictMode, false);
    assert.equal(nonStrictReport.effectiveOk, true);

    const strictReport = finalizeRuleValidation(report, true);
    assert.equal(strictReport.strictMode, true);
    assert.equal(strictReport.ok, true, 'base ok should stay backward-compatible');
    assert.equal(strictReport.effectiveOk, false, 'strict mode should fail on warnings');
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testSkillValidatorBundledReferenceWarnings() {
  assertBuiltArtifactExists(skillValidatorDistPath, 'npm run build:scripts');
  const { validateSkillsDir, finalizeSkillValidation } = require(skillValidatorDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-skill-validator-'));
  try {
    const skillsRoot = path.join(tempDir, 'skills');
    const skillDir = path.join(skillsRoot, 'demo-skill');
    await fsp.mkdir(path.join(skillDir, 'references'), { recursive: true });
    await fsp.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
    await fsp.writeFile(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: demo-skill',
        'description: fixture skill',
        '---',
        '',
        '# Demo Skill',
        '',
        '- Read [references/used.md](references/used.md)',
      ].join('\n'),
      'utf-8',
    );
    await fsp.writeFile(path.join(skillDir, 'references', 'used.md'), '# Used\n', 'utf-8');
    await fsp.writeFile(path.join(skillDir, 'references', 'orphan.md'), '# Orphan\n', 'utf-8');
    await fsp.writeFile(path.join(skillDir, 'scripts', 'helper.py'), 'print("hello")\n', 'utf-8');

    const report = validateSkillsDir(skillsRoot);
    assert.equal(report.ok, true);
    assert.equal(report.errorCount, 0);
    assert.equal(report.issues.some(issue => String(issue.message || '').includes('references/orphan.md')), true);
    assert.equal(report.issues.some(issue => String(issue.message || '').includes('scripts/helper.py')), true);

    const nonStrictReport = finalizeSkillValidation(report, false);
    assert.equal(nonStrictReport.strictMode, false);
    assert.equal(nonStrictReport.effectiveOk, true);

    const strictReport = finalizeSkillValidation(report, true);
    assert.equal(strictReport.strictMode, true);
    assert.equal(strictReport.ok, true, 'base ok should stay backward-compatible');
    assert.equal(strictReport.effectiveOk, false, 'strict mode should fail on warnings');
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testRepoStateValidatorWarnsOnMissingLinksAndStaleFacts() {
  assertBuiltArtifactExists(repoStateValidatorDistPath, 'npm run build:scripts');
  const { validateRepoStateRoot, finalizeRepoStateValidation } = require(repoStateValidatorDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-repo-state-validator-'));
  try {
    await writeRepositoryFactFixture(tempDir, {
      roadmapLastUpdated: '2026-02-20',
      docsIndexLastUpdated: '2026-03-01',
      protocolLastUpdated: '2026-03-18',
      handoffLatestDate: '2026-03-18',
      includeDocsIndexProtocolLink: false,
    });

    const report = validateRepoStateRoot(tempDir, { now: new Date('2026-03-19T00:00:00.000Z') });
    assert.equal(report.ok, true);
    assert.equal(report.errorCount, 0);
    assert.equal(report.issues.some(issue => String(issue.message || '').includes('docs/README 应链接 Team Collaboration Protocol')), true);
    assert.equal(report.issues.some(issue => String(issue.message || '').includes('最近日期 2026-02-20')), true);
    assert.equal(report.issues.some(issue => String(issue.message || '').includes('最近日期 2026-03-01')), true);

    const nonStrictReport = finalizeRepoStateValidation(report, false);
    assert.equal(nonStrictReport.strictMode, false);
    assert.equal(nonStrictReport.effectiveOk, true);

    const strictReport = finalizeRepoStateValidation(report, true);
    assert.equal(strictReport.strictMode, true);
    assert.equal(strictReport.ok, true, 'base ok should stay backward-compatible');
    assert.equal(strictReport.effectiveOk, false, 'strict mode should fail on warnings');
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testValidatorGateWritesStrictReports() {
  assertBuiltArtifactExists(validatorGateDistPath, 'npm run build:scripts');
  const { runValidatorGate } = require(validatorGateDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-validator-gate-'));
  try {
    await writeRepositoryFactFixture(tempDir);

    const rulesDir = path.join(tempDir, 'rules');
    const skillsDir = path.join(tempDir, 'custom-skills');
    const skillDir = path.join(skillsDir, 'demo-skill');
    const outDir = path.join(tempDir, 'reports');

    await fsp.mkdir(path.join(rulesDir, 'layer1'), { recursive: true });
    await fsp.mkdir(path.join(skillDir, 'references'), { recursive: true });

    await fsp.writeFile(
      path.join(rulesDir, 'layer1', 'missing-tags.md'),
      [
        '# Missing tags',
        '',
        '## Context',
        '',
        'Rule fixture.',
        '',
        '## The Rule',
        '',
        'Do the thing.',
        '',
        '## Reasoning',
        '',
        'Consistency matters.',
        '',
        '## Examples',
        '',
        '```ts',
        'export const demo = true;',
        '```',
      ].join('\n'),
      'utf-8',
    );

    await fsp.writeFile(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: demo-skill',
        'description: fixture skill',
        '---',
        '',
        '# Demo Skill',
        '',
        '- Read [references/used.md](references/used.md)',
      ].join('\n'),
      'utf-8',
    );
    await fsp.writeFile(path.join(skillDir, 'references', 'used.md'), '# Used\n', 'utf-8');
    await fsp.writeFile(path.join(skillDir, 'references', 'orphan.md'), '# Orphan\n', 'utf-8');

    const report = runValidatorGate({
      scope: 'all',
      strict: true,
      json: false,
      outDir,
      rulesDir,
      skillsDir,
      repoRoot: tempDir,
    });

    assert.equal(report.strictMode, true);
    assert.equal(report.ok, true, 'base ok should remain backward-compatible');
    assert.equal(report.effectiveOk, false, 'strict gate should fail when warnings exist');
    assert.equal(typeof report.outputDir, 'string');
    assert.equal(report.reportFiles.includes('repo-state-validator-report.json'), true);
    assert.equal(report.reportFiles.includes('rule-validator-report.json'), true);
    assert.equal(report.reportFiles.includes('skill-validator-report.json'), true);
    assert.equal(report.reportFiles.includes('validator-gate-summary.json'), true);

    const summary = JSON.parse(await fsp.readFile(path.join(outDir, 'validator-gate-summary.json'), 'utf-8'));
    assert.equal(summary.strictMode, true);
    assert.equal(summary.scope, 'all');
    assert.equal(summary.effectiveOk, false);

    const ruleReport = JSON.parse(await fsp.readFile(path.join(outDir, 'rule-validator-report.json'), 'utf-8'));
    assert.equal(ruleReport.strictMode, true);
    assert.equal(ruleReport.effectiveOk, false);

    const skillReport = JSON.parse(await fsp.readFile(path.join(outDir, 'skill-validator-report.json'), 'utf-8'));
    assert.equal(skillReport.strictMode, true);
    assert.equal(skillReport.effectiveOk, false);

    const repoStateReport = JSON.parse(await fsp.readFile(path.join(outDir, 'repo-state-validator-report.json'), 'utf-8'));
    assert.equal(repoStateReport.strictMode, true);
    assert.equal(repoStateReport.effectiveOk, true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testValidatorGateWritesHistoryForStandardReportDir() {
  assertBuiltArtifactExists(validatorGateDistPath, 'npm run build:scripts');
  const { runValidatorGate } = require(validatorGateDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-validator-gate-history-'));
  const previousCwd = process.cwd();
  try {
    process.chdir(tempDir);
    const rulesDir = path.join(tempDir, 'rules');
    const outDir = path.join(tempDir, '.codebuddy', 'reports', 'validators', 'latest');

    await fsp.mkdir(path.join(rulesDir, 'layer1'), { recursive: true });
    await fsp.writeFile(
      path.join(rulesDir, 'layer1', 'missing-tags.md'),
      [
        '# Missing tags',
        '',
        '## Context',
        '',
        'Rule fixture.',
        '',
        '## The Rule',
        '',
        'Do the thing.',
        '',
        '## Reasoning',
        '',
        'Consistency matters.',
        '',
        '## Examples',
        '',
        '```ts',
        'export const demo = true;',
        '```',
      ].join('\n'),
      'utf-8',
    );

    const report = runValidatorGate({
      scope: 'rules',
      strict: true,
      json: false,
      outDir,
      rulesDir,
      skillsDir: null,
    });

    assert.equal(typeof report.historyDir, 'string');
    assert.equal(report.historyDir.startsWith('.codebuddy/reports/validators/history/'), true);

    const latestSummary = JSON.parse(
      await fsp.readFile(path.join(outDir, 'validator-gate-summary.json'), 'utf-8'),
    );
    assert.equal(latestSummary.historyDir, report.historyDir);

    const historySummaryPath = path.join(tempDir, report.historyDir, 'validator-gate-summary.json');
    const historyRuleReportPath = path.join(tempDir, report.historyDir, 'rule-validator-report.json');
    assert.equal(fs.existsSync(historySummaryPath), true);
    assert.equal(fs.existsSync(historyRuleReportPath), true);
  } finally {
    process.chdir(previousCwd);
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testValidatorGateSkipsRepoStateOutsideRepositoryRoots() {
  assertBuiltArtifactExists(validatorGateDistPath, 'npm run build:scripts');
  const { runValidatorGate } = require(validatorGateDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-validator-gate-skip-repo-'));
  const previousCwd = process.cwd();
  try {
    process.chdir(tempDir);
    const rulesDir = path.join(tempDir, 'rules');
    const skillsDir = path.join(tempDir, 'custom-skills');
    const skillDir = path.join(skillsDir, 'demo-skill');

    await fsp.mkdir(path.join(rulesDir, 'layer1'), { recursive: true });
    await fsp.mkdir(skillDir, { recursive: true });
    await fsp.writeFile(
      path.join(rulesDir, 'layer1', 'ok.md'),
      [
        '> Tags: quality',
        '> Priority: Medium',
        '',
        '# Demo rule',
        '',
        '## Context',
        '',
        'Fixture.',
        '',
        '## The Rule',
        '',
        'Do the thing.',
        '',
        '## Reasoning',
        '',
        'Because consistency matters.',
        '',
        '## Examples',
        '',
        '```ts',
        'export const demo = true;',
        '```',
      ].join('\n'),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: demo-skill',
        'description: fixture skill',
        '---',
        '',
        '# Demo Skill',
      ].join('\n'),
      'utf-8',
    );

    const report = runValidatorGate({
      scope: 'all',
      strict: false,
      json: false,
      outDir: null,
      rulesDir,
      skillsDir,
      repoRoot: null,
    });

    assert.equal(report.ok, true);
    assert.equal(report.effectiveOk, true);
    assert.equal(report.reports.repoState, undefined);
  } finally {
    process.chdir(previousCwd);
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testReportManagerReadsLatestValidatorGateSummary() {
  assertBuiltArtifactExists(reportManagerDistPath, 'npm run build:scripts');
  const { readLatestValidatorGateReport, readValidatorGateHistory, buildStatusSnapshot } = require(reportManagerDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-report-manager-'));
  try {
    const generatedAt = new Date().toISOString();
    const reportsDir = path.join(tempDir, '.codebuddy', 'reports', 'validators', 'latest');
    const historyRoot = path.join(tempDir, '.codebuddy', 'reports', 'validators', 'history');
    await fsp.mkdir(reportsDir, { recursive: true });
    await fsp.mkdir(path.join(historyRoot, '2026-03-17T10-00-00-000Z'), { recursive: true });
    await fsp.mkdir(path.join(historyRoot, '2026-03-17T09-00-00-000Z'), { recursive: true });
    await fsp.writeFile(
      path.join(reportsDir, 'validator-gate-summary.json'),
      JSON.stringify({
        ok: true,
        effectiveOk: false,
        strictMode: true,
        scope: 'all',
        generatedAt,
        errorCount: 0,
        warningCount: 2,
        issueCount: 2,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {
          rules: { ok: true, effectiveOk: false, strictMode: true, errorCount: 0, warningCount: 1, issueCount: 1 },
        },
      }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(historyRoot, '2026-03-17T10-00-00-000Z', 'validator-gate-summary.json'),
      JSON.stringify({
        ok: true,
        effectiveOk: false,
        strictMode: true,
        scope: 'all',
        generatedAt,
        errorCount: 0,
        warningCount: 2,
        issueCount: 2,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(historyRoot, '2026-03-17T09-00-00-000Z', 'validator-gate-summary.json'),
      JSON.stringify({
        ok: true,
        effectiveOk: true,
        strictMode: false,
        scope: 'rules',
        generatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        errorCount: 0,
        warningCount: 0,
        issueCount: 0,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-03-17T09-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2),
      'utf-8',
    );

    const summary = readLatestValidatorGateReport(tempDir);
    assert.equal(summary?.strictMode, true);
    assert.equal(summary?.scope, 'all');
    assert.equal(summary?.effectiveOk, false);
    assert.equal(summary?.warningCount, 2);
    assert.equal(summary?.historyDir, '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z');

    const history = readValidatorGateHistory(tempDir);
    assert.equal(history.length, 2);
    assert.equal(history[0].relativePath, 'validators/history/2026-03-17T10-00-00-000Z/validator-gate-summary.json');

    const snapshot = buildStatusSnapshot(tempDir);
    assert.equal(snapshot.sections.validatorGate.present, true);
    assert.equal(snapshot.sections.validatorGate.scope, 'all');
    assert.equal(snapshot.sections.validatorGate.effectiveOk, false);
    assert.equal(snapshot.sections.validatorGate.warningCount, 2);
    assert.equal(snapshot.sections.validatorGate.historyDir, '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z');
    assert.equal(snapshot.sections.validatorGate.historyCount, 2);
    assert.equal(snapshot.sections.validatorGate.previousRun?.scope, 'rules');
    assert.equal(snapshot.sections.validatorGate.previousRun?.strictMode, false);
    assert.equal(snapshot.sections.validatorGate.delta?.direction, 'regressed');
    assert.equal(snapshot.sections.validatorGate.delta?.warningDelta, 2);
    assert.equal(snapshot.sections.validatorGate.delta?.issueDelta, 2);
    assert.equal(snapshot.sections.validatorGate.recentHistory.length, 2);
    assert.equal(snapshot.sections.workflowRouting.present, false);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testReportManagerReadsLatestAuditSummary() {
  assertBuiltArtifactExists(reportManagerDistPath, 'npm run build:scripts');
  const { readLatestAuditReport, readAuditHistory, buildStatusSnapshot } = require(reportManagerDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-report-manager-audit-'));
  try {
    const latestDir = path.join(tempDir, '.codebuddy', 'reports', 'audit', 'latest');
    const historyRoot = path.join(tempDir, '.codebuddy', 'reports', 'audit', 'history');
    await fsp.mkdir(latestDir, { recursive: true });
    await fsp.mkdir(path.join(historyRoot, '2026-03-17T10-00-00-000Z'), { recursive: true });
    await fsp.mkdir(path.join(historyRoot, '2026-03-17T09-00-00-000Z'), { recursive: true });

    const latestSummary = {
      generatedAt: '2026-03-17T10:00:00.000Z',
      targetDir: tempDir,
      reportsPath: path.join(tempDir, '.codebuddy', 'reports'),
      input: { days: 30, fromDate: null },
      overview: {
        overallStatus: 'warn',
        architectureFreshness: 'fresh',
        modulesFreshness: 'fresh',
        workflowId: 'micro',
        workflowMode: 'auto',
        validatorStatus: 'warn',
        validatorDirection: 'regressed',
        healthDirection: null,
        diffAvailable: true,
        findingsCount: 2,
      },
      outputDir: '.codebuddy/reports/audit/latest',
      historyDir: '.codebuddy/reports/audit/history/2026-03-17T10-00-00-000Z',
      reportFiles: ['audit-summary.json'],
      findings: [
        { id: 'validator-gate', status: 'warn', message: 'Validator gate needs attention.' },
      ],
      markdown: {
        path: path.join(tempDir, '.codebuddy', 'reports', 'export.md'),
        generatedAt: '2026-03-17T10:00:00.000Z',
      },
      sections: {
        status: { generatedAt: '2026-03-17T10:00:00.000Z', targetDir: tempDir, reportsPath: path.join(tempDir, '.codebuddy', 'reports'), manifest: { projectName: 'demo', lastUpdated: '2026-03-17T09:00:00.000Z' }, sections: { architecture: { present: false, generatedAt: null, ageHours: null, ageLabel: null, freshness: 'missing' }, modules: { present: false, generatedAt: null, ageHours: null, ageLabel: null, freshness: 'missing' }, health: { present: false, generatedAt: null, ageHours: null, ageLabel: null, freshness: 'missing', trackedDays: 0 }, tasks: { present: false }, workflowRouting: { present: false, generatedAt: null, ageHours: null, ageLabel: null, workflowId: null, mode: null, confidence: null, taskBookId: null }, validatorGate: { present: false, generatedAt: null, ageHours: null, ageLabel: null, freshness: 'missing', scope: null, strictMode: null, effectiveOk: null, errorCount: null, warningCount: null, issueCount: null, outputDir: null, historyDir: null, historyCount: 0, reportFiles: [], previousRun: null, delta: null, recentHistory: [] }, audit: { present: false, generatedAt: null, ageHours: null, ageLabel: null, freshness: 'missing', overallStatus: null, findingsCount: 0, outputDir: null, historyDir: null, historyCount: 0, recentHistory: [] } } },
        history: { generatedAt: '2026-03-17T10:00:00.000Z', targetDir: tempDir, reportsPath: path.join(tempDir, '.codebuddy', 'reports'), sections: { architecture: [], modules: [], validatorGate: [], audit: [] } },
        trend: { generatedAt: '2026-03-17T10:00:00.000Z', targetDir: tempDir, reportsPath: path.join(tempDir, '.codebuddy', 'reports'), sections: { health: { present: false, days: 30, direction: null, changeRate: null, prediction: null, recentPoints: [] }, validatorGate: { present: false, latest: null, previousRun: null, delta: null, recentRuns: [], passCount: 0, failCount: 0 } } },
        diff: { generatedAt: '2026-03-17T10:00:00.000Z', targetDir: tempDir, reportsPath: path.join(tempDir, '.codebuddy', 'reports'), input: { fromDate: null }, sections: { architecture: { present: false, olderPath: null, latestPath: null, diff: null }, modules: { present: false, olderPath: null, latestPath: null, diff: null } } },
      },
    };

    const previousSummary = {
      ...latestSummary,
      generatedAt: '2026-03-17T09:00:00.000Z',
      overview: {
        ...latestSummary.overview,
        overallStatus: 'pass',
        findingsCount: 0,
        validatorStatus: 'pass',
        validatorDirection: 'stable',
      },
      historyDir: '.codebuddy/reports/audit/history/2026-03-17T09-00-00-000Z',
      findings: [],
    };

    await fsp.writeFile(path.join(latestDir, 'audit-summary.json'), JSON.stringify(latestSummary, null, 2), 'utf-8');
    await fsp.writeFile(path.join(historyRoot, '2026-03-17T10-00-00-000Z', 'audit-summary.json'), JSON.stringify(latestSummary, null, 2), 'utf-8');
    await fsp.writeFile(path.join(historyRoot, '2026-03-17T09-00-00-000Z', 'audit-summary.json'), JSON.stringify(previousSummary, null, 2), 'utf-8');

    const summary = readLatestAuditReport(tempDir);
    assert.equal(summary?.overview?.overallStatus, 'warn');
    assert.equal(summary?.outputDir, '.codebuddy/reports/audit/latest');

    const history = readAuditHistory(tempDir);
    assert.equal(history.length, 2);
    assert.equal(history[0].relativePath, 'audit/history/2026-03-17T10-00-00-000Z/audit-summary.json');

    const snapshot = buildStatusSnapshot(tempDir);
    assert.equal(snapshot.sections.audit.present, true);
    assert.equal(snapshot.sections.audit.overallStatus, 'warn');
    assert.equal(snapshot.sections.audit.outputDir, '.codebuddy/reports/audit/latest');
    assert.equal(snapshot.sections.audit.historyCount, 2);
    assert.equal(snapshot.sections.audit.recentHistory.length, 2);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testReportManagerCleanupPrunesOldValidatorGateHistory() {
  assertBuiltArtifactExists(reportManagerDistPath, 'npm run build:scripts');
  const { cleanupReports } = require(reportManagerDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-report-cleanup-'));
  try {
    const historyRoot = path.join(tempDir, '.codebuddy', 'reports', 'validators', 'history');
    const oldDir = path.join(historyRoot, '2026-01-01T00-00-00-000Z');
    const recentDir = path.join(historyRoot, '2026-03-17T10-00-00-000Z');
    const auditHistoryRoot = path.join(tempDir, '.codebuddy', 'reports', 'audit', 'history');
    const oldAuditDir = path.join(auditHistoryRoot, '2026-01-01T00-00-00-000Z');
    const recentAuditDir = path.join(auditHistoryRoot, '2026-03-17T10-00-00-000Z');
    await fsp.mkdir(oldDir, { recursive: true });
    await fsp.mkdir(recentDir, { recursive: true });
    await fsp.mkdir(oldAuditDir, { recursive: true });
    await fsp.mkdir(recentAuditDir, { recursive: true });

    await fsp.writeFile(
      path.join(oldDir, 'validator-gate-summary.json'),
      JSON.stringify({
        ok: true,
        effectiveOk: true,
        strictMode: false,
        scope: 'rules',
        generatedAt: new Date(Date.now() - (60 * 24 * 60 * 60 * 1000)).toISOString(),
        errorCount: 0,
        warningCount: 0,
        issueCount: 0,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-01-01T00-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(recentDir, 'validator-gate-summary.json'),
      JSON.stringify({
        ok: true,
        effectiveOk: true,
        strictMode: false,
        scope: 'rules',
        generatedAt: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString(),
        errorCount: 0,
        warningCount: 0,
        issueCount: 0,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(oldAuditDir, 'audit-summary.json'),
      JSON.stringify({
        generatedAt: new Date(Date.now() - (60 * 24 * 60 * 60 * 1000)).toISOString(),
        targetDir: tempDir,
        reportsPath: path.join(tempDir, '.codebuddy', 'reports'),
        input: { days: 30, fromDate: null },
        overview: {
          overallStatus: 'warn',
          architectureFreshness: 'missing',
          modulesFreshness: 'missing',
          workflowId: null,
          workflowMode: null,
          validatorStatus: 'warn',
          validatorDirection: null,
          healthDirection: null,
          diffAvailable: false,
          findingsCount: 3,
        },
        outputDir: '.codebuddy/reports/audit/latest',
        historyDir: '.codebuddy/reports/audit/history/2026-01-01T00-00-00-000Z',
        reportFiles: ['audit-summary.json'],
        findings: [],
        markdown: { path: path.join(tempDir, '.codebuddy', 'reports', 'export.md'), generatedAt: new Date().toISOString() },
        sections: { status: {}, history: {}, trend: {}, diff: {} },
      }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(recentAuditDir, 'audit-summary.json'),
      JSON.stringify({
        generatedAt: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString(),
        targetDir: tempDir,
        reportsPath: path.join(tempDir, '.codebuddy', 'reports'),
        input: { days: 30, fromDate: null },
        overview: {
          overallStatus: 'pass',
          architectureFreshness: 'fresh',
          modulesFreshness: 'fresh',
          workflowId: null,
          workflowMode: null,
          validatorStatus: 'pass',
          validatorDirection: 'stable',
          healthDirection: null,
          diffAvailable: true,
          findingsCount: 0,
        },
        outputDir: '.codebuddy/reports/audit/latest',
        historyDir: '.codebuddy/reports/audit/history/2026-03-17T10-00-00-000Z',
        reportFiles: ['audit-summary.json'],
        findings: [],
        markdown: { path: path.join(tempDir, '.codebuddy', 'reports', 'export.md'), generatedAt: new Date().toISOString() },
        sections: { status: {}, history: {}, trend: {}, diff: {} },
      }, null, 2),
      'utf-8',
    );

    cleanupReports(tempDir, false);

    assert.equal(fs.existsSync(oldDir), false);
    assert.equal(fs.existsSync(recentDir), true);
    assert.equal(fs.existsSync(oldAuditDir), false);
    assert.equal(fs.existsSync(recentAuditDir), true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testReportManagerHistorySnapshotIncludesValidatorRuns() {
  assertBuiltArtifactExists(reportManagerDistPath, 'npm run build:scripts');
  const { buildHistorySnapshot } = require(reportManagerDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-report-history-'));
  try {
    const reportsRoot = path.join(tempDir, '.codebuddy', 'reports');
    await fsp.mkdir(path.join(reportsRoot, 'architecture'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'modules'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'validators', 'history', '2026-03-17T10-00-00-000Z'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'audit', 'history', '2026-03-17T10-00-00-000Z'), { recursive: true });

    await fsp.writeFile(
      path.join(reportsRoot, 'architecture', '2026-03-17T10-00-00.json'),
      JSON.stringify({ meta: { analyzedAt: '2026-03-17T10:00:00.000Z' } }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(reportsRoot, 'modules', '2026-03-17T10-00-00.json'),
      JSON.stringify({ meta: { analyzedAt: '2026-03-17T10:00:00.000Z' } }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(reportsRoot, 'validators', 'history', '2026-03-17T10-00-00-000Z', 'validator-gate-summary.json'),
      JSON.stringify({
        ok: true,
        effectiveOk: false,
        strictMode: true,
        scope: 'all',
        generatedAt: '2026-03-17T10:00:00.000Z',
        errorCount: 0,
        warningCount: 2,
        issueCount: 2,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(reportsRoot, 'audit', 'history', '2026-03-17T10-00-00-000Z', 'audit-summary.json'),
      JSON.stringify({
        generatedAt: '2026-03-17T10:00:00.000Z',
        targetDir: tempDir,
        reportsPath: path.join(tempDir, '.codebuddy', 'reports'),
        input: { days: 30, fromDate: null },
        overview: {
          overallStatus: 'warn',
          architectureFreshness: 'missing',
          modulesFreshness: 'missing',
          workflowId: null,
          workflowMode: null,
          validatorStatus: 'warn',
          validatorDirection: 'regressed',
          healthDirection: null,
          diffAvailable: false,
          findingsCount: 3,
        },
        outputDir: '.codebuddy/reports/audit/latest',
        historyDir: '.codebuddy/reports/audit/history/2026-03-17T10-00-00-000Z',
        reportFiles: ['audit-summary.json'],
        findings: [],
        markdown: { path: path.join(tempDir, '.codebuddy', 'reports', 'export.md'), generatedAt: '2026-03-17T10:00:00.000Z' },
        sections: { status: {}, history: {}, trend: {}, diff: {} },
      }, null, 2),
      'utf-8',
    );

    const snapshot = buildHistorySnapshot(tempDir);
    assert.equal(snapshot.sections.architecture.length, 1);
    assert.equal(snapshot.sections.modules.length, 1);
    assert.equal(snapshot.sections.validatorGate.length, 1);
    assert.equal(snapshot.sections.audit.length, 1);
    assert.equal(snapshot.sections.validatorGate[0].scope, 'all');
    assert.equal(snapshot.sections.validatorGate[0].strictMode, true);
    assert.equal(snapshot.sections.audit[0].overallStatus, 'warn');
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testReportManagerTrendSnapshotIncludesValidatorTrend() {
  assertBuiltArtifactExists(reportManagerDistPath, 'npm run build:scripts');
  const { buildTrendSnapshot } = require(reportManagerDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-report-trend-'));
  try {
    const reportsRoot = path.join(tempDir, '.codebuddy', 'reports');
    const historyRoot = path.join(reportsRoot, 'validators', 'history');
    await fsp.mkdir(path.join(reportsRoot, 'health'), { recursive: true });
    await fsp.mkdir(path.join(historyRoot, '2026-03-17T10-00-00-000Z'), { recursive: true });
    await fsp.mkdir(path.join(historyRoot, '2026-03-17T09-00-00-000Z'), { recursive: true });

    await fsp.writeFile(
      path.join(reportsRoot, 'health', 'timeline.json'),
      JSON.stringify({
        meta: { version: '1.0.0', projectName: 'demo', lastUpdated: '2026-03-17T10:00:00.000Z' },
        dataPoints: [
          { date: '2026-03-16', healthScore: 70, breakdown: { architecture: 70, modules: 70, codeQuality: 70 }, snapshot: 'a' },
          { date: '2026-03-17', healthScore: 78, breakdown: { architecture: 78, modules: 78, codeQuality: 78 }, snapshot: 'b' },
        ],
        trends: { direction: 'improving', changeRate: 11.4, prediction: 82 },
      }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(historyRoot, '2026-03-17T10-00-00-000Z', 'validator-gate-summary.json'),
      JSON.stringify({
        ok: true,
        effectiveOk: false,
        strictMode: true,
        scope: 'all',
        generatedAt: '2026-03-17T10:00:00.000Z',
        errorCount: 0,
        warningCount: 2,
        issueCount: 2,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2),
      'utf-8',
    );
    await fsp.writeFile(
      path.join(historyRoot, '2026-03-17T09-00-00-000Z', 'validator-gate-summary.json'),
      JSON.stringify({
        ok: true,
        effectiveOk: true,
        strictMode: true,
        scope: 'all',
        generatedAt: '2026-03-17T09:00:00.000Z',
        errorCount: 0,
        warningCount: 0,
        issueCount: 0,
        outputDir: '.codebuddy/reports/validators/latest',
        historyDir: '.codebuddy/reports/validators/history/2026-03-17T09-00-00-000Z',
        reportFiles: ['validator-gate-summary.json'],
        reports: {},
      }, null, 2),
      'utf-8',
    );

    const snapshot = buildTrendSnapshot(tempDir, 7);
    assert.equal(snapshot.sections.health.present, true);
    assert.equal(snapshot.sections.health.direction, 'improving');
    assert.equal(snapshot.sections.health.recentPoints.length, 2);
    assert.equal(snapshot.sections.validatorGate.present, true);
    assert.equal(snapshot.sections.validatorGate.latest?.strictMode, true);
    assert.equal(snapshot.sections.validatorGate.delta?.direction, 'regressed');
    assert.equal(snapshot.sections.validatorGate.delta?.warningDelta, 2);
    assert.equal(snapshot.sections.validatorGate.failCount, 1);
    assert.equal(snapshot.sections.validatorGate.passCount, 1);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testReportManagerDiffSnapshotIncludesModuleDiff() {
  assertBuiltArtifactExists(reportManagerDistPath, 'npm run build:scripts');
  const { buildDiffSnapshot } = require(reportManagerDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-report-diff-'));
  try {
    const reportsRoot = path.join(tempDir, '.codebuddy', 'reports');
    await fsp.mkdir(path.join(reportsRoot, 'architecture'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'modules'), { recursive: true });

    const olderArchitecture = {
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-16T09:00:00.000Z', analyzedBy: 'structure-analyzer' },
      summary: { healthScore: 70, totalFiles: 10, totalLines: 1000, issueCount: { error: 0, warning: 1, info: 0 } },
      structure: { type: 'feature-based', depth: 3, directories: 5 },
      violations: [{ rule: 'demo-rule', severity: 'warning', path: 'src/a.ts', message: 'older issue' }],
      scores: { featureStructure: 20, directoryDepth: 18, fileSize: 16, namingConvention: 16 },
    };
    const latestArchitecture = {
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-17T09:00:00.000Z', analyzedBy: 'structure-analyzer' },
      summary: { healthScore: 75, totalFiles: 12, totalLines: 1200, issueCount: { error: 0, warning: 1, info: 0 } },
      structure: { type: 'feature-based', depth: 3, directories: 6 },
      violations: [{ rule: 'demo-rule', severity: 'warning', path: 'src/b.ts', message: 'new issue' }],
      scores: { featureStructure: 22, directoryDepth: 18, fileSize: 17, namingConvention: 18 },
    };

    const olderModules = {
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-16T09:00:00.000Z', analyzedBy: 'module-mapper' },
      summary: { totalModules: 1, avgHealthScore: 70, circularDeps: 0, isolatedModules: 0 },
      categories: { feature: { modules: ['user'], totalFiles: 2, totalLines: 120 } },
      modules: [
        {
          name: 'user',
          chineseName: '用户',
          category: 'feature',
          type: 'feature',
          path: 'src/user',
          stats: { files: 2, lines: 120, components: 1 },
          healthScore: 70,
          subModules: [],
          dependencies: [],
          dependents: [],
        },
      ],
      graph: { nodes: ['user'], edges: [] },
    };
    const latestModules = {
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-17T09:00:00.000Z', analyzedBy: 'module-mapper' },
      summary: { totalModules: 2, avgHealthScore: 78, circularDeps: 0, isolatedModules: 0 },
      categories: { feature: { modules: ['user', 'admin'], totalFiles: 4, totalLines: 260 } },
      modules: [
        {
          name: 'user',
          chineseName: '用户',
          category: 'feature',
          type: 'feature',
          path: 'src/user',
          stats: { files: 3, lines: 220, components: 2 },
          healthScore: 82,
          subModules: [],
          dependencies: [],
          dependents: [],
        },
        {
          name: 'admin',
          chineseName: '管理',
          category: 'feature',
          type: 'feature',
          path: 'src/admin',
          stats: { files: 1, lines: 40, components: 1 },
          healthScore: 74,
          subModules: [],
          dependencies: [],
          dependents: [],
        },
      ],
      graph: { nodes: ['user', 'admin'], edges: [] },
    };

    await fsp.writeFile(path.join(reportsRoot, 'architecture', 'latest.json'), JSON.stringify(latestArchitecture, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'architecture', '2026-03-16T09-00-00.json'), JSON.stringify(olderArchitecture, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'modules', 'latest.json'), JSON.stringify(latestModules, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'modules', '2026-03-16T09-00-00.json'), JSON.stringify(olderModules, null, 2), 'utf-8');

    const snapshot = buildDiffSnapshot(tempDir);
    assert.equal(snapshot.sections.architecture.present, true);
    assert.equal(snapshot.sections.architecture.diff?.healthChange, 5);
    assert.equal(snapshot.sections.architecture.diff?.newViolations.length, 1);
    assert.equal(snapshot.sections.modules.present, true);
    assert.equal(snapshot.sections.modules.diff?.added.includes('admin'), true);
    assert.equal(snapshot.sections.modules.diff?.changed.some((entry) => entry.name === 'user'), true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testReportManagerExportSnapshotBundlesMachineReadableSections() {
  assertBuiltArtifactExists(reportManagerDistPath, 'npm run build:scripts');
  const { buildExportSnapshot } = require(reportManagerDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-report-export-'));
  try {
    const reportsRoot = path.join(tempDir, '.codebuddy', 'reports');
    await fsp.mkdir(path.join(reportsRoot, 'architecture'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'modules'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'validators', 'latest'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'validators', 'history', '2026-03-17T10-00-00-000Z'), { recursive: true });

    await fsp.writeFile(path.join(reportsRoot, 'manifest.json'), JSON.stringify({
      version: '1.0.0',
      projectName: 'demo-project',
      lastUpdated: '2026-03-17T09:00:00.000Z',
      reports: { architecture: null, modules: null, health: null, tasks: null },
      settings: { retentionDays: 30, maxSnapshots: 10, autoCleanup: true },
    }, null, 2), 'utf-8');

    await fsp.writeFile(path.join(reportsRoot, 'architecture', 'latest.json'), JSON.stringify({
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-17T09:00:00.000Z', analyzedBy: 'structure-analyzer' },
      summary: { healthScore: 80, totalFiles: 12, totalLines: 1200, issueCount: { error: 0, warning: 1, info: 0 } },
      structure: { type: 'feature-based', depth: 3, directories: 6 },
      violations: [],
      scores: { featureStructure: 22, directoryDepth: 18, fileSize: 20, namingConvention: 20 },
    }, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'architecture', '2026-03-16T09-00-00.json'), JSON.stringify({
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-16T09:00:00.000Z', analyzedBy: 'structure-analyzer' },
      summary: { healthScore: 75, totalFiles: 11, totalLines: 1100, issueCount: { error: 0, warning: 1, info: 0 } },
      structure: { type: 'feature-based', depth: 3, directories: 5 },
      violations: [],
      scores: { featureStructure: 20, directoryDepth: 18, fileSize: 18, namingConvention: 19 },
    }, null, 2), 'utf-8');

    await fsp.writeFile(path.join(reportsRoot, 'modules', 'latest.json'), JSON.stringify({
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-17T09:00:00.000Z', analyzedBy: 'module-mapper' },
      summary: { totalModules: 1, avgHealthScore: 80, circularDeps: 0, isolatedModules: 0 },
      categories: { feature: { modules: ['user'], totalFiles: 3, totalLines: 220 } },
      modules: [{ name: 'user', chineseName: '用户', category: 'feature', type: 'feature', path: 'src/user', stats: { files: 3, lines: 220, components: 2 }, healthScore: 80, subModules: [], dependencies: [], dependents: [] }],
      graph: { nodes: ['user'], edges: [] },
    }, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'modules', '2026-03-16T09-00-00.json'), JSON.stringify({
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-16T09:00:00.000Z', analyzedBy: 'module-mapper' },
      summary: { totalModules: 1, avgHealthScore: 75, circularDeps: 0, isolatedModules: 0 },
      categories: { feature: { modules: ['user'], totalFiles: 2, totalLines: 120 } },
      modules: [{ name: 'user', chineseName: '用户', category: 'feature', type: 'feature', path: 'src/user', stats: { files: 2, lines: 120, components: 1 }, healthScore: 75, subModules: [], dependencies: [], dependents: [] }],
      graph: { nodes: ['user'], edges: [] },
    }, null, 2), 'utf-8');

    await fsp.writeFile(path.join(reportsRoot, 'validators', 'latest', 'validator-gate-summary.json'), JSON.stringify({
      ok: true,
      effectiveOk: true,
      strictMode: false,
      scope: 'all',
      generatedAt: '2026-03-17T10:00:00.000Z',
      errorCount: 0,
      warningCount: 1,
      issueCount: 1,
      outputDir: '.codebuddy/reports/validators/latest',
      reportFiles: ['validator-gate-summary.json'],
      reports: {},
    }, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'validators', 'history', '2026-03-17T10-00-00-000Z', 'validator-gate-summary.json'), JSON.stringify({
      ok: true,
      effectiveOk: true,
      strictMode: false,
      scope: 'all',
      generatedAt: '2026-03-17T10:00:00.000Z',
      errorCount: 0,
      warningCount: 1,
      issueCount: 1,
      outputDir: '.codebuddy/reports/validators/latest',
      historyDir: '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z',
      reportFiles: ['validator-gate-summary.json'],
      reports: {},
    }, null, 2), 'utf-8');

    const snapshot = buildExportSnapshot(tempDir, { days: 14, fromDate: '2026-03-16' });
    assert.equal(snapshot.input.days, 14);
    assert.equal(snapshot.input.fromDate, '2026-03-16');
    assert.equal(snapshot.sections.status.sections.validatorGate.present, true);
    assert.equal(snapshot.sections.history.sections.validatorGate.length, 1);
    assert.equal(snapshot.sections.trend.sections.validatorGate.present, true);
    assert.equal(snapshot.sections.diff.sections.architecture.present, true);
    assert.equal(fs.existsSync(snapshot.markdown.path), true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testReportManagerAuditSnapshotProvidesTopLevelVerdict() {
  assertBuiltArtifactExists(reportManagerDistPath, 'npm run build:scripts');
  const { buildAndPersistAuditSnapshot } = require(reportManagerDistPath);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'my-fe-standards-report-audit-'));
  try {
    const reportsRoot = path.join(tempDir, '.codebuddy', 'reports');
    await fsp.mkdir(path.join(reportsRoot, 'architecture'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'modules'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'validators', 'latest'), { recursive: true });
    await fsp.mkdir(path.join(reportsRoot, 'validators', 'history', '2026-03-17T10-00-00-000Z'), { recursive: true });

    await fsp.writeFile(path.join(reportsRoot, 'manifest.json'), JSON.stringify({
      version: '1.0.0',
      projectName: 'demo-project',
      lastUpdated: '2026-03-17T09:00:00.000Z',
      reports: {
        architecture: {
          type: 'architecture-snapshot',
          path: 'architecture/latest.json',
          generatedAt: new Date().toISOString(),
          generatedBy: 'structure-analyzer',
          hash: 'arch0001',
          size: 123,
        },
        modules: {
          type: 'module-map',
          path: 'modules/latest.json',
          generatedAt: new Date().toISOString(),
          generatedBy: 'module-mapper',
          hash: 'mods0001',
          size: 123,
        },
        health: null,
        tasks: null,
      },
      settings: { retentionDays: 30, maxSnapshots: 10, autoCleanup: true },
    }, null, 2), 'utf-8');

    await fsp.writeFile(path.join(reportsRoot, 'architecture', 'latest.json'), JSON.stringify({
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-17T09:00:00.000Z', analyzedBy: 'structure-analyzer' },
      summary: { healthScore: 80, totalFiles: 12, totalLines: 1200, issueCount: { error: 0, warning: 0, info: 0 } },
      structure: { type: 'feature-based', depth: 3, directories: 6 },
      violations: [],
      scores: { featureStructure: 22, directoryDepth: 18, fileSize: 20, namingConvention: 20 },
    }, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'architecture', '2026-03-16T09-00-00.json'), JSON.stringify({
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-16T09:00:00.000Z', analyzedBy: 'structure-analyzer' },
      summary: { healthScore: 75, totalFiles: 11, totalLines: 1100, issueCount: { error: 0, warning: 0, info: 0 } },
      structure: { type: 'feature-based', depth: 3, directories: 5 },
      violations: [],
      scores: { featureStructure: 20, directoryDepth: 18, fileSize: 18, namingConvention: 19 },
    }, null, 2), 'utf-8');

    await fsp.writeFile(path.join(reportsRoot, 'modules', 'latest.json'), JSON.stringify({
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-17T09:00:00.000Z', analyzedBy: 'module-mapper' },
      summary: { totalModules: 1, avgHealthScore: 80, circularDeps: 0, isolatedModules: 0 },
      categories: { feature: { modules: ['user'], totalFiles: 3, totalLines: 220 } },
      modules: [{ name: 'user', chineseName: '用户', category: 'feature', type: 'feature', path: 'src/user', stats: { files: 3, lines: 220, components: 2 }, healthScore: 80, subModules: [], dependencies: [], dependents: [] }],
      graph: { nodes: ['user'], edges: [] },
    }, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'modules', '2026-03-16T09-00-00.json'), JSON.stringify({
      meta: { version: '1.0.0', projectName: 'demo', analyzedAt: '2026-03-16T09:00:00.000Z', analyzedBy: 'module-mapper' },
      summary: { totalModules: 1, avgHealthScore: 75, circularDeps: 0, isolatedModules: 0 },
      categories: { feature: { modules: ['user'], totalFiles: 2, totalLines: 120 } },
      modules: [{ name: 'user', chineseName: '用户', category: 'feature', type: 'feature', path: 'src/user', stats: { files: 2, lines: 120, components: 1 }, healthScore: 75, subModules: [], dependencies: [], dependents: [] }],
      graph: { nodes: ['user'], edges: [] },
    }, null, 2), 'utf-8');

    await fsp.writeFile(path.join(reportsRoot, 'validators', 'latest', 'validator-gate-summary.json'), JSON.stringify({
      ok: true,
      effectiveOk: true,
      strictMode: false,
      scope: 'all',
      generatedAt: new Date().toISOString(),
      errorCount: 0,
      warningCount: 2,
      issueCount: 2,
      outputDir: '.codebuddy/reports/validators/latest',
      historyDir: '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z',
      reportFiles: ['validator-gate-summary.json'],
      reports: {},
    }, null, 2), 'utf-8');
    await fsp.writeFile(path.join(reportsRoot, 'validators', 'history', '2026-03-17T10-00-00-000Z', 'validator-gate-summary.json'), JSON.stringify({
      ok: true,
      effectiveOk: true,
      strictMode: false,
      scope: 'all',
      generatedAt: '2026-03-17T10:00:00.000Z',
      errorCount: 0,
      warningCount: 2,
      issueCount: 2,
      outputDir: '.codebuddy/reports/validators/latest',
      historyDir: '.codebuddy/reports/validators/history/2026-03-17T10-00-00-000Z',
      reportFiles: ['validator-gate-summary.json'],
      reports: {},
    }, null, 2), 'utf-8');

    const snapshot = buildAndPersistAuditSnapshot(tempDir, { days: 14, fromDate: '2026-03-16' });
    assert.equal(snapshot.input.days, 14);
    assert.equal(snapshot.input.fromDate, '2026-03-16');
    assert.equal(snapshot.overview.overallStatus, 'warn');
    assert.equal(snapshot.overview.validatorStatus, 'warn');
    assert.equal(snapshot.overview.diffAvailable, true);
    assert.equal(snapshot.outputDir, '.codebuddy/reports/audit/latest');
    assert.equal(typeof snapshot.historyDir, 'string');
    assert.equal(snapshot.reportFiles.includes('audit-summary.json'), true);
    assert.ok(snapshot.findings.some(finding => finding.id === 'validator-gate' && finding.status === 'warn'));
    assert.ok(snapshot.findings.some(finding => finding.id === 'workflow-routing' && finding.status === 'warn'));
    assert.equal(fs.existsSync(snapshot.markdown.path), true);
    assert.equal(fs.existsSync(path.join(tempDir, '.codebuddy', 'reports', 'audit', 'latest', 'audit-summary.json')), true);
    assert.equal(fs.existsSync(path.join(tempDir, snapshot.historyDir, 'audit-summary.json')), true);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testRunTestsCaseFiltering() {
  delete require.cache[require.resolve(runTestsPath)];
  const { TEST_CASES, parseCliOptions, selectLocalTestCases } = require(runTestsPath);

  const caseOnlyOptions = parseCliOptions(['--case', 'antdv']);
  assert.equal(caseOnlyOptions.listCases, false);
  assert.equal(caseOnlyOptions.suites.has('local'), true);
  assert.equal(caseOnlyOptions.suites.has('remote'), false);
  assert.deepEqual(caseOnlyOptions.caseFilters, ['antdv']);

  const singleMatch = selectLocalTestCases(['antdv']);
  assert.equal(singleMatch.length, 1);
  assert.equal(singleMatch[0].dir, 'antdv-project');

  const multiMatch = selectLocalTestCases(['vue2']);
  assert.deepEqual(
    multiMatch.map(testCase => testCase.dir).sort(),
    ['vue2-composition-project', 'vue2-project']
  );

  const listCasesOptions = parseCliOptions(['--list-cases']);
  assert.equal(listCasesOptions.listCases, true);
  assert.equal(Array.isArray(TEST_CASES), true);
  assert.ok(TEST_CASES.some(testCase => testCase.dir === 'antdv-project'));

  assert.throws(
    () => parseCliOptions(['--suite', 'remote', '--case', 'vue3']),
    /--case can only be used with the local suite/
  );
}

async function main() {
  const tests = [
    ['frontmatter utils parse and extract structured YAML content', testFrontmatterUtils],
    ['metadata parser normalizes skill and agent metadata', testMetadataParser],
    ['distribution profiles keep profile boundaries and runtime artifacts stable', testDistributionProfiles],
    ['workflow routing library selects micro/sprint/default with explicit and reuse precedence', testWorkflowRoutingLibrary],
    ['task intake router recommends direct vs orchestrated execution deterministically', testTaskIntakeRoutingLibrary],
    ['doctor surfaces architecture drift as warnings without changing install semantics', testDoctorArchitectureWarnings],
    ['doctor surfaces latest validator gate summary when present', testDoctorValidatorGateWarnings],
    ['doctor ignores known optional static support files', testDoctorIgnoresKnownOptionalStaticSupportFiles],
    ['doctor warns when validator gate regresses relative to previous run', testDoctorWarnsOnValidatorGateRegressionEvenWhenLatestPasses],
    ['contract validator architecture drift checks stay opt-in and additive', testContractValidatorArchitectureWarnings],
    ['rule validator warns when recommended metadata is missing', testRuleValidatorMetadataWarnings],
    ['skill validator warns on bundled files that are never linked from markdown', testSkillValidatorBundledReferenceWarnings],
    ['repo state validator warns on stale or weak repository fact sources', testRepoStateValidatorWarnsOnMissingLinksAndStaleFacts],
    ['validator gate writes strict summary and per-validator reports', testValidatorGateWritesStrictReports],
    ['validator gate writes history when using the standard report directory', testValidatorGateWritesHistoryForStandardReportDir],
    ['validator gate skips repo-state checks outside repository roots', testValidatorGateSkipsRepoStateOutsideRepositoryRoots],
    ['report manager reads the latest validator gate summary from reports', testReportManagerReadsLatestValidatorGateSummary],
    ['report manager reads the latest audit summary from standard reports', testReportManagerReadsLatestAuditSummary],
    ['report manager cleanup prunes old validator and audit history', testReportManagerCleanupPrunesOldValidatorGateHistory],
    ['report manager history snapshot includes validator and audit runs', testReportManagerHistorySnapshotIncludesValidatorRuns],
    ['report manager trend snapshot includes validator trend data', testReportManagerTrendSnapshotIncludesValidatorTrend],
    ['report manager diff snapshot includes architecture and module diffs', testReportManagerDiffSnapshotIncludesModuleDiff],
    ['report manager export snapshot bundles machine-readable sections', testReportManagerExportSnapshotBundlesMachineReadableSections],
    ['report manager audit snapshot provides a top-level verdict', testReportManagerAuditSnapshotProvidesTopLevelVerdict],
    ['run-tests CLI supports focused local case selection', testRunTestsCaseFiltering],
    ['context targeting keeps skill and business-rule matching stable', testContextTargeting],
    ['project detection recognizes workspace structure and target selection', testProjectDetection],
    ['install state helpers keep snapshot retention and hashing stable', testInstallStateHelpers],
    ['install roots prefer installed outputs and fall back predictably', testInstallRoots],
  ];

  let failed = 0;
  for (const [name, testFn] of tests) {
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
