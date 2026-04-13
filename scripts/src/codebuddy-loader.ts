#!/usr/bin/env node
/**
 * CodeBuddy 规则加载器 v3.3.0
 *
 * 专为 CodeBuddy (GLM-4.7) 优化的前端架构规则加载器
 *
 * 功能：
 * - 三层规则架构加载（Base/Business/Action）
 * - 远程/本地模式支持
 * - 技能索引生成（适配 CodeBuddy 工具调用）
 * - 任务类型筛选（渐进式披露）
 * - Git 私有仓库支持
 *
 * 用法：
 *   node codebuddy-loader.js [options]
 *
 * 选项：
 *   --help, -h        显示帮助信息
 *   --remote <URL>    从远程 URL 获取规则
 *   --task <type>     按任务类型筛选规则
 *   --verbose, -v     启用详细日志
 *   --timeout <ms>    设置网络请求超时（默认 10000ms）
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Context,
  Manifest,
  LoaderConfig,
  VueProfile,
  RuleContent,
  RuleIndexItem,
  SkillMetadata,
  SkillRole,
  AgentMetadata,
  PackageJson,
  SubProject,
  WorkspaceInfo,
  WorkspaceIndex,
  WorkspaceScope,
} from './types';
import { Logger, createLogger, logError } from './lib/logger';
import { fetchUrl } from './lib/fetcher';
import { distributeItems } from './lib/distributor';
import {
  AGENT_CALL_FILES_TO_DISTRIBUTE,
  COMMANDS_TO_DISTRIBUTE,
  TASKBOOK_FILES_TO_DISTRIBUTE,
  WORKFLOWS_TO_DISTRIBUTE,
  getScriptsForProfile,
  isDemoProfile,
  isOrchestratorProfile,
} from './lib/distribution-profiles';
import {
  acquireInstallLock,
  releaseInstallLock,
  ManagedFileTracker,
  cleanupStaleManagedFiles,
  copyManagedFile,
  createManagedFileTracker,
  getManagedFiles,
  listFilesRecursive,
  removeManagedPath,
  readInstallState,
  writeManagedFile,
} from './lib/install-sync';
import {
  buildDoctorChecks,
  formatDoctorReport,
  formatStatusReport,
  inspectInstallState,
  summarizeDoctorChecks,
} from './lib/install-health';
import {
  buildInstallState,
  computeDepsFingerprint,
  createInstallSnapshotId,
  gcSnapshotEntries,
  writeInstallState,
} from './lib/install-state';
import {
  checkVueProfile,
  createScopedWorkspaceInfo,
  detectProjectLangFromDir,
  detectProjectMetadata,
  discoverWorkspace,
  normalizeStackLabel,
} from './lib/project-detection';
import {
  collectMatchedBusinessRules,
  collectProjectFrameworkTags,
  collectSkillContextProjects,
  matchesSkillRole,
  matchesSkillStack,
  matchesSkillWorkspaceScope,
  shouldIncludeSkill,
} from './lib/context-targeting';
import { ensureRemoteContentPack, readRemoteAsset, readRemoteTextAsset } from './lib/remote-content-pack';
import { parseSkillMetadata, parseAgentMetadata } from './lib/metadata-parser';
import { runInit } from './lib/init-generator';
import {
  generateWorkflowsPrompt,
  generateTaskBooksPrompt,
  generateAgentCallsPrompt,
  generateCommandsReadme,
  generateCommandsPrompt,
  generateQuickActionGuide,
  generateScriptsReadme,
  generateScriptsPrompt,
  generateAgentsPrompt,
  generateSkillsPrompt,
  generateActivationRules,
  generateRuleActivationPrompt,
  generateWorkspacePrompt,
  generateDemoWelcomeBanner,
  generateUnifiedRoutingPrompt,
  generateDemoQuickActionGuide,
  generateDemoRuntimeSummary,
} from './lib/prompt-builder';

// ============ 配置常量 ============

const SCRIPT_DIR: string = __dirname;
const PROJECT_ROOT: string = path.resolve(SCRIPT_DIR, '../..');
const PACKAGE_JSON_PATH: string = path.join(PROJECT_ROOT, 'package.json');
const RULES_ROOT: string = path.join(PROJECT_ROOT, 'rules');
const CONFIG_PATH: string = path.join(PROJECT_ROOT, 'config', 'loader-config.json');
const SKILLS_ROOT: string = path.join(PROJECT_ROOT, 'custom-skills');
const AGENTS_ROOT: string = path.join(PROJECT_ROOT, 'agents');

const DEFAULT_TIMEOUT: number = 10000;
const DEFAULT_THRESHOLD: number = 0.5;
const DEFAULT_RULE_LEVEL: Context['ruleLevel'] = 'full';
const DEFAULT_PROFILE: Context['profile'] = 'analysis';
const SKILL_SNAPSHOT_RETAIN_COUNT = 3;
const AGENT_SNAPSHOT_RETAIN_COUNT = 3;
const DEMO_SKILL_LIMIT = 8;
const DEMO_AGENT_LIMIT = 6;
const COMMANDS = new Set(['install', 'status', 'doctor', 'init']);
const INSTALL_PROFILES: Context['profile'][] = ['core', 'analysis', 'orchestrator', 'full', 'demo'];
const WORKSPACE_SCOPES: WorkspaceScope[] = ['workspace-union', 'project-targeted'];
const SKILL_ROLES: SkillRole[] = ['frontend', 'backend', 'fullstack', 'qa', 'architect', 'product', 'devops'];
const DEMO_LOW_PRIORITY_SKILL_IDS = new Set([
  'prd',
  'ralph-converter',
  'skill-creator',
  'system-overview-design',
]);
const DEMO_AGENT_BASE_PRIORITY: Record<string, number> = {
  'code-reviewer': 24,
  'bug-investigator': 23,
  'build-fix': 22,
  'structure-analyzer': 21,
  'task-orchestrator': 20,
  'performance-profiler': 16,
  'planner': 13,
  'tdd-driver': 12,
  'security-reviewer': 9,
  'system-overview-writer': 4,
};

type LoaderCommand = 'install' | 'status' | 'doctor' | 'init';

interface InstallCliOptions {
  ifDepsChanged: boolean;
}

interface InitCliOptions {
  gitHooks: boolean;
  ci: boolean;
  scripts: boolean;
  force: boolean;
  dryRun: boolean;
}

interface ParsedCliArgs {
  command: LoaderCommand;
  ctx: Readonly<Context>;
  json: boolean;
  installOptions: InstallCliOptions;
  initOptions: InitCliOptions;
}

const LOADER_DISPLAY_VERSION = 'v3.3.0';

// ============ 帮助信息 ============

function showHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║     CodeBuddy 规则加载器 ${LOADER_DISPLAY_VERSION} - 三层架构 + 技能系统        ║
╚══════════════════════════════════════════════════════════════════╝

用法：
  node codebuddy-loader.js [command] [options]

产品路径：
  1. 安装 / 同步         node codebuddy-loader.js
  2. 诊断 / 状态查看     node codebuddy-loader.js status
  3. 诊断 / 问题排查     node codebuddy-loader.js doctor --json

命令：
  install              安装/同步 CodeBuddy 规则和运行时（默认）
  status               显示当前项目的 CodeBuddy 安装状态
  doctor               诊断当前项目的 CodeBuddy 安装问题
  init                 生成下游项目接入配置（CI / hooks / package scripts）

选项：
  --help, -h           显示帮助信息
  --json               status / doctor 输出 JSON
  --if-deps-changed    install 时仅在依赖指纹变化时继续执行
  --dry-run            init 时仅输出将生成的文件，不写入
  --force              init 时覆盖已有 workflow / scripts 配置
  --git-hooks          init 时仅生成 git hooks（若与 --ci/--scripts 同时缺省，则默认三者都生成）
  --ci                 init 时仅生成 GitHub Actions 模板
  --scripts            init 时仅注入 package.json scripts
  --remote <URL>       从远程 URL 获取规则
  --remote-bearer-token <token>
                       远程请求附带 Bearer Token（也支持环境变量 CODEBUDDY_REMOTE_BEARER_TOKEN）
  --pack-only          远程模式只允许使用 manifest.packs 内容包，不回退逐文件拉取
  --strict-pack-only   --pack-only 的兼容别名
  --task <type>        按任务类型筛选规则（渐进式披露）
                       类型: refactoring, debugging, testing, new-feature, code-review
  --threshold <n>      设置相关性阈值 (0-1, 默认: 0.5)
  --rule-level <lvl>   规则内容裁剪等级（基于 @level:summary/quick/full 分段标记，默认: full）
  --profile <name>     分发档位: core | analysis | orchestrator | full（默认: analysis）
  --enable-orchestrator 兼容旧参数，等价于旧版完整分发（即 --profile full）
  --no-workspace       禁用 workspace 多项目自动发现
  --workspace-scope <scope>
                       Workspace 分发范围: workspace-union | project-targeted（默认: workspace-union）
  --project <selector> project-targeted 模式下锁定目标项目（名称/路径/目录别名）
  --role <role>        按岗位过滤技能: frontend | backend | fullstack | qa | architect | product | devops
  --verbose, -v        启用详细日志
  --timeout <ms>       设置网络请求超时（默认: 10000ms）

任务类型：
  refactoring          代码重构、优化、技术债务清理
  debugging            Bug 修复、问题排查、错误处理
  testing              编写测试、测试策略、覆盖率
  new-feature          开发新功能、添加新特性
  code-review          代码审查、PR 审核

示例：
  # 加载所有规则（默认）
  node codebuddy-loader.js

  # 查看当前项目安装状态
  node codebuddy-loader.js status

  # 诊断安装问题（JSON 输出）
  node codebuddy-loader.js doctor --json

  # 仅在依赖变化时重新安装
  node codebuddy-loader.js install --if-deps-changed

  # 生成最小接入配置（预览）
  node codebuddy-loader.js init --dry-run

  # 生成最小接入配置
  node codebuddy-loader.js init

  # 仅加载重构相关规则
  node codebuddy-loader.js --task refactoring

  # 只安装最小运行时
  node codebuddy-loader.js --profile core

  # 安装完整运行时
  node codebuddy-loader.js --profile full

  # Workspace 共享安装
  node codebuddy-loader.js --workspace-scope workspace-union

  # Workspace 锁定某个子项目
  node codebuddy-loader.js --workspace-scope project-targeted --project packages/api

  # 仅安装后端岗位相关技能
  node codebuddy-loader.js --role backend

  # 从远程加载
  node codebuddy-loader.js --remote https://example.com/standards

  # 从受保护远程源加载并强制使用内容包
  node codebuddy-loader.js --remote https://example.com/standards --pack-only --remote-bearer-token YOUR_TOKEN

输出：
  在当前工作目录生成 .codebuddy/rules/project-rules.md
`);
  process.exit(0);
}

// ============ 配置加载 ============

async function loadConfig(ctx: Readonly<Context>, logger: Logger): Promise<{ config: LoaderConfig; manifest: Manifest | null }> {
  if (ctx.isRemote) {
    try {
      const manifestUrl = `${ctx.remoteBaseUrl}/manifest.json`;
      logger.log(`正在从远程加载配置: ${manifestUrl}`);
      const data = await fetchUrl(ctx, logger, manifestUrl);
      const manifest = JSON.parse(data) as Manifest;
      logger.verbose(`Manifest 加载成功. Version: ${manifest.version}`);
      return { config: manifest.config as LoaderConfig, manifest };
    } catch (e) {
      logger.error(`远程 manifest 加载失败: ${(e as Error).message}`);
      process.exit(1);
    }
  } else {
    if (!fs.existsSync(CONFIG_PATH)) {
      logger.error(`配置文件不存在: ${CONFIG_PATH}`);
      process.exit(1);
    }
    logger.verbose(`加载本地配置: ${CONFIG_PATH}`);
    return { config: JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as LoaderConfig, manifest: null };
  }
}

// ============ 项目依赖检测 ============

function getPackageJson(logger: Logger, targetDir: string): PackageJson {
  const pkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    logger.warn(`未找到 package.json: ${pkgPath}`);
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageJson;
  } catch (e) {
    logger.error(`解析 package.json 失败: ${(e as Error).message}`);
    return {};
  }
}

function getLoaderVersion(ctx: Readonly<Context>, logger: Logger): string {
  if (ctx.remoteManifest?.version) {
    return ctx.remoteManifest.version;
  }

  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    logger.warn(`未找到 loader package.json: ${PACKAGE_JSON_PATH}`);
    return '0.0.0';
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as PackageJson;
    return pkg.version || '0.0.0';
  } catch (error) {
    logger.warn(`读取 loader package.json 失败: ${(error as Error).message}`);
    return '0.0.0';
  }
}

function getLoaderPackageName(logger: Logger): string {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    logger.warn(`未找到 loader package.json: ${PACKAGE_JSON_PATH}`);
    return 'my-fe-standards';
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as PackageJson;
    return pkg.name || 'my-fe-standards';
  } catch (error) {
    logger.warn(`读取 loader package.json 失败: ${(error as Error).message}`);
    return 'my-fe-standards';
  }
}

// ============ 规则加载 ============

async function loadRuleFile(ctx: Readonly<Context>, logger: Logger, layerId: string, filePath: string): Promise<string> {
  if (ctx.isRemote) {
    try {
      return await readRemoteTextAsset(ctx, logger, `rules/${layerId}/${filePath}`);
    } catch (e) {
      logger.warn(`远程规则加载失败: ${filePath}`);
      return '';
    }
  } else {
    const fullPath = path.join(RULES_ROOT, layerId, filePath);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf-8');
    }
    return '';
  }
}

async function loadLayerRules(ctx: Readonly<Context>, logger: Logger, layerId: string, folders: string[]): Promise<RuleContent[]> {
  const contents: RuleContent[] = [];

  for (const folder of folders) {
    if (ctx.isRemote) {
      // 远程模式：从 manifest 查找文件
      const matchingFiles = ctx.remoteManifest!.files.filter(
        f => f.path.startsWith(`rules/${layerId}/${folder}`) && f.path.endsWith('.md')
      );
      for (const file of matchingFiles) {
        const relativePath = file.path.replace(`rules/${layerId}/`, '');
        const content = await loadRuleFile(ctx, logger, layerId, relativePath);
        if (content) {
          contents.push({ path: relativePath, content: filterRuleByLevel(content, ctx.ruleLevel) });
        }
      }
    } else {
      // 本地模式
      const folderPath = path.join(RULES_ROOT, layerId, folder);
      if (fs.existsSync(folderPath)) {
        const stat = fs.statSync(folderPath);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
          for (const file of files) {
            const content = fs.readFileSync(path.join(folderPath, file), 'utf-8');
            contents.push({ path: `${folder}/${file}`, content: filterRuleByLevel(content, ctx.ruleLevel) });
          }
        } else if (folderPath.endsWith('.md')) {
          const content = fs.readFileSync(folderPath, 'utf-8');
          contents.push({ path: folder, content: filterRuleByLevel(content, ctx.ruleLevel) });
        }
      }
      // 尝试 .md 后缀
      const mdPath = path.join(RULES_ROOT, layerId, folder + '.md');
      if (fs.existsSync(mdPath)) {
        const content = fs.readFileSync(mdPath, 'utf-8');
        contents.push({ path: folder + '.md', content: filterRuleByLevel(content, ctx.ruleLevel) });
      }
    }
  }

  return contents;
}

function filterRuleByLevel(content: string, level: Context['ruleLevel']): string {
  if (level === 'full') return content;

  const hasAny = /<!--\s*@level:/i.test(content);
  if (!hasAny) return content;

  const rank: Record<Context['ruleLevel'], number> = { summary: 0, quick: 1, full: 2 };
  const target = rank[level];

  const re = /<!--\s*@level:(summary|quick|full)\s*-->/gi;
  const matches: Array<{ level: Context['ruleLevel']; index: number; len: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    matches.push({ level: m[1] as Context['ruleLevel'], index: m.index, len: m[0].length });
  }
  if (matches.length === 0) return content;

  matches.sort((a, b) => a.index - b.index);
  const prefix = content.slice(0, matches[0].index);

  const picked: string[] = [prefix];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const segLevel = matches[i].level;
    if (rank[segLevel] <= target) {
      picked.push(content.slice(start, end));
    }
  }

  return picked.join('').trimEnd() + '\n';
}

// ============ 通用实体加载器 ============

interface LoadEntitiesOptions<T> {
  /** manifest 文件路径前缀，如 'custom-skills/' 或 'agents/' */
  manifestPrefix: string;
  /** 本地目标子目录，如 '.codebuddy/skill-snapshots/<id>' 或 '.codebuddy/agents' */
  targetSubDir: string;
  /** 元数据文件名，如 'SKILL.md' 或 'AGENT.md' */
  metadataFileName: string;
  /** 解析元数据的函数 */
  parseMetadata: (entityId: string, content: string) => T | null;
  /** 日志标签，如 '技能' 或 'Agent' */
  label: string;
  /** 是否包含该实体；未提供时全部包含 */
  includeEntity?: (metadata: T, entityId: string) => boolean;
}

interface DemoSkillSelectionContext {
  projects: Array<Pick<SubProject, 'lang' | 'stackTags' | 'frameworkLabel' | 'vueProfile' | 'uiLibLabels' | 'projectKind'>>;
  languageSet: Set<string>;
  frameworkTagSet: Set<string>;
  projectKindSet: Set<string>;
  stackTagSet: Set<string>;
}

async function loadEntities<T>(
  ctx: Readonly<Context>,
  logger: Logger,
  sourcePath: string,
  options: LoadEntitiesOptions<T>,
  tracker: ManagedFileTracker,
  targetDir: string,
): Promise<T[]> {
  const entities: T[] = [];
  const localDir = path.join(targetDir, options.targetSubDir);

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  if (ctx.isRemote) {
    const files = ctx.remoteManifest!.files.filter(
      f => f.path.startsWith(options.manifestPrefix)
    );
    const rootFiles = files.filter(file => !file.path.replace(options.manifestPrefix, '').includes('/'));
    const entityGroups = new Map<string, typeof files>();

    for (const file of files) {
      const relativePath = file.path.replace(options.manifestPrefix, '');
      const parts = relativePath.split('/');
      if (parts.length <= 1) continue;

      const entityId = parts[0];
      const group = entityGroups.get(entityId) || [];
      group.push(file);
      entityGroups.set(entityId, group);
    }

    for (const file of rootFiles) {
      try {
        const content = await readRemoteAsset(ctx, logger, file.path);
        const relativePath = file.path.replace(options.manifestPrefix, '');
        writeManagedFile(tracker, path.join(localDir, relativePath), content);
        logger.verbose(`已下载${options.label}根文件: ${relativePath}`);
      } catch (e) {
        logger.warn(`${options.label}根文件下载失败: ${file.path} - ${(e as Error).message}`);
      }
    }

    for (const [entityId, groupFiles] of entityGroups) {
      const metadataFile = groupFiles.find(file => file.path.endsWith(`/${options.metadataFileName}`));
      if (!metadataFile) continue;

      try {
        const metadataContent = await readRemoteTextAsset(ctx, logger, metadataFile.path);
        const metadata = options.parseMetadata(entityId, metadataContent);
        if (!metadata) continue;
        if (options.includeEntity && !options.includeEntity(metadata, entityId)) {
          logger.verbose(`已跳过${options.label}: ${entityId}`);
          continue;
        }

        entities.push(metadata);

        for (const file of groupFiles) {
          try {
            const content = file.path === metadataFile.path
              ? metadataContent
              : await readRemoteAsset(ctx, logger, file.path);
            const relativePath = file.path.replace(options.manifestPrefix, '');
            const localPath = path.join(localDir, relativePath);
            writeManagedFile(tracker, localPath, content);
            logger.verbose(`已下载${options.label}文件: ${relativePath}`);
          } catch (e) {
            logger.warn(`${options.label}文件下载失败: ${file.path} - ${(e as Error).message}`);
          }
        }
      } catch (e) {
        logger.warn(`${options.label}元数据下载失败: ${metadataFile.path} - ${(e as Error).message}`);
      }
    }
  } else {
    const sourceDir = path.join(PROJECT_ROOT, sourcePath);
    if (fs.existsSync(sourceDir)) {
      const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const sourceFile = path.join(sourceDir, entry.name);
        const destinationPath = path.join(localDir, entry.name);
        copyManagedFile(tracker, sourceFile, destinationPath);
      }

      const entityDirs = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => entry.name);

      for (const entityId of entityDirs) {
        const entitySourceDir = path.join(sourceDir, entityId);
        const metadataFile = path.join(entitySourceDir, options.metadataFileName);
        if (!fs.existsSync(metadataFile)) continue;

        const content = fs.readFileSync(metadataFile, 'utf-8');
        const metadata = options.parseMetadata(entityId, content);
        if (!metadata) continue;
        if (options.includeEntity && !options.includeEntity(metadata, entityId)) {
          logger.verbose(`已跳过${options.label}: ${entityId}`);
          continue;
        }

        entities.push(metadata);
        const sourceFiles = listFilesRecursive(entitySourceDir);
        for (const sourceFile of sourceFiles) {
          const relativePath = path.relative(sourceDir, sourceFile);
          const destinationPath = path.join(localDir, relativePath);
          copyManagedFile(tracker, sourceFile, destinationPath);
        }
      }
    }
  }

  return entities;
}

function createDemoSkillSelectionContext(workspaceInfo: WorkspaceInfo): DemoSkillSelectionContext {
  const projects = collectSkillContextProjects(workspaceInfo);
  const languageSet = new Set<string>();
  const frameworkTagSet = new Set<string>();
  const projectKindSet = new Set<string>();
  const stackTagSet = new Set<string>();

  for (const project of projects) {
    languageSet.add(project.lang);
    projectKindSet.add(project.projectKind);
    for (const tag of project.stackTags) {
      stackTagSet.add(tag);
    }
    for (const tag of collectProjectFrameworkTags(project)) {
      frameworkTagSet.add(tag);
    }
  }

  return {
    projects,
    languageSet,
    frameworkTagSet,
    projectKindSet,
    stackTagSet,
  };
}

function getDemoSkillPriority(skill: SkillMetadata, context: DemoSkillSelectionContext): number {
  const skillId = skill.id.toLowerCase();
  let score = 0;

  if (DEMO_LOW_PRIORITY_SKILL_IDS.has(skill.id)) score -= 25;
  if (skillId.includes('review')) score += 6;
  if (skillId.includes('refactor')) score += 6;
  if (skillId.includes('testing')) score += 5;
  if (skillId.includes('performance')) score += 4;
  if (skillId.includes('structure') || skillId.includes('module')) score += 6;
  if (skillId.includes('state')) score += 3;
  if (skillId.includes('i18n') || skillId.includes('a11y')) score += 2;

  if (context.projectKindSet.has('frontend')) {
    if (skillId.includes('frontend')) score += 8;
    if (skillId.includes('backend')) score -= 8;
  }

  if (context.projectKindSet.has('backend')) {
    if (skillId.includes('backend')) score += 8;
    if (skillId.includes('frontend')) score -= 8;
  }

  if (context.stackTagSet.has('vue3') || context.stackTagSet.has('vue2')) {
    if (skill.id === 'component-refactoring') score += 4;
    if (skill.id === 'state-management') score += 4;
  }

  return score;
}

function scoreSkillForDemo(
  skill: SkillMetadata,
  context: DemoSkillSelectionContext,
  targetRole: SkillRole | null,
  workspaceInfo: WorkspaceInfo,
): number {
  const matchedLanguages = (skill.languages || []).filter(language => context.languageSet.has(language)).length;
  const matchedFrameworks = (skill.frameworks || []).filter(framework => context.frameworkTagSet.has(normalizeStackLabel(framework))).length;
  const hasStackConstraints = Boolean((skill.languages && skill.languages.length > 0) || (skill.frameworks && skill.frameworks.length > 0));

  let score = 0;
  if (matchesSkillWorkspaceScope(skill, workspaceInfo)) score += 20;
  if (matchesSkillRole(skill, targetRole)) score += 20;
  if (matchesSkillStack(skill, context.projects)) score += 30;
  score += matchedLanguages * 8;
  score += matchedFrameworks * 8;
  score += hasStackConstraints ? 0 : 6;
  score += Math.min(skill.triggers.length, 4);
  score += getDemoSkillPriority(skill, context);
  return score;
}

function scoreAgentForDemo(agent: AgentMetadata, selectedSkillIds: Set<string>): number {
  let score = DEMO_AGENT_BASE_PRIORITY[agent.id] || 0;
  const relatedSkillMatches = (agent.relatedSkills || []).filter(skillId => selectedSkillIds.has(skillId)).length;

  score += relatedSkillMatches * 10;
  score += Math.min(agent.triggers.length, 4);

  if (agent.id === 'code-reviewer' && (selectedSkillIds.has('frontend-code-review') || selectedSkillIds.has('backend-code-review'))) {
    score += 6;
  }
  if (agent.id === 'performance-profiler' && selectedSkillIds.has('performance-optimization')) {
    score += 6;
  }
  if (agent.id === 'structure-analyzer' && (selectedSkillIds.has('structure-review') || selectedSkillIds.has('module-mapping'))) {
    score += 6;
  }
  if (agent.id === 'tdd-driver' && (selectedSkillIds.has('frontend-testing') || selectedSkillIds.has('backend-testing'))) {
    score += 6;
  }
  if (agent.id === 'system-overview-writer' && selectedSkillIds.has('system-overview-design')) {
    score += 6;
  }

  return score;
}

function selectTopDemoEntities<T extends { id: string }>(
  entities: T[],
  limit: number,
  scoreEntity: (entity: T) => number,
): { selected: T[]; removedIds: string[] } {
  const ranked = [...entities]
    .map(entity => ({ entity, score: scoreEntity(entity) }))
    .sort((left, right) => right.score - left.score || left.entity.id.localeCompare(right.entity.id));

  return {
    selected: ranked.slice(0, limit).map(entry => entry.entity),
    removedIds: ranked.slice(limit).map(entry => entry.entity.id),
  };
}

function pruneManagedEntityDirectories(
  targetDir: string,
  tracker: ManagedFileTracker,
  rootDir: string | null,
  entityIds: string[],
  label: string,
  logger: Logger,
): void {
  if (!rootDir || entityIds.length === 0) {
    return;
  }

  const normalizedRootDir = rootDir.replace(/\\/g, '/');

  for (const entityId of entityIds) {
    const relativePrefix = `${normalizedRootDir}/${entityId}`;
    const absolutePath = path.join(targetDir, rootDir, entityId);
    const removedPaths = [...tracker.files.keys()].filter(
      managedPath => managedPath === relativePrefix || managedPath.startsWith(`${relativePrefix}/`),
    );

    if (!fs.existsSync(absolutePath)) {
      for (const managedPath of removedPaths) {
        tracker.files.delete(managedPath);
      }
      continue;
    }

    if (!removeManagedPath(targetDir, absolutePath)) {
      continue;
    }

    for (const managedPath of removedPaths) {
      tracker.files.delete(managedPath);
    }
    tracker.summary.removed += removedPaths.length;
    logger.verbose(`demo 模式裁剪${label}: ${entityId}`);
  }
}

// ============ 技能系统 ============

async function loadSkills(
  ctx: Readonly<Context>,
  logger: Logger,
  skillsPath: string,
  tracker: ManagedFileTracker,
  targetDir: string,
  workspaceInfo: WorkspaceInfo,
  targetSubDir: string,
): Promise<SkillMetadata[]> {
  return loadEntities<SkillMetadata>(ctx, logger, skillsPath, {
    manifestPrefix: 'custom-skills/',
    targetSubDir,
    metadataFileName: 'SKILL.md',
    parseMetadata: parseSkillMetadata,
    label: '技能',
    includeEntity: (metadata) => shouldIncludeSkill(metadata, workspaceInfo, ctx.targetRole),
  }, tracker, targetDir);
}

// ============ Agent 系统 ============

async function loadAgents(
  ctx: Readonly<Context>,
  logger: Logger,
  agentsPath: string,
  tracker: ManagedFileTracker,
  targetDir: string,
  targetSubDir: string,
): Promise<AgentMetadata[]> {
  return loadEntities<AgentMetadata>(ctx, logger, agentsPath, {
    manifestPrefix: 'agents/',
    targetSubDir,
    metadataFileName: 'AGENT.md',
    parseMetadata: parseAgentMetadata,
    label: 'Agent',
  }, tracker, targetDir);
}

// ============ 脚本分发系统 ============

/**
 * 分发可执行脚本到业务项目
 */
async function distributeScripts(
  ctx: Readonly<Context>,
  logger: Logger,
  targetDir: string,
  tracker: ManagedFileTracker,
): Promise<string[]> {
  const distributed: string[] = [];
  const localScriptsDir = path.join(targetDir, '.codebuddy/scripts');

  const scriptsToDistribute = getScriptsForProfile(ctx.profile);

  if (!fs.existsSync(localScriptsDir)) {
    fs.mkdirSync(localScriptsDir, { recursive: true });
  }

  if (ctx.isRemote) {
    for (const scriptInfo of scriptsToDistribute) {
      try {
        const content = await readRemoteTextAsset(ctx, logger, `scripts/dist/${scriptInfo.file}`);
        const destPath = path.join(localScriptsDir, scriptInfo.file);
        writeManagedFile(tracker, destPath, content);
        distributed.push(scriptInfo.file);
        logger.verbose(`已下载脚本: ${scriptInfo.file}`);

        if (scriptInfo.dependencies) {
          for (const dep of scriptInfo.dependencies) {
            try {
              const depContent = await readRemoteTextAsset(ctx, logger, `scripts/dist/${dep}`);
              writeManagedFile(tracker, path.join(localScriptsDir, dep), depContent);
              logger.verbose(`已下载依赖: ${dep}`);
            } catch (e) {
              logger.warn(`依赖下载失败: ${dep} - ${(e as Error).message}`);
            }
          }
        }
      } catch (e) {
        logger.warn(`脚本下载失败: ${scriptInfo.file} - ${(e as Error).message}`);
      }
    }
  } else {
    const sourceDir = path.join(PROJECT_ROOT, 'scripts/dist');
    for (const scriptInfo of scriptsToDistribute) {
      const srcPath = path.join(sourceDir, scriptInfo.file);
      if (fs.existsSync(srcPath)) {
        const destPath = path.join(localScriptsDir, scriptInfo.file);
        copyManagedFile(tracker, srcPath, destPath);
        distributed.push(scriptInfo.file);
        logger.verbose(`已复制脚本: ${scriptInfo.file}`);

        if (scriptInfo.dependencies) {
          for (const dep of scriptInfo.dependencies) {
            const depSrc = path.join(sourceDir, dep);
            if (fs.existsSync(depSrc)) {
              copyManagedFile(tracker, depSrc, path.join(localScriptsDir, dep));
              logger.verbose(`已复制依赖: ${dep}`);
            }
          }
        }
      } else {
        logger.warn(`脚本不存在: ${srcPath}`);
      }
    }
  }

  if (distributed.length > 0) {
    const scriptsPackageJsonPath = path.join(localScriptsDir, 'package.json');
    writeManagedFile(
      tracker,
      scriptsPackageJsonPath,
      `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`,
    );
    const readmePath = path.join(localScriptsDir, 'README.md');
    writeManagedFile(tracker, readmePath, generateScriptsReadme(distributed));
  }

  return distributed;
}

/**
 * 分发 Workflows 到业务项目
 */
async function distributeWorkflows(
  ctx: Readonly<Context>,
  logger: Logger,
  targetDir: string,
  tracker: ManagedFileTracker,
): Promise<string[]> {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: '.codebuddy/workflows',
    items: WORKFLOWS_TO_DISTRIBUTE,
    label: 'workflow',
    tracker,
    readme: [
      '# Workflows', '',
      '本目录包含工作流规范（Workflow Spec）。', '',
      '- `default.workflow.json`：完整 7 步闭环工作流（PRD→分析→计划→TDD→审查→构建→验收）。',
      '- `sprint.workflow.json`：中档 5 步工作流（分析→计划→TDD→审查→验收）。',
      '- `micro.workflow.json`：轻量 3 步工作流（计划→实现→验证）。',
      '- `workflow.schema.json`：Workflow Spec 的 JSON Schema。', '',
      '使用 `--workflow` 参数指定模板：`node task-executor.js <id> --workflow .codebuddy/workflows/micro.workflow.json`', '',
    ].join('\n'),
  });
}

/**
 * 分发 TaskBooks 契约（Schema）到业务项目
 */
async function distributeTaskBooks(
  ctx: Readonly<Context>,
  logger: Logger,
  targetDir: string,
  tracker: ManagedFileTracker,
): Promise<string[]> {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: '.codebuddy/taskbooks',
    items: TASKBOOK_FILES_TO_DISTRIBUTE,
    label: 'taskbook contract',
    tracker,
    preCreateDirs: ['active', 'history'],
    readme: [
      '# TaskBooks', '',
      '本目录是 **TaskBook（任务书）** 的存储与契约（SSOT）。', '',
      '- `active/`：进行中的 TaskBook（*.json）',
      '- `history/`：已归档的 TaskBook（*.json）',
      '- `taskbook.schema.json`：TaskBook JSON Schema（契约）', '',
      '建议：任何 Agent/工具写入 TaskBook 前先按 schema 校验结构，避免"行为不一致"。', '',
    ].join('\n'),
  });
}

/**
 * 分发 Agent Calls 契约（Schema）到业务项目
 */
async function distributeAgentCalls(
  ctx: Readonly<Context>,
  logger: Logger,
  targetDir: string,
  tracker: ManagedFileTracker,
): Promise<string[]> {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: '.codebuddy/agent-calls',
    items: AGENT_CALL_FILES_TO_DISTRIBUTE,
    label: 'agent-call contract',
    tracker,
    readme: [
      '# Agent Calls', '',
      '本目录用于 **Agent Call 文件协议**：prompt.md ⇄ result.json（可审计、可恢复）。', '',
      '- `agent-call.schema.json`：result.json 的 JSON Schema（契约）', '',
      '强校验/诊断：',
      '- `node .codebuddy/scripts/contract-validator.js --agent-calls`',
      '- `node .codebuddy/scripts/agent-call-manager.js validate <requestId>`', '',
      '可选：远程写回 result.json（跨进程/跨机器）：',
      '- `node .codebuddy/scripts/agent-call-manager.js serve --host 127.0.0.1 --port 4317 --token <t>`', '',
    ].join('\n'),
  });
}

async function distributeCommands(
  ctx: Readonly<Context>,
  logger: Logger,
  targetDir: string,
  tracker: ManagedFileTracker,
): Promise<string[]> {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: '.codebuddy/commands',
    items: COMMANDS_TO_DISTRIBUTE,
    label: '命令',
    tracker,
    readme: generateCommandsReadme(COMMANDS_TO_DISTRIBUTE.map(item => item.destFile)),
  });
}

// ============ .gitignore 更新 ============

function updateGitignore(logger: Logger, projectDir: string): void {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const header = '# CodeBuddy 生成文件';
  const entries = ['.codebuddy/', 'codebuddy-loader.bundle.js'];

  try {
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
    }

    const existingLines = new Set(
      content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean),
    );
    const missingEntries = entries.filter(entry => !existingLines.has(entry));
    if (missingEntries.length === 0) {
      return;
    }

    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    if (!existingLines.has(header)) {
      content += `\n${header}\n`;
    }
    for (const entry of missingEntries) {
      content += `${entry}\n`;
    }

    fs.writeFileSync(gitignorePath, content, 'utf-8');
    logger.verbose('已更新 .gitignore');
  } catch (error) {
    logger.warn(`更新 .gitignore 失败: ${(error as Error).message}`);
  }
}

// ============ 参数解析 ============

function parseContextArgs(args: string[]): Readonly<Context> {

  let isVerbose = false;
  let isRemote = false;
  let remoteBaseUrl = '';
  let remoteBearerToken: string | null = null;
  let taskType: string | null = null;
  let relevanceThreshold = DEFAULT_THRESHOLD;
  let ruleLevel: Context['ruleLevel'] = DEFAULT_RULE_LEVEL;
  let requestTimeout = DEFAULT_TIMEOUT;
  let profile: Context['profile'] = DEFAULT_PROFILE;
  let disableWorkspace = false;
  let strictRemotePack = false;
  let workspaceScope: WorkspaceScope = 'workspace-union';
  let targetProject: string | null = null;
  let targetRole: SkillRole | null = null;
  let profileExplicit = false;
  let remoteBearerTokenExplicit = false;

  if (args.includes('--verbose') || args.includes('-v')) {
    isVerbose = true;
  }

  if (args.includes('--no-workspace')) {
    disableWorkspace = true;
  }

  if (args.includes('--pack-only') || args.includes('--strict-pack-only')) {
    strictRemotePack = true;
  }

  const workspaceScopeIndex = args.indexOf('--workspace-scope');
  if (workspaceScopeIndex !== -1) {
    const value = (args[workspaceScopeIndex + 1] || '').trim().toLowerCase();
    if (!value || value.startsWith('-')) {
      logError('--workspace-scope 需要 scope 参数');
      process.exit(1);
    }
    if (!WORKSPACE_SCOPES.includes(value as WorkspaceScope)) {
      logError(`--workspace-scope 仅支持 ${WORKSPACE_SCOPES.join('|')}，当前: ${value}`);
      process.exit(1);
    }
    workspaceScope = value as WorkspaceScope;
  }

  const projectIndex = args.indexOf('--project');
  if (projectIndex !== -1) {
    const value = (args[projectIndex + 1] || '').trim();
    if (!value || value.startsWith('-')) {
      logError('--project 需要项目选择器参数');
      process.exit(1);
    }
    targetProject = value;
    workspaceScope = 'project-targeted';
  }

  const roleIndex = args.indexOf('--role');
  if (roleIndex !== -1) {
    const value = (args[roleIndex + 1] || '').trim().toLowerCase();
    if (!value || value.startsWith('-')) {
      logError('--role 需要岗位参数');
      process.exit(1);
    }
    if (!SKILL_ROLES.includes(value as SkillRole)) {
      logError(`--role 仅支持 ${SKILL_ROLES.join('|')}，当前: ${value}`);
      process.exit(1);
    }
    targetRole = value as SkillRole;
  }

  const profileIndex = args.indexOf('--profile');
  if (profileIndex !== -1) {
    const value = (args[profileIndex + 1] || '').trim().toLowerCase();
    if (!value || value.startsWith('-')) {
      logError('--profile 需要 profile 名称参数');
      process.exit(1);
    }
    if (!INSTALL_PROFILES.includes(value as Context['profile'])) {
      logError(`--profile 仅支持 ${INSTALL_PROFILES.join('|')}，当前: ${value}`);
      process.exit(1);
    }
    profile = value as Context['profile'];
    profileExplicit = true;
  }

  const legacyEnableOrchestrator = args.includes('--enable-orchestrator');
  if (legacyEnableOrchestrator) {
    if (profileExplicit && !isOrchestratorProfile(profile)) {
      logError('--enable-orchestrator 只能与 --profile orchestrator|full 一起使用');
      process.exit(1);
    }
    if (!profileExplicit) {
      profile = 'full';
    }
  }

  const remoteIndex = args.indexOf('--remote');
  if (remoteIndex !== -1) {
    const url = args[remoteIndex + 1];
    if (!url || url.startsWith('-')) {
      logError('--remote 需要 URL 参数');
      process.exit(1);
    }
    try {
      new URL(url);
    } catch {
      logError('--remote 需要有效的 URL 格式（如 https://example.com）');
      process.exit(1);
    }
    isRemote = true;
    remoteBaseUrl = url.replace(/\/$/, '');
  }

  const remoteBearerTokenIndex = args.indexOf('--remote-bearer-token');
  if (remoteBearerTokenIndex !== -1) {
    const token = args[remoteBearerTokenIndex + 1];
    if (!token || token.startsWith('-')) {
      logError('--remote-bearer-token requires a token value');
      process.exit(1);
    }
    remoteBearerToken = token;
    remoteBearerTokenExplicit = true;
  } else if (process.env.CODEBUDDY_REMOTE_BEARER_TOKEN) {
    remoteBearerToken = process.env.CODEBUDDY_REMOTE_BEARER_TOKEN.trim() || null;
  }

  if (strictRemotePack && !isRemote) {
    logError('--pack-only can only be used with --remote');
    process.exit(1);
  }

  if (remoteBearerTokenExplicit && !isRemote) {
    logError('--remote-bearer-token can only be used with --remote');
    process.exit(1);
  }

  const taskIndex = args.indexOf('--task');
  if (taskIndex !== -1) {
    const taskInput = args[taskIndex + 1];
    if (!taskInput || taskInput.startsWith('-')) {
      logError('--task 需要任务类型参数');
      process.exit(1);
    }
    taskType = taskInput.toLowerCase().trim();
  }

  const thresholdIndex = args.indexOf('--threshold');
  if (thresholdIndex !== -1) {
    const value = parseFloat(args[thresholdIndex + 1]);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      relevanceThreshold = value;
    }
  }

  const ruleLevelIndex = args.indexOf('--rule-level');
  const ruleLevelExplicit = ruleLevelIndex !== -1;
  if (ruleLevelExplicit) {
    const value = (args[ruleLevelIndex + 1] || '').trim().toLowerCase();
    if (value === 'summary' || value === 'quick' || value === 'full') {
      ruleLevel = value as Context['ruleLevel'];
    } else if (value) {
      logError(`--rule-level 仅支持 summary|quick|full，当前: ${value}`);
      process.exit(1);
    }
  }

  // demo profile 默认使用 quick 裁剪等级（除非用户显式指定）
  if (profile === 'demo' && !ruleLevelExplicit) {
    ruleLevel = 'quick';
  }

  const timeoutIndex = args.indexOf('--timeout');
  if (timeoutIndex !== -1) {
    const value = parseInt(args[timeoutIndex + 1], 10);
    if (!isNaN(value) && value > 0) {
      requestTimeout = value;
    }
  }

  return {
    isRemote,
    isVerbose,
    remoteBaseUrl,
    remoteBearerToken,
    remoteManifest: null,
    remoteContentRoot: null,
    remoteContentPack: null,
    strictRemotePack,
    requestTimeout,
    taskType,
    relevanceThreshold,
    ruleLevel,
    profile,
    enableOrchestrator: profile !== 'demo' && isOrchestratorProfile(profile),
    disableWorkspace,
    workspaceScope,
    targetProject,
    targetRole,
  };
}

function parseInstallCliOptions(args: string[]): InstallCliOptions {
  return {
    ifDepsChanged: args.includes('--if-deps-changed'),
  };
}

function parseInitCliOptions(args: string[]): InitCliOptions {
  const explicitSelections = ['--git-hooks', '--ci', '--scripts'].filter(flag => args.includes(flag));
  const useExplicitSelections = explicitSelections.length > 0;

  return {
    gitHooks: useExplicitSelections ? args.includes('--git-hooks') : true,
    ci: useExplicitSelections ? args.includes('--ci') : true,
    scripts: useExplicitSelections ? args.includes('--scripts') : true,
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
  };
}

function parseCliArgs(): ParsedCliArgs {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    showHelp();
  }

  let command: LoaderCommand = 'install';
  let args = rawArgs;

  if (rawArgs[0] && !rawArgs[0].startsWith('-')) {
    const candidate = rawArgs[0].toLowerCase();
    if (COMMANDS.has(candidate)) {
      command = candidate as LoaderCommand;
      args = rawArgs.slice(1);
    } else {
      logError(`未知命令: ${rawArgs[0]}`);
      process.exit(1);
    }
  }

  const json = args.includes('--json');
  const filteredArgs = args.filter(arg => arg !== '--json');

  return {
    command,
    ctx: parseContextArgs(filteredArgs),
    json,
    installOptions: parseInstallCliOptions(filteredArgs),
    initOptions: parseInitCliOptions(filteredArgs),
  };
}

function resolveWorkspaceInfoForInstall(
  ctx: Readonly<Context>,
  logger: Logger,
  targetDir: string,
): WorkspaceInfo {
  const discoveredWorkspaceInfo: WorkspaceInfo = ctx.disableWorkspace
    ? {
      isWorkspace: false,
      rootDir: targetDir,
      projects: [],
      discoveredAt: new Date().toISOString(),
      scope: ctx.workspaceScope,
      selectedProject: null,
      totalProjectCount: 0,
    }
    : discoverWorkspace(logger, targetDir);

  if (ctx.disableWorkspace) {
    return discoveredWorkspaceInfo;
  }

  return createScopedWorkspaceInfo(discoveredWorkspaceInfo, ctx.workspaceScope, ctx.targetProject);
}

function runStatusCommand(targetDir: string, logger: Logger, json: boolean): number {
  const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
  const installStateExists = fs.existsSync(installStatePath);
  const installState = readInstallState(targetDir, logger);
  const inspection = inspectInstallState(targetDir, installState, installStateExists);

  if (json) {
    console.log(JSON.stringify({
      ok: inspection.installState !== null,
      inspection,
    }, null, 2));
  } else {
    console.log(formatStatusReport(inspection));
  }

  return inspection.installState !== null ? 0 : 1;
}

function runDoctorCommand(targetDir: string, logger: Logger, json: boolean): number {
  const installStatePath = path.join(targetDir, '.codebuddy', 'install.json');
  const installStateExists = fs.existsSync(installStatePath);
  const installState = readInstallState(targetDir, logger);
  const inspection = inspectInstallState(targetDir, installState, installStateExists);
  const checks = buildDoctorChecks(inspection);
  const summary = summarizeDoctorChecks(checks);

  if (json) {
    console.log(JSON.stringify({
      ok: summary.status !== 'fail',
      summary,
      inspection,
      checks,
    }, null, 2));
  } else {
    console.log(formatDoctorReport(inspection, checks, summary));
  }

  return summary.status === 'fail' ? 1 : 0;
}

function runInitCommand(targetDir: string, logger: Logger, options: InitCliOptions): number {
  try {
    const result = runInit({
      targetDir,
      bootstrapPackageName: getLoaderPackageName(logger),
      gitHooks: options.gitHooks,
      ci: options.ci,
      scripts: options.scripts,
      force: options.force,
      dryRun: options.dryRun,
    }, logger);

    const lines = [
      options.dryRun ? 'CodeBuddy Init (dry-run)' : 'CodeBuddy Init',
      `Target: ${targetDir}`,
      '',
    ];

    if (result.generated.length > 0) {
      lines.push('Generated:');
      for (const item of result.generated) {
        lines.push(`  - ${item}`);
      }
    }

    if (result.injected.length > 0) {
      lines.push('Injected package.json scripts:');
      for (const item of result.injected) {
        lines.push(`  - ${item}`);
      }
    }

    if (result.skipped.length > 0) {
      lines.push('Skipped:');
      for (const item of result.skipped) {
        lines.push(`  - ${item}`);
      }
    }

    if (result.notes.length > 0) {
      lines.push('Notes:');
      for (const item of result.notes) {
        lines.push(`  - ${item}`);
      }
    }

    console.log(lines.join('\n'));
    return 0;
  } catch (error) {
    logger.error((error as Error).message);
    return 1;
  }
}

// ============ 主函数 ============

async function main(): Promise<void> {
  const parsedCli = parseCliArgs();
  const parsedCtx = parsedCli.ctx;
  const logger = createLogger(parsedCtx);
  const targetDir = process.cwd();
  let depsFingerprint: string | null = null;

  if (parsedCli.command === 'status') {
    process.exit(runStatusCommand(targetDir, logger, parsedCli.json));
  }

  if (parsedCli.command === 'doctor') {
    process.exit(runDoctorCommand(targetDir, logger, parsedCli.json));
  }

  if (parsedCli.command === 'init') {
    process.exit(runInitCommand(targetDir, logger, parsedCli.initOptions));
  }

  // loadConfig 可能返回 manifest，需要合并到 ctx
  const { config, manifest } = await loadConfig(parsedCtx, logger);
  let ctx: Readonly<Context> = manifest
    ? { ...parsedCtx, remoteManifest: manifest }
    : parsedCtx;

  if (ctx.isRemote && ctx.remoteManifest) {
    const packResolution = await ensureRemoteContentPack(ctx, logger, targetDir);
    ctx = {
      ...ctx,
      remoteContentRoot: packResolution.contentRoot,
      remoteContentPack: packResolution.pack,
    };
  }

  logger.log(`CodeBuddy 规则加载器 ${LOADER_DISPLAY_VERSION} (三层架构 + 技能系统)`);
  logger.log(ctx.isRemote ? `模式: 远程 (${ctx.remoteBaseUrl})` : '模式: 本地');
  logger.log(`安装档位: ${ctx.profile}`);
  logger.log(`Workspace 范围: ${ctx.workspaceScope}`);
  if (ctx.targetProject) logger.log(`目标项目: ${ctx.targetProject}`);
  if (ctx.enableOrchestrator) logger.log('编排模式: 已启用（含 TaskBook / Agent Call / Workflow 契约）');
  if (ctx.ruleLevel !== 'full') {
    logger.log(`规则裁剪: ${ctx.ruleLevel}（Layer1 主入口使用 ${ctx.ruleLevel}；完整原文写入 .codebuddy/rules_cache/layer1_reference/）`);
  }

  if (ctx.taskType) {
    logger.log(`任务筛选: ${ctx.taskType} (阈值: ${ctx.relevanceThreshold})`);
  }

  const previousInstallState = readInstallState(targetDir, logger);
  const managedFileTracker = createManagedFileTracker(targetDir);
  logger.log(`目标项目: ${targetDir}`);

  // ============ Workspace 多项目发现 ============
  let workspaceInfo: WorkspaceInfo;
  try {
    workspaceInfo = resolveWorkspaceInfoForInstall(ctx, logger, targetDir);
  } catch (error) {
    logError((error as Error).message);
    process.exit(1);
  }

  const installLockHandle = acquireInstallLock(targetDir, logger);
  if (!installLockHandle) {
    process.exit(1);
  }
  try {
    if (parsedCli.installOptions.ifDepsChanged) {
      const currentDepsFingerprint = computeDepsFingerprint(targetDir, workspaceInfo);
      const previousDepsFingerprint = previousInstallState?.depsFingerprint || null;
      if (currentDepsFingerprint && currentDepsFingerprint === previousDepsFingerprint) {
        logger.log('依赖未变更，跳过安装。');
        return;
      }
      depsFingerprint = currentDepsFingerprint;
    } else {
      depsFingerprint = computeDepsFingerprint(targetDir, workspaceInfo);
    }

    if (!ctx.disableWorkspace && workspaceInfo.scope === 'project-targeted' && workspaceInfo.projects[0]) {
      logger.log(`Workspace 定向模式: ${workspaceInfo.projects[0].name} (${workspaceInfo.projects[0].relativePath})`);
    }

    if (ctx.disableWorkspace) {
      logger.verbose('Workspace 发现已禁用（--no-workspace）');
    } else if (workspaceInfo.isWorkspace) {
      logger.log(`Workspace 模式: ${workspaceInfo.totalProjectCount} 个子项目（当前范围: ${workspaceInfo.scope}）`);
    } else {
      logger.verbose('单项目模式（未发现多个子项目）');
    }

    if (ctx.targetRole) {
      logger.log(`岗位过滤: ${ctx.targetRole}`);
    }

  const { layers, skills: skillsConfig, output, frontmatter } = config;

  // 检测项目依赖（向后兼容：选择 primaryProject 作为 Layer1 基准）
  let pkg: PackageJson;
  let dependencies: Record<string, string>;
  let vueProfile: VueProfile | null;
  let primaryProject: SubProject | null = null;

  if ((workspaceInfo.isWorkspace || workspaceInfo.projects.length > 0) && workspaceInfo.projects.length > 0) {
    // Workspace 模式：选择第一个有 Vue 依赖的项目，否则取第一个
    primaryProject =
      workspaceInfo.projects.find(p => p.vueProfile !== null) ||
      workspaceInfo.projects[0];
    pkg = primaryProject.packageJson ?? {};
    dependencies = primaryProject.dependencies;
    vueProfile = primaryProject.vueProfile;
    logger.verbose(`主项目（Layer1 基准）: ${primaryProject.name} (${primaryProject.relativePath})`);
  } else {
    pkg = getPackageJson(logger, targetDir);
    dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    vueProfile = checkVueProfile(dependencies);
  }

  if (vueProfile) {
    logger.log(`检测到 Vue ${vueProfile.version} (${vueProfile.type})`);
  }

  // 构建输出内容
  const updatedAt = new Date().toISOString();
  const isDemo = isDemoProfile(ctx.profile);
  let finalContent = `---
description: ${frontmatter?.description || '前端架构规范 - CodeBuddy GLM-4.7 专用版'}
alwaysApply: ${frontmatter?.alwaysApply !== undefined ? frontmatter.alwaysApply : true}
enabled: ${frontmatter?.enabled !== undefined ? frontmatter.enabled : true}
updatedAt: ${updatedAt}
---

`;

  if (isDemo) {
    // demo 模式：插入欢迎 Banner（技术栈信息稍后在加载完毕后补充）
    finalContent += `> Generated by CodeBuddy Rule Loader ${LOADER_DISPLAY_VERSION} (demo profile)
> Generated at: ${updatedAt}

`;
  } else {
    finalContent += `# 前端架构规范 (CodeBuddy 版)

> Generated by CodeBuddy Rule Loader ${LOADER_DISPLAY_VERSION}
> Generated at: ${updatedAt}
> Vue Version: ${vueProfile ? `${vueProfile.version} (${vueProfile.type})` : 'Not detected'}

---

`;
  }

  // ============ Layer 1: Base (Eager Load) ============
  logger.log('处理 Layer 1: 基础规范 (Eager Load)...');

  const layer1Folders: string[] = [...(layers.base?.staticDeps || [])];

  // 根据 Vue 版本添加规则
  if (vueProfile) {
    if (vueProfile.version === 3) {
      layer1Folders.push('vue3');
    } else if (vueProfile.version === 2) {
      if (vueProfile.type === 'composition') {
        layer1Folders.push('vue2/vue2-composition.md');
      } else {
        layer1Folders.push('vue2/vue2-general.md');
      }
    }
  }

  const layer1Rules = await loadLayerRules(ctx, logger, layers.base?.id || 'layer1_base', layer1Folders);
  const layer1ReferenceIndex: RuleIndexItem[] = [];

  if (ctx.ruleLevel !== 'full') {
    const layer1FullRules = await loadLayerRules(
      { ...ctx, ruleLevel: 'full' },
      logger,
      layers.base?.id || 'layer1_base',
      layer1Folders,
    );

    for (const rule of layer1FullRules) {
      const referencePath = `.codebuddy/rules_cache/layer1_reference/${rule.path}`.replace(/\\/g, '/');
      writeManagedFile(managedFileTracker, path.join(targetDir, referencePath), rule.content);
      layer1ReferenceIndex.push({
        rule: rule.path.replace(/\.md$/, ''),
        path: referencePath,
      });
    }

    if (layer1ReferenceIndex.length > 0) {
      logger.log(`已生成 ${layer1ReferenceIndex.length} 个 Layer 1 完整参考缓存`);
    }
  }

  finalContent += `## ${layers.base?.title || 'Layer 1: 基础规范'}\n\n`;
  finalContent += `> 这些是本项目必须遵守的核心规范\n\n`;

  for (const rule of layer1Rules) {
    finalContent += `<!-- Source: ${rule.path} -->\n${rule.content}\n\n---\n\n`;
  }

  // ============ Layer 2: Business (Lazy Load - Index Only) ============
  logger.log('处理 Layer 2: 业务规范 (Lazy Load)...');

  const layer2Index: RuleIndexItem[] = [];
  const businessDeps = layers.business?.dependencies || {};
  const standaloneLang = primaryProject ? primaryProject.lang : detectProjectLangFromDir(targetDir);
  const standalonePackageJson = !primaryProject && fs.existsSync(path.join(targetDir, 'package.json')) ? pkg : undefined;
  const standaloneMetadata = primaryProject
    ? null
    : detectProjectMetadata(targetDir, standaloneLang, standalonePackageJson);
  const layer2TargetProject: Pick<SubProject, 'lang' | 'projectKind' | 'stackTags' | 'dependencies'> = primaryProject ?? {
    lang: standaloneLang,
    projectKind: standaloneMetadata?.projectKind || 'unknown',
    stackTags: standaloneMetadata?.stackTags || [],
    dependencies: standaloneMetadata?.dependencies || dependencies,
  };

  for (const match of collectMatchedBusinessRules(layer2TargetProject, businessDeps)) {
    logger.log(`  命中 ${match.selector}，添加规则索引`);
    layer2Index.push({
      dep: match.selector,
      rule: match.rule,
      path: `.codebuddy/rules_cache/layer2_business/${match.rule}.md`
    });

    // 缓存规则文件
    const cacheDir = path.join(targetDir, '.codebuddy/rules_cache/layer2_business');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const content = await loadRuleFile(ctx, logger, layers.business?.id || 'layer2_business', `${match.rule}.md`);
    if (content) {
      writeManagedFile(managedFileTracker, path.join(cacheDir, `${match.rule}.md`), content);
    }
  }

  // ============ Workspace: 为每个子项目匹配并缓存 Layer2 规则 ============
  if (workspaceInfo.totalProjectCount > 1) {
    logger.log('处理 Workspace 子项目 Layer2 规则...');
    for (const project of workspaceInfo.projects) {
      // 跳过根项目（已在上面处理）
      if (project.relativePath === '.') continue;

      for (const match of collectMatchedBusinessRules(project, businessDeps)) {
        logger.verbose(`  ${project.name}: 命中 ${match.selector}，添加规则索引`);
        project.matchedLayer2Rules.push({
          dep: match.selector,
          rule: match.rule,
          path: `.codebuddy/rules_cache/projects/${project.relativePath}/layer2_business/${match.rule}.md`,
        });

        // 缓存到子项目独立目录
        const projectCacheDir = path.join(
          targetDir,
          `.codebuddy/rules_cache/projects/${project.relativePath}/layer2_business`
        );
        if (!fs.existsSync(projectCacheDir)) {
          fs.mkdirSync(projectCacheDir, { recursive: true });
        }
        const content = await loadRuleFile(ctx, logger, layers.business?.id || 'layer2_business', `${match.rule}.md`);
        if (content) {
          writeManagedFile(managedFileTracker, path.join(projectCacheDir, `${match.rule}.md`), content);
        }
      }
    }

    // 同时填充根项目的 matchedLayer2Rules（如果存在）
    const rootProject = workspaceInfo.projects.find(p => p.relativePath === '.');
    if (rootProject) {
      rootProject.matchedLayer2Rules = [...layer2Index];
    }
  }

  // ============ Layer 3: Action (Lazy Load - Index Only) ============
  logger.log('处理 Layer 3: 任务检查清单 (Lazy Load)...');

  const layer3Index: RuleIndexItem[] = [];
  const actionDefaults = layers.action?.defaults || [];

  for (const item of actionDefaults) {
    layer3Index.push({
      rule: item,
      path: `.codebuddy/rules_cache/layer3_action/${item}.md`
    });

    // 缓存规则文件
    const cacheDir = path.join(targetDir, '.codebuddy/rules_cache/layer3_action');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const content = await loadRuleFile(ctx, logger, layers.action?.id || 'layer3_action', item + '.md');
    if (content) {
      writeManagedFile(managedFileTracker, path.join(cacheDir, item + '.md'), content);
    }
  }

  // ============ 生成规则索引表 ============
  if (layer1ReferenceIndex.length > 0 || layer2Index.length > 0 || layer3Index.length > 0) {
    finalContent += `## 📚 规则参考索引 (按需加载)\n\n`;
    if (layer1ReferenceIndex.length > 0) {
      finalContent += `> 当前主入口仅内嵌 Layer 1 的 ${ctx.ruleLevel} 内容；完整原文与 Layer 2/3 细节规则请按需读取\n\n`;
    } else {
      finalContent += `> 以下规则包含具体的技术栈实现细节，请按需读取\n\n`;
    }
    finalContent += `| 规则名称 | 本地路径 | 说明 |\n|---------|---------|------|\n`;

    for (const item of layer1ReferenceIndex) {
      finalContent += `| ${item.rule} | \`${item.path}\` | Layer 1 完整参考 |\n`;
    }
    for (const item of layer2Index) {
      finalContent += `| ${item.rule} | \`${item.path}\` | Layer 2 匹配：${item.dep} |\n`;
    }
    for (const item of layer3Index) {
      finalContent += `| ${item.rule} | \`${item.path}\` | 任务检查清单 |\n`;
    }
    finalContent += '\n';
  }

  // ============ Workspace: 生成索引文件和提示词 ============
  let workspaceIndexPath: string | null = null;
  if (workspaceInfo.totalProjectCount > 1) {
    // 生成 workspace-index.json
    const workspaceIndex: WorkspaceIndex = {
      version: '1.1.0',
      generatedAt: new Date().toISOString(),
      rootDir: targetDir,
      projectCount: workspaceInfo.projects.length,
      totalProjectCount: workspaceInfo.totalProjectCount,
      scope: workspaceInfo.scope,
      selectedProject: workspaceInfo.selectedProject,
      projects: workspaceInfo.projects.map(p => ({
        name: p.name,
        relativePath: p.relativePath,
        lang: p.lang,
        frameworkLabel: p.frameworkLabel,
        uiLibLabels: p.uiLibLabels,
        projectKind: p.projectKind,
        stackTags: p.stackTags,
        vueVersion: p.vueProfile?.version ?? null,
        layer2CachePath: p.relativePath === '.'
          ? '.codebuddy/rules_cache/layer2_business/'
          : `.codebuddy/rules_cache/projects/${p.relativePath}/layer2_business/`,
        matchedRules: p.matchedLayer2Rules.map(r => r.rule),
      })),
    };

    workspaceIndexPath = path.join(targetDir, '.codebuddy/workspace-index.json');
    const workspaceIndexDir = path.dirname(workspaceIndexPath);
    if (!fs.existsSync(workspaceIndexDir)) {
      fs.mkdirSync(workspaceIndexDir, { recursive: true });
    }
    writeManagedFile(managedFileTracker, workspaceIndexPath, JSON.stringify(workspaceIndex, null, 2));
    logger.log(`已生成 workspace-index.json (${workspaceInfo.projects.length} 个项目)`);

    // 注入 workspace 提示词
    finalContent += generateWorkspacePrompt(workspaceInfo);
  }

  // ============ 规则激活提示词 ============
  if (!isDemo) {
    finalContent += generateRuleActivationPrompt(config);
    finalContent += generateQuickActionGuide();
  } else {
    finalContent += generateDemoQuickActionGuide();
  }

  // ============ 技能系统 ============
  let skills: SkillMetadata[] = [];
  let skillsRootDir: string | null = null;
  const skillsSnapshotRetention = skillsConfig?.enabled ? SKILL_SNAPSHOT_RETAIN_COUNT : null;
  if (skillsConfig?.enabled) {
    logger.log('加载技能系统...');
    skillsRootDir = `.codebuddy/skill-snapshots/${createInstallSnapshotId()}`;
    logger.verbose(`Skills active root: ${skillsRootDir}`);
    skills = await loadSkills(
      ctx,
      logger,
      skillsConfig.path || 'custom-skills',
      managedFileTracker,
      targetDir,
      workspaceInfo,
      skillsRootDir,
    );
    if (isDemo && skills.length > DEMO_SKILL_LIMIT) {
      const demoSkillContext = createDemoSkillSelectionContext(workspaceInfo);
      const { selected, removedIds } = selectTopDemoEntities(
        skills,
        DEMO_SKILL_LIMIT,
        skill => scoreSkillForDemo(skill, demoSkillContext, ctx.targetRole, workspaceInfo),
      );
      pruneManagedEntityDirectories(targetDir, managedFileTracker, skillsRootDir, removedIds, '技能', logger);
      skills = selected;
      logger.log(`demo 模式裁剪技能：保留 ${skills.length} 个，移除 ${removedIds.length} 个`);
      logger.verbose(`demo 模式保留技能: ${skills.map(skill => skill.id).join(', ')}`);
    }
    logger.log(`已加载 ${skills.length} 个技能`);
    if (!isDemo) {
      finalContent += generateSkillsPrompt(skills, skillsRootDir);
    }
  }

  // ============ Agent 系统 ============
  logger.log('加载 Agent 系统...');
  let agentsRootDir: string | null = `.codebuddy/agent-snapshots/${createInstallSnapshotId()}`;
  const agentsSnapshotRetention = AGENT_SNAPSHOT_RETAIN_COUNT;
  logger.verbose(`Agents active root: ${agentsRootDir}`);
  let agents = await loadAgents(ctx, logger, 'agents', managedFileTracker, targetDir, agentsRootDir);
  if (isDemo && agents.length > DEMO_AGENT_LIMIT) {
    const selectedSkillIds = new Set(skills.map(skill => skill.id));
    const { selected, removedIds } = selectTopDemoEntities(
      agents,
      DEMO_AGENT_LIMIT,
      agent => scoreAgentForDemo(agent, selectedSkillIds),
    );
    pruneManagedEntityDirectories(targetDir, managedFileTracker, agentsRootDir, removedIds, 'Agent', logger);
    agents = selected;
    logger.log(`demo 模式裁剪 Agent：保留 ${agents.length} 个，移除 ${removedIds.length} 个`);
    logger.verbose(`demo 模式保留 Agent: ${agents.map(agent => agent.id).join(', ')}`);
  }
  if (agents.length > 0) {
    logger.log(`已加载 ${agents.length} 个 Agents`);
    if (!isDemo) {
      finalContent += generateAgentsPrompt(agents, agentsRootDir);
    }
  }

  if (isDemo) {
    // demo 模式：使用统一路由表替代 Agent 表 + Skill 表 + 激活规则
    logger.log('生成统一路由表（demo 模式）...');

    // 在 Layer 1 规则之前插入欢迎 Banner
    const bannerContent = generateDemoWelcomeBanner({
      vueVersion: vueProfile?.version ?? null,
      vueType: vueProfile?.type ?? null,
      uiLibs: primaryProject?.uiLibLabels ?? [],
      lang: primaryProject?.lang ?? (standaloneLang || 'unknown'),
      framework: primaryProject?.frameworkLabel ?? null,
      layer1RulesCount: layer1Rules.length,
      agentsCount: agents.length,
      skillsCount: skills.length,
    });
    // 在 frontmatter 之后、Layer 1 之前插入 Banner
    const insertPoint = finalContent.indexOf('## ');
    if (insertPoint !== -1) {
      finalContent = finalContent.slice(0, insertPoint) + bannerContent + finalContent.slice(insertPoint);
    } else {
      finalContent += bannerContent;
    }

    finalContent += generateUnifiedRoutingPrompt(
      skills,
      agents,
      skillsRootDir || '.codebuddy/skills',
      agentsRootDir || '.codebuddy/agents',
    );
    logger.log('统一路由表已注入');
  } else if (skills.length > 0 || agents.length > 0) {
    logger.log('生成强制激活规则...');
    finalContent += generateActivationRules(
      skills,
      agents,
      skillsRootDir || '.codebuddy/skills',
      agentsRootDir || '.codebuddy/agents',
    );
    logger.log('强制激活规则已注入');
  }

  // ============ 脚本分发 ============
  logger.log('分发工具脚本...');
  const distributedScripts = await distributeScripts(ctx, logger, targetDir, managedFileTracker);
  if (distributedScripts.length > 0) {
    logger.log(`已分发 ${distributedScripts.length} 个脚本`);
    if (!isDemo) {
      finalContent += generateScriptsPrompt(distributedScripts);
    }
  }

  // ============ Workflows 分发（orchestrator/full） ============
  let distributedWorkflows: string[] = [];
  if (ctx.enableOrchestrator) {
    logger.log('分发 Workflows...');
    distributedWorkflows = await distributeWorkflows(ctx, logger, targetDir, managedFileTracker);
    if (distributedWorkflows.length > 0) {
      logger.log(`已分发 ${distributedWorkflows.length} 个工作流`);
      if (!isDemo) {
        finalContent += generateWorkflowsPrompt(distributedWorkflows);
      }
    }
  } else {
    logger.verbose('跳过 Workflows 分发（当前 profile 不包含编排契约）');
  }

  // ============ TaskBooks 契约分发（orchestrator/full） ============
  let distributedTaskBooks: string[] = [];
  if (ctx.enableOrchestrator) {
    logger.log('分发 TaskBook 契约...');
    distributedTaskBooks = await distributeTaskBooks(ctx, logger, targetDir, managedFileTracker);
    if (distributedTaskBooks.length > 0) {
      logger.log(`已分发 ${distributedTaskBooks.length} 个 TaskBook 契约文件`);
      if (!isDemo) {
        finalContent += generateTaskBooksPrompt(distributedTaskBooks);
      }
    }
  } else {
    logger.verbose('跳过 TaskBook 契约分发（当前 profile 不包含编排契约）');
  }

  // ============ Agent Calls 契约分发（orchestrator/full） ============
  let distributedAgentCalls: string[] = [];
  if (ctx.enableOrchestrator) {
    logger.log('分发 Agent Call 契约...');
    distributedAgentCalls = await distributeAgentCalls(ctx, logger, targetDir, managedFileTracker);
    if (distributedAgentCalls.length > 0) {
      logger.log(`已分发 ${distributedAgentCalls.length} 个 Agent Call 契约文件`);
      if (!isDemo) {
        finalContent += generateAgentCallsPrompt(distributedAgentCalls);
      }
    }
  } else {
    logger.verbose('跳过 Agent Call 契约分发（当前 profile 不包含编排契约）');
  }

  // ============ 命令分发 ============
  logger.log('分发 Slash Commands...');
  const distributedCommands = await distributeCommands(ctx, logger, targetDir, managedFileTracker);
  if (distributedCommands.length > 0) {
    logger.log(`已分发 ${distributedCommands.length} 个命令`);
    if (!isDemo) {
      finalContent += generateCommandsPrompt(distributedCommands);
    }
  }

  if (isDemo) {
    finalContent += generateDemoRuntimeSummary(
      distributedScripts.length,
      distributedWorkflows.length,
      distributedTaskBooks.length,
      distributedCommands.length,
    );
  }

  // ============ 输出文件 ============
  const outputDir = path.join(targetDir, output?.dirName || '.codebuddy/rules');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, output?.fileName || 'project-rules.md');
  writeManagedFile(managedFileTracker, outputPath, finalContent);

  // 更新 .gitignore
  updateGitignore(logger, targetDir);

  const removedManagedFiles = cleanupStaleManagedFiles(
    managedFileTracker,
    previousInstallState,
    {
      preservePrefixes: [
        '.codebuddy/agent-snapshots/',
        '.codebuddy/agents/',
        '.codebuddy/skill-snapshots/',
        '.codebuddy/skills/',
      ],
    },
    logger,
  );
  const loaderVersion = getLoaderVersion(ctx, logger);
  const installState = buildInstallState({
    version: loaderVersion,
    ctx,
    targetDir,
    depsFingerprint,
    outputPath,
    workspaceIndexPath,
    skillsRootDir,
    skillsSnapshotRetention,
    agentsRootDir,
    agentsSnapshotRetention,
    layer1RulesCount: layer1Rules.length,
    layer2IndexCount: layer2Index.length,
    layer3IndexCount: layer3Index.length,
    skillsCount: skills.length,
    agentsCount: agents.length,
    distributedScripts,
    distributedWorkflows,
    distributedTaskBooks,
    distributedAgentCalls,
    distributedCommands,
    managedFiles: getManagedFiles(managedFileTracker),
    workspaceInfo,
  });
  const installStatePath = writeInstallState(targetDir, installState);
  const removedAgentSnapshots = gcSnapshotEntries(
    targetDir,
    '.codebuddy/agent-snapshots',
    agentsRootDir,
    agentsSnapshotRetention || AGENT_SNAPSHOT_RETAIN_COUNT,
    logger,
  );
  const removedSkillSnapshots = gcSnapshotEntries(
    targetDir,
    '.codebuddy/skill-snapshots',
    skillsRootDir,
    skillsSnapshotRetention || SKILL_SNAPSHOT_RETAIN_COUNT,
    logger,
  );
  logger.log(`已生成 install.json: ${installStatePath}`);
  logger.log(`同步结果: 写入 ${managedFileTracker.summary.written}，复用 ${managedFileTracker.summary.unchanged}，清理 ${removedManagedFiles.length}`);
  if (removedAgentSnapshots.length > 0) {
    logger.log(`Agent 快照回收: ${removedAgentSnapshots.length} 个（保留最近 ${agentsSnapshotRetention || AGENT_SNAPSHOT_RETAIN_COUNT} 个）`);
  }
  if (removedSkillSnapshots.length > 0) {
    logger.log(`技能快照回收: ${removedSkillSnapshots.length} 个（保留最近 ${skillsSnapshotRetention || SKILL_SNAPSHOT_RETAIN_COUNT} 个）`);
  }

  logger.log('');
  logger.log('═══════════════════════════════════════════════════════════════════');
  logger.log(`✅ 成功! 规则文件已写入: ${outputPath}`);
  logger.log(`   文件大小: ${(finalContent.length / 1024).toFixed(2)} KB`);
  logger.log(`   Layer 1 规则: ${layer1Rules.length} 个`);
  logger.log(`   Layer 2 索引: ${layer2Index.length} 个`);
  logger.log(`   Layer 3 索引: ${layer3Index.length} 个`);
  logger.log(`   工具脚本: ${distributedScripts.length} 个`);
  logger.log(`   Workflows: ${distributedWorkflows.length} 个`);
  logger.log(`   TaskBook 契约: ${distributedTaskBooks.length} 个`);
  logger.log(`   Agent Call 契约: ${distributedAgentCalls.length} 个`);
  logger.log(`   Slash Commands: ${distributedCommands.length} 个`);
  if (workspaceInfo.totalProjectCount > 1) {
    logger.log(`   Workspace 子项目: ${workspaceInfo.projects.length} 个`);
    for (const p of workspaceInfo.projects) {
      const rules = p.matchedLayer2Rules.map(r => r.rule).join(', ') || '无';
      logger.log(`     - ${p.name} (${p.relativePath}): ${p.frameworkLabel || '无框架'} | 规则: ${rules}`);
    }
  }
  logger.log('═══════════════════════════════════════════════════════════════════');
  } finally {
    releaseInstallLock(installLockHandle, logger);
  }
}

main().catch((err: Error) => {
  logError(`Fatal Error: ${err.message}`);
  process.exit(1);
});
