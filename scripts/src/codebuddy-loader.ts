#!/usr/bin/env node
/**
 * CodeBuddy 规则加载器 v2.0
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
  AgentMetadata,
  PackageJson,
  ProjectLang,
  SubProject,
  WorkspaceInfo,
  WorkspaceIndex,
} from './types';
import { Logger, createLogger, logError } from './lib/logger';
import { fetchUrl } from './lib/fetcher';
import { DistributeItemsOptions, distributeItems, copyRecursive } from './lib/distributor';
import { parseSkillMetadata, parseAgentMetadata } from './lib/metadata-parser';
import {
  generateWorkflowsPrompt,
  generateTaskBooksPrompt,
  generateAgentCallsPrompt,
  generateCommandsPrompt,
  generateScriptsReadme,
  generateScriptsPrompt,
  generateAgentsPrompt,
  generateSkillsPrompt,
  generateRuleActivationPrompt,
  generateWorkspacePrompt,
} from './lib/prompt-builder';

// ============ 配置常量 ============

const SCRIPT_DIR: string = __dirname;
const PROJECT_ROOT: string = path.resolve(SCRIPT_DIR, '../..');
const RULES_ROOT: string = path.join(PROJECT_ROOT, 'rules');
const CONFIG_PATH: string = path.join(PROJECT_ROOT, 'config', 'loader-config.json');
const SKILLS_ROOT: string = path.join(PROJECT_ROOT, 'custom-skills');
const AGENTS_ROOT: string = path.join(PROJECT_ROOT, 'agents');

const DEFAULT_TIMEOUT: number = 10000;
const DEFAULT_THRESHOLD: number = 0.5;
const DEFAULT_RULE_LEVEL: Context['ruleLevel'] = 'full';

// ============ 帮助信息 ============

function showHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║      CodeBuddy 规则加载器 v2.0 - 三层架构 + 技能系统              ║
╚══════════════════════════════════════════════════════════════════╝

用法：
  node codebuddy-loader.js [options]

选项：
  --help, -h           显示帮助信息
  --remote <URL>       从远程 URL 获取规则
  --task <type>        按任务类型筛选规则（渐进式披露）
                       类型: refactoring, debugging, testing, new-feature, code-review
  --threshold <n>      设置相关性阈值 (0-1, 默认: 0.5)
  --rule-level <lvl>   规则内容裁剪等级（基于 @level:summary/quick/full 分段标记，默认: full）
  --enable-orchestrator 启用 B 路线编排脚本分发（task-executor、agent-call 协议等）
  --no-workspace       禁用 workspace 多项目自动发现
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

  # 仅加载重构相关规则
  node codebuddy-loader.js --task refactoring

  # 从远程加载
  node codebuddy-loader.js --remote https://example.com/standards

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

function checkVueProfile(dependencies: Record<string, string>): VueProfile | null {
  const vueVersion = dependencies['vue'];
  if (!vueVersion) return null;

  if (vueVersion.startsWith('3') || vueVersion.startsWith('^3') || vueVersion.startsWith('~3')) {
    return { version: 3, type: 'standard' };
  }

  if (vueVersion.startsWith('2') || vueVersion.startsWith('^2') || vueVersion.startsWith('~2')) {
    if (dependencies['@vue/composition-api']) {
      return { version: 2, type: 'composition' };
    }
    return { version: 2, type: 'options' };
  }
  return null;
}

// ============ Workspace 多项目发现 ============

/** 应排除的目录名 */
const WORKSPACE_EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'build', '.codebuddy', '.git',
  'coverage', '.next', '.nuxt', '.output', '.cache',
]);

/** 最大发现子项目数 */
const MAX_SUB_PROJECTS = 20;

/**
 * 项目标志文件配置
 * 按优先级排序，匹配即停
 */
interface ProjectMarker {
  /** 标志文件名（任一存在即匹配） */
  files: string[];
  /** 语言标签 */
  lang: ProjectLang;
  /** 细化规则：匹配后可进一步细化语言 */
  refinements?: Array<{ files: string[]; lang: ProjectLang }>;
}

const PROJECT_MARKERS: ProjectMarker[] = [
  {
    files: ['package.json'], lang: 'javascript', refinements: [
      { files: ['tsconfig.json'], lang: 'typescript' },
    ]
  },
  { files: ['pom.xml'], lang: 'java' },
  { files: ['build.gradle', 'build.gradle.kts'], lang: 'java' },
  { files: ['go.mod'], lang: 'go' },
  { files: ['pyproject.toml', 'setup.py'], lang: 'python' },
  { files: ['Cargo.toml'], lang: 'rust' },
  // .NET: *.csproj 通过单独逻辑检测（通配符）
];

/**
 * 检测框架标签
 */
function detectFrameworkLabel(deps: Record<string, string>): string {
  if (deps['vue']) {
    const v = deps['vue'];
    if (v.startsWith('3') || v.startsWith('^3') || v.startsWith('~3')) return 'Vue 3';
    if (v.startsWith('2') || v.startsWith('^2') || v.startsWith('~2')) return 'Vue 2';
    return 'Vue';
  }
  if (deps['react']) return 'React';
  if (deps['@angular/core']) return 'Angular';
  if (deps['svelte']) return 'Svelte';
  return '';
}

/** 已知 UI 库映射（包名 → 显示名） */
const KNOWN_UI_LIBS: Record<string, string> = {
  'ant-design-vue': 'Ant Design Vue',
  'vant': 'Vant',
  'element-plus': 'Element Plus',
  'element-ui': 'Element UI',
  'naive-ui': 'Naive UI',
  'vuetify': 'Vuetify',
  '@arco-design/web-vue': 'Arco Design Vue',
  'antd': 'Ant Design',
  '@mui/material': 'MUI',
};

/**
 * 检测项目使用的 UI 库
 */
function detectUILibs(deps: Record<string, string>): string[] {
  const result: string[] = [];
  for (const [pkg, label] of Object.entries(KNOWN_UI_LIBS)) {
    if (deps[pkg]) {
      result.push(label);
    }
  }
  return result;
}

/**
 * 从 targetDir 递归扫描子项目
 *
 * - 最多扫描 2 层深度
 * - 排除 node_modules、dist 等目录
 * - 防循环：维护 visited Set（处理 symlink）
 * - 超过 MAX_SUB_PROJECTS 截断并警告
 */
function discoverWorkspace(logger: Logger, targetDir: string): WorkspaceInfo {
  const projects: SubProject[] = [];
  const visited = new Set<string>();

  /**
   * 递归扫描目录
   * @param dir 当前目录
   * @param depth 当前深度（0 = targetDir 本身）
   */
  function scan(dir: string, depth: number): void {
    if (depth > 2) return;
    if (projects.length >= MAX_SUB_PROJECTS) return;

    // 防循环：解析真实路径
    let realDir: string;
    try {
      realDir = fs.realpathSync(dir);
    } catch {
      return;
    }
    if (visited.has(realDir)) return;
    visited.add(realDir);

    // 检测当前目录是否为项目（多语言标志文件检测）
    const relativePath = path.relative(targetDir, dir).replace(/\\/g, '/') || '.';
    let detected = false;

    // 按 PROJECT_MARKERS 优先级逐个检测
    for (const marker of PROJECT_MARKERS) {
      const markerFile = marker.files.find(f => fs.existsSync(path.join(dir, f)));
      if (!markerFile) continue;

      // 匹配到标志文件
      let lang = marker.lang;

      // 细化语言（如 JS → TS）
      if (marker.refinements) {
        for (const ref of marker.refinements) {
          if (ref.files.some(f => fs.existsSync(path.join(dir, f)))) {
            lang = ref.lang;
            break;
          }
        }
      }

      if (markerFile === 'package.json') {
        // JS/TS 项目：解析 package.json
        try {
          const pkgContent = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')) as PackageJson;
          const deps: Record<string, string> = { ...pkgContent.dependencies, ...pkgContent.devDependencies };

          projects.push({
            name: pkgContent.name || path.basename(dir),
            relativePath,
            absolutePath: dir,
            lang,
            packageJson: pkgContent,
            vueProfile: checkVueProfile(deps),
            dependencies: deps,
            matchedLayer2Rules: [],
            frameworkLabel: detectFrameworkLabel(deps),
            uiLibLabels: detectUILibs(deps),
          });
        } catch {
          logger.warn(`解析 package.json 失败: ${path.join(dir, 'package.json')}`);
        }
      } else {
        // 非 JS 项目：用目录名作为项目名
        projects.push({
          name: path.basename(dir),
          relativePath,
          absolutePath: dir,
          lang,
          vueProfile: null,
          dependencies: {},
          matchedLayer2Rules: [],
          frameworkLabel: '',
          uiLibLabels: [],
        });
      }

      detected = true;
      break; // 匹配即停
    }

    // .NET 项目特殊检测（通配符 *.csproj）
    if (!detected) {
      try {
        const entries = fs.readdirSync(dir);
        const hasCsproj = entries.some(e => e.endsWith('.csproj') || e.endsWith('.sln'));
        if (hasCsproj) {
          projects.push({
            name: path.basename(dir),
            relativePath,
            absolutePath: dir,
            lang: 'dotnet',
            vueProfile: null,
            dependencies: {},
            matchedLayer2Rules: [],
            frameworkLabel: '',
            uiLibLabels: [],
          });
          detected = true;
        }
      } catch {
        // 无法访问，跳过
      }
    }

    // 继续扫描子目录
    if (depth < 2) {
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        // 排除隐藏目录和已知无关目录
        if (entry.startsWith('.') || WORKSPACE_EXCLUDE_DIRS.has(entry)) continue;

        const childPath = path.join(dir, entry);
        try {
          const stat = fs.statSync(childPath);
          if (stat.isDirectory()) {
            scan(childPath, depth + 1);
          }
        } catch {
          // 无法访问的目录，跳过
        }
      }
    }
  }

  scan(targetDir, 0);

  if (projects.length >= MAX_SUB_PROJECTS) {
    logger.warn(`子项目数量已达上限 ${MAX_SUB_PROJECTS}，后续子项目被截断`);
  }

  const isWorkspace = projects.length > 1;

  if (isWorkspace) {
    logger.log(`发现 Workspace 模式：${projects.length} 个子项目`);
    for (const p of projects) {
      const label = [p.lang, p.frameworkLabel, ...p.uiLibLabels].filter(Boolean).join(' + ');
      logger.verbose(`  - ${p.relativePath} (${label || '无框架检测'})`);
    }
  }

  return {
    isWorkspace,
    rootDir: targetDir,
    projects,
    discoveredAt: new Date().toISOString(),
  };
}

// ============ 规则加载 ============

async function loadRuleFile(ctx: Readonly<Context>, logger: Logger, layerId: string, filePath: string): Promise<string> {
  if (ctx.isRemote) {
    const fileUrl = `${ctx.remoteBaseUrl}/rules/${layerId}/${filePath}`;
    try {
      return await fetchUrl(ctx, logger, fileUrl);
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
  /** 本地目标子目录，如 '.codebuddy/skills' 或 '.codebuddy/agents' */
  targetSubDir: string;
  /** 元数据文件名，如 'SKILL.md' 或 'AGENT.md' */
  metadataFileName: string;
  /** 解析元数据的函数 */
  parseMetadata: (entityId: string, content: string) => T | null;
  /** 日志标签，如 '技能' 或 'Agent' */
  label: string;
}

async function loadEntities<T>(
  ctx: Readonly<Context>,
  logger: Logger,
  sourcePath: string,
  options: LoadEntitiesOptions<T>
): Promise<T[]> {
  const entities: T[] = [];
  const localDir = path.join(process.cwd(), options.targetSubDir);

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  if (ctx.isRemote) {
    const files = ctx.remoteManifest!.files.filter(
      f => f.path.startsWith(options.manifestPrefix) && f.path.endsWith('.md')
    );

    for (const file of files) {
      const fileUrl = `${ctx.remoteBaseUrl}/${file.path}`;
      try {
        const content = await fetchUrl(ctx, logger, fileUrl);
        const relativePath = file.path.replace(options.manifestPrefix, '');
        const localPath = path.join(localDir, relativePath);
        const localDirPath = path.dirname(localPath);

        if (!fs.existsSync(localDirPath)) {
          fs.mkdirSync(localDirPath, { recursive: true });
        }
        fs.writeFileSync(localPath, content, 'utf-8');
        logger.verbose(`已下载${options.label}文件: ${relativePath}`);

        if (file.path.endsWith(options.metadataFileName)) {
          const entityId = relativePath.split('/')[0];
          const metadata = options.parseMetadata(entityId, content);
          if (metadata) entities.push(metadata);
        }
      } catch (e) {
        logger.warn(`${options.label}文件下载失败: ${file.path} - ${(e as Error).message}`);
      }
    }
  } else {
    const sourceDir = path.join(PROJECT_ROOT, sourcePath);
    if (fs.existsSync(sourceDir)) {
      copyRecursive(sourceDir, localDir);

      const entityDirs = fs.readdirSync(localDir).filter(f => {
        const fullPath = path.join(localDir, f);
        return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
      });

      for (const entityId of entityDirs) {
        const metadataFile = path.join(localDir, entityId, options.metadataFileName);
        if (fs.existsSync(metadataFile)) {
          const content = fs.readFileSync(metadataFile, 'utf-8');
          const metadata = options.parseMetadata(entityId, content);
          if (metadata) entities.push(metadata);
        }
      }
    }
  }

  return entities;
}

// ============ 技能系统 ============

async function loadSkills(ctx: Readonly<Context>, logger: Logger, skillsPath: string): Promise<SkillMetadata[]> {
  return loadEntities<SkillMetadata>(ctx, logger, skillsPath, {
    manifestPrefix: 'custom-skills/',
    targetSubDir: '.codebuddy/skills',
    metadataFileName: 'SKILL.md',
    parseMetadata: parseSkillMetadata,
    label: '技能',
  });
}

// ============ Agent 系统 ============

async function loadAgents(ctx: Readonly<Context>, logger: Logger, agentsPath: string): Promise<AgentMetadata[]> {
  return loadEntities<AgentMetadata>(ctx, logger, agentsPath, {
    manifestPrefix: 'agents/',
    targetSubDir: '.codebuddy/agents',
    metadataFileName: 'AGENT.md',
    parseMetadata: parseAgentMetadata,
    label: 'Agent',
  });
}

// ============ 脚本分发系统 ============

/**
 * 核心脚本（A 路线必需，默认分发）
 */
const CORE_SCRIPTS: Array<{ file: string; dependencies?: string[] }> = [
  {
    file: 'structure-analyzer.js',
    dependencies: ['types/structure-analyzer.js', 'types/reports.js', 'report-manager.js']
  },
  {
    file: 'module-mapper.js',
    dependencies: ['types/module-mapper.js', 'types/reports.js', 'report-manager.js']
  },
  {
    file: 'report-manager.js',
    dependencies: ['types/reports.js']
  },
  {
    file: 'rule-validator.js',
  },
  {
    file: 'skill-validator.js',
  },
];

/**
 * 可选脚本（B 路线，需要 --enable-orchestrator 启用）
 */
const OPTIONAL_SCRIPTS: Array<{ file: string; dependencies?: string[] }> = [
  {
    file: 'agent-registry.js',
  },
  {
    file: 'agent-call-manager.js',
  },
  {
    file: 'task-orchestrator.js',
  },
  {
    file: 'taskbook-manager.js',
    dependencies: ['types/index.js']
  },
  {
    file: 'task-executor.js',
    dependencies: ['types/index.js', 'types/agent-runtime.js', 'taskbook-manager.js', 'context-collector.js', 'reference-finder.js', 'agent-runtime.js']
  },
  {
    file: 'agent-runtime.js',
    dependencies: ['types/agent-runtime.js', 'types/index.js']
  },
  {
    file: 'contract-validator.js',
  },
  {
    file: 'reference-finder.js',
    dependencies: ['types/index.js']
  },
  {
    file: 'context-collector.js',
    dependencies: ['types/index.js', 'reference-finder.js']
  },
];

/**
 * 需要分发的命令文件列表
 */
const COMMANDS_TO_DISTRIBUTE: Array<{ sourcePath: string; destFile: string }> = [
  { sourcePath: '.claude/commands/task.md', destFile: 'task.md' },
  { sourcePath: '.claude/commands/agent-call.md', destFile: 'agent-call.md' },
];

/**
 * 需要分发的 Workflow 文件
 *
 * 说明：Workflow 用于描述“步骤依赖 + 产物 + 质量闸门 + 策略”，可作为 Agent 引导，也可被未来的执行引擎强制执行。
 *
 * 分发目标目录：{project}/.codebuddy/workflows/
 */
const WORKFLOWS_TO_DISTRIBUTE: Array<{ sourcePath: string; destFile: string }> = [
  { sourcePath: 'workflows/schema/workflow.schema.json', destFile: 'workflow.schema.json' },
  { sourcePath: 'workflows/templates/default.workflow.json', destFile: 'default.workflow.json' },
];

/**
 * 需要分发的 TaskBook 契约文件（JSON Schema）
 *
 * 分发目标目录：{project}/.codebuddy/taskbooks/
 */
const TASKBOOK_FILES_TO_DISTRIBUTE: Array<{ sourcePath: string; destFile: string }> = [
  { sourcePath: 'taskbooks/schema/taskbook.schema.json', destFile: 'taskbook.schema.json' },
];

/**
 * 需要分发的 Agent Call 契约（JSON Schema）
 *
 * 分发目标目录：{project}/.codebuddy/agent-calls/
 */
const AGENT_CALL_FILES_TO_DISTRIBUTE: Array<{ sourcePath: string; destFile: string }> = [
  { sourcePath: 'agent-calls/schema/agent-call.schema.json', destFile: 'agent-call.schema.json' },
];

/**
 * 分发可执行脚本到业务项目
 */
async function distributeScripts(ctx: Readonly<Context>, logger: Logger, targetDir: string): Promise<string[]> {
  const distributed: string[] = [];
  const localScriptsDir = path.join(targetDir, '.codebuddy/scripts');

  // 根据 enableOrchestrator 决定分发范围
  const scriptsToDistribute = ctx.enableOrchestrator
    ? [...CORE_SCRIPTS, ...OPTIONAL_SCRIPTS]
    : CORE_SCRIPTS;

  // 确保目录存在
  if (!fs.existsSync(localScriptsDir)) {
    fs.mkdirSync(localScriptsDir, { recursive: true });
  }

  if (ctx.isRemote) {
    // 远程模式：从远程下载脚本及其依赖
    for (const scriptInfo of scriptsToDistribute) {
      // 下载主脚本
      const scriptUrl = `${ctx.remoteBaseUrl}/scripts/dist/${scriptInfo.file}`;
      try {
        const content = await fetchUrl(ctx, logger, scriptUrl);
        const destPath = path.join(localScriptsDir, scriptInfo.file);
        fs.writeFileSync(destPath, content, 'utf-8');
        distributed.push(scriptInfo.file);
        logger.verbose(`已下载脚本: ${scriptInfo.file}`);

        // 下载依赖文件
        if (scriptInfo.dependencies) {
          for (const dep of scriptInfo.dependencies) {
            const depUrl = `${ctx.remoteBaseUrl}/scripts/dist/${dep}`;
            try {
              const depContent = await fetchUrl(ctx, logger, depUrl);
              const depDir = path.dirname(path.join(localScriptsDir, dep));
              if (!fs.existsSync(depDir)) {
                fs.mkdirSync(depDir, { recursive: true });
              }
              fs.writeFileSync(path.join(localScriptsDir, dep), depContent, 'utf-8');
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
    // 本地模式：从本地复制脚本及其依赖
    const sourceDir = path.join(PROJECT_ROOT, 'scripts/dist');
    for (const scriptInfo of scriptsToDistribute) {
      const srcPath = path.join(sourceDir, scriptInfo.file);
      if (fs.existsSync(srcPath)) {
        const destPath = path.join(localScriptsDir, scriptInfo.file);
        fs.copyFileSync(srcPath, destPath);
        distributed.push(scriptInfo.file);
        logger.verbose(`已复制脚本: ${scriptInfo.file}`);

        // 复制依赖文件
        if (scriptInfo.dependencies) {
          for (const dep of scriptInfo.dependencies) {
            const depSrc = path.join(sourceDir, dep);
            if (fs.existsSync(depSrc)) {
              const depDir = path.dirname(path.join(localScriptsDir, dep));
              if (!fs.existsSync(depDir)) {
                fs.mkdirSync(depDir, { recursive: true });
              }
              fs.copyFileSync(depSrc, path.join(localScriptsDir, dep));
              logger.verbose(`已复制依赖: ${dep}`);
            }
          }
        }
      } else {
        logger.warn(`脚本不存在: ${srcPath}`);
      }
    }
  }

  // 生成脚本使用说明
  if (distributed.length > 0) {
    const readmePath = path.join(localScriptsDir, 'README.md');
    fs.writeFileSync(readmePath, generateScriptsReadme(distributed), 'utf-8');
  }

  return distributed;
}

/**
 * 分发 Workflows 到业务项目
 */
async function distributeWorkflows(ctx: Readonly<Context>, logger: Logger, targetDir: string): Promise<string[]> {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: '.codebuddy/workflows',
    items: WORKFLOWS_TO_DISTRIBUTE,
    label: 'workflow',
    readme: [
      '# Workflows', '',
      '本目录包含工作流规范（Workflow Spec）。', '',
      '- `default.workflow.json`：默认单任务闭环工作流（分析→计划→实现→测试→审查→验收）。',
      '- `workflow.schema.json`：Workflow Spec 的 JSON Schema，用于校验/CI/MCP/多工具适配。', '',
      '说明：早期可将其作为 Agent 的执行约束与产物清单；后期可由 Task Executor 按步骤编排并强制执行 gates。', '',
    ].join('\n'),
  });
}

/**
 * 分发 TaskBooks 契约（Schema）到业务项目
 */
async function distributeTaskBooks(ctx: Readonly<Context>, logger: Logger, targetDir: string): Promise<string[]> {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: '.codebuddy/taskbooks',
    items: TASKBOOK_FILES_TO_DISTRIBUTE,
    label: 'taskbook contract',
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
async function distributeAgentCalls(ctx: Readonly<Context>, logger: Logger, targetDir: string): Promise<string[]> {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: '.codebuddy/agent-calls',
    items: AGENT_CALL_FILES_TO_DISTRIBUTE,
    label: 'agent-call contract',
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

async function distributeCommands(ctx: Readonly<Context>, logger: Logger, targetDir: string): Promise<string[]> {
  return distributeItems(ctx, logger, targetDir, PROJECT_ROOT, {
    targetSubDir: '.codebuddy/commands',
    items: COMMANDS_TO_DISTRIBUTE,
    label: '命令',
  });
}

// ============ .gitignore 更新 ============

function updateGitignore(logger: Logger, projectDir: string): void {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const entry = '.codebuddy/';

  try {
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
      if (content.includes(entry)) {
        return;
      }
    }

    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    content += `\n# CodeBuddy 生成文件\n${entry}\n`;

    fs.writeFileSync(gitignorePath, content, 'utf-8');
    logger.verbose('已更新 .gitignore');
  } catch (error) {
    logger.warn(`更新 .gitignore 失败: ${(error as Error).message}`);
  }
}

// ============ 参数解析 ============

function parseArgs(): Readonly<Context> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
  }

  let isVerbose = false;
  let isRemote = false;
  let remoteBaseUrl = '';
  let taskType: string | null = null;
  let relevanceThreshold = DEFAULT_THRESHOLD;
  let ruleLevel: Context['ruleLevel'] = DEFAULT_RULE_LEVEL;
  let requestTimeout = DEFAULT_TIMEOUT;
  let enableOrchestrator = false;
  let disableWorkspace = false;

  if (args.includes('--verbose') || args.includes('-v')) {
    isVerbose = true;
  }

  if (args.includes('--enable-orchestrator')) {
    enableOrchestrator = true;
  }

  if (args.includes('--no-workspace')) {
    disableWorkspace = true;
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
  if (ruleLevelIndex !== -1) {
    const value = (args[ruleLevelIndex + 1] || '').trim().toLowerCase();
    if (value === 'summary' || value === 'quick' || value === 'full') {
      ruleLevel = value as Context['ruleLevel'];
    } else if (value) {
      logError(`--rule-level 仅支持 summary|quick|full，当前: ${value}`);
      process.exit(1);
    }
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
    remoteManifest: null,
    requestTimeout,
    taskType,
    relevanceThreshold,
    ruleLevel,
    enableOrchestrator,
    disableWorkspace,
  };
}

// ============ 主函数 ============

async function main(): Promise<void> {
  const parsedCtx = parseArgs();
  const logger = createLogger(parsedCtx);

  // loadConfig 可能返回 manifest，需要合并到 ctx
  const { config, manifest } = await loadConfig(parsedCtx, logger);
  const ctx: Readonly<Context> = manifest
    ? { ...parsedCtx, remoteManifest: manifest }
    : parsedCtx;

  logger.log('CodeBuddy 规则加载器 v2.0 (三层架构 + 技能系统)');
  logger.log(ctx.isRemote ? `模式: 远程 (${ctx.remoteBaseUrl})` : '模式: 本地');
  if (ctx.enableOrchestrator) logger.log('编排模式: 完整（含 B 路线脚本和契约）');
  if (ctx.ruleLevel !== 'full') logger.log(`规则裁剪: ${ctx.ruleLevel}（仅影响 Layer1 Eager 内容；rules_cache 仍保留 full）`);

  if (ctx.taskType) {
    logger.log(`任务筛选: ${ctx.taskType} (阈值: ${ctx.relevanceThreshold})`);
  }

  const targetDir = process.cwd();
  logger.log(`目标项目: ${targetDir}`);

  // ============ Workspace 多项目发现 ============
  const workspaceInfo: WorkspaceInfo = ctx.disableWorkspace
    ? { isWorkspace: false, rootDir: targetDir, projects: [], discoveredAt: new Date().toISOString() }
    : discoverWorkspace(logger, targetDir);

  if (ctx.disableWorkspace) {
    logger.verbose('Workspace 发现已禁用（--no-workspace）');
  } else if (workspaceInfo.isWorkspace) {
    logger.log(`Workspace 模式: ${workspaceInfo.projects.length} 个子项目`);
  } else {
    logger.verbose('单项目模式（未发现多个子项目）');
  }

  const { layers, skills: skillsConfig, output, frontmatter } = config;

  // 检测项目依赖（向后兼容：选择 primaryProject 作为 Layer1 基准）
  let pkg: PackageJson;
  let dependencies: Record<string, string>;
  let vueProfile: VueProfile | null;

  if (workspaceInfo.isWorkspace && workspaceInfo.projects.length > 0) {
    // Workspace 模式：选择第一个有 Vue 依赖的项目，否则取第一个
    const primaryProject =
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
  let finalContent = `---
description: ${frontmatter?.description || '前端架构规范 - CodeBuddy GLM-4.7 专用版'}
alwaysApply: ${frontmatter?.alwaysApply !== undefined ? frontmatter.alwaysApply : true}
enabled: ${frontmatter?.enabled !== undefined ? frontmatter.enabled : true}
updatedAt: ${updatedAt}
---

# 前端架构规范 (CodeBuddy 版)

> Generated by CodeBuddy Rule Loader v2.0
> Generated at: ${updatedAt}
> Vue Version: ${vueProfile ? `${vueProfile.version} (${vueProfile.type})` : 'Not detected'}

---

`;

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

  finalContent += `## ${layers.base?.title || 'Layer 1: 基础规范'}\n\n`;
  finalContent += `> 这些是本项目必须遵守的核心规范\n\n`;

  for (const rule of layer1Rules) {
    finalContent += `<!-- Source: ${rule.path} -->\n${rule.content}\n\n---\n\n`;
  }

  // ============ Layer 2: Business (Lazy Load - Index Only) ============
  logger.log('处理 Layer 2: 业务规范 (Lazy Load)...');

  const layer2Index: RuleIndexItem[] = [];
  const businessDeps = layers.business?.dependencies || {};

  for (const [depName, ruleFolders] of Object.entries(businessDeps)) {
    if (dependencies[depName]) {
      logger.log(`  检测到 ${depName}，添加规则索引`);
      for (const folder of ruleFolders) {
        layer2Index.push({
          dep: depName,
          rule: folder,
          path: `.codebuddy/rules_cache/layer2_business/${folder}.md`
        });

        // 缓存规则文件
        const cacheDir = path.join(targetDir, '.codebuddy/rules_cache/layer2_business');
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        const content = await loadRuleFile(ctx, logger, layers.business?.id || 'layer2_business', folder + '.md');
        if (content) {
          fs.writeFileSync(path.join(cacheDir, folder + '.md'), content, 'utf-8');
        }
      }
    }
  }

  // ============ Workspace: 为每个子项目匹配并缓存 Layer2 规则 ============
  if (workspaceInfo.isWorkspace) {
    logger.log('处理 Workspace 子项目 Layer2 规则...');
    for (const project of workspaceInfo.projects) {
      // 跳过根项目（已在上面处理）
      if (project.relativePath === '.') continue;

      for (const [depName, ruleFolders] of Object.entries(businessDeps)) {
        if (project.dependencies[depName]) {
          logger.verbose(`  ${project.name}: 检测到 ${depName}，添加规则索引`);
          for (const folder of ruleFolders) {
            project.matchedLayer2Rules.push({
              dep: depName,
              rule: folder,
              path: `.codebuddy/rules_cache/projects/${project.relativePath}/layer2_business/${folder}.md`,
            });

            // 缓存到子项目独立目录
            const projectCacheDir = path.join(
              targetDir,
              `.codebuddy/rules_cache/projects/${project.relativePath}/layer2_business`
            );
            if (!fs.existsSync(projectCacheDir)) {
              fs.mkdirSync(projectCacheDir, { recursive: true });
            }
            const content = await loadRuleFile(ctx, logger, layers.business?.id || 'layer2_business', folder + '.md');
            if (content) {
              fs.writeFileSync(path.join(projectCacheDir, folder + '.md'), content, 'utf-8');
            }
          }
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
      fs.writeFileSync(path.join(cacheDir, item + '.md'), content, 'utf-8');
    }
  }

  // ============ 生成规则索引表 ============
  if (layer2Index.length > 0 || layer3Index.length > 0) {
    finalContent += `## 📚 规则参考索引 (按需加载)\n\n`;
    finalContent += `> 以下规则包含具体的技术栈实现细节，请按需读取\n\n`;
    finalContent += `| 规则名称 | 本地路径 | 说明 |\n|---------|---------|------|\n`;

    for (const item of layer2Index) {
      finalContent += `| ${item.rule} | \`${item.path}\` | ${item.dep} 规范 |\n`;
    }
    for (const item of layer3Index) {
      finalContent += `| ${item.rule} | \`${item.path}\` | 任务检查清单 |\n`;
    }
    finalContent += '\n';
  }

  // ============ Workspace: 生成索引文件和提示词 ============
  if (workspaceInfo.isWorkspace) {
    // 生成 workspace-index.json
    const workspaceIndex: WorkspaceIndex = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      rootDir: targetDir,
      projectCount: workspaceInfo.projects.length,
      projects: workspaceInfo.projects.map(p => ({
        name: p.name,
        relativePath: p.relativePath,
        lang: p.lang,
        frameworkLabel: p.frameworkLabel,
        uiLibLabels: p.uiLibLabels,
        vueVersion: p.vueProfile?.version ?? null,
        layer2CachePath: p.relativePath === '.'
          ? '.codebuddy/rules_cache/layer2_business/'
          : `.codebuddy/rules_cache/projects/${p.relativePath}/layer2_business/`,
        matchedRules: p.matchedLayer2Rules.map(r => r.rule),
      })),
    };

    const workspaceIndexPath = path.join(targetDir, '.codebuddy/workspace-index.json');
    const workspaceIndexDir = path.dirname(workspaceIndexPath);
    if (!fs.existsSync(workspaceIndexDir)) {
      fs.mkdirSync(workspaceIndexDir, { recursive: true });
    }
    fs.writeFileSync(workspaceIndexPath, JSON.stringify(workspaceIndex, null, 2), 'utf-8');
    logger.log(`已生成 workspace-index.json (${workspaceInfo.projects.length} 个项目)`);

    // 注入 workspace 提示词
    finalContent += generateWorkspacePrompt(workspaceInfo);
  }

  // ============ 规则激活提示词 ============
  finalContent += generateRuleActivationPrompt(config);

  // ============ 技能系统 ============
  if (skillsConfig?.enabled) {
    logger.log('加载技能系统...');
    const skills = await loadSkills(ctx, logger, skillsConfig.path || 'custom-skills');
    logger.log(`已加载 ${skills.length} 个技能`);
    finalContent += generateSkillsPrompt(skills);
  }

  // ============ Agent 系统 ============
  logger.log('加载 Agent 系统...');
  const agents = await loadAgents(ctx, logger, 'agents');
  if (agents.length > 0) {
    logger.log(`已加载 ${agents.length} 个 Agents`);
    finalContent += generateAgentsPrompt(agents);
  }

  // ============ 脚本分发 ============
  logger.log('分发工具脚本...');
  const distributedScripts = await distributeScripts(ctx, logger, targetDir);
  if (distributedScripts.length > 0) {
    logger.log(`已分发 ${distributedScripts.length} 个脚本`);
    finalContent += generateScriptsPrompt(distributedScripts);
  }

  // ============ Workflows 分发（B 路线，需 --enable-orchestrator） ============
  let distributedWorkflows: string[] = [];
  if (ctx.enableOrchestrator) {
    logger.log('分发 Workflows...');
    distributedWorkflows = await distributeWorkflows(ctx, logger, targetDir);
    if (distributedWorkflows.length > 0) {
      logger.log(`已分发 ${distributedWorkflows.length} 个工作流`);
      finalContent += generateWorkflowsPrompt(distributedWorkflows);
    }
  } else {
    logger.verbose('跳过 Workflows 分发（默认模式，使用 --enable-orchestrator 启用）');
  }

  // ============ TaskBooks 契约分发（B 路线，需 --enable-orchestrator） ============
  let distributedTaskBooks: string[] = [];
  if (ctx.enableOrchestrator) {
    logger.log('分发 TaskBook 契约...');
    distributedTaskBooks = await distributeTaskBooks(ctx, logger, targetDir);
    if (distributedTaskBooks.length > 0) {
      logger.log(`已分发 ${distributedTaskBooks.length} 个 TaskBook 契约文件`);
      finalContent += generateTaskBooksPrompt(distributedTaskBooks);
    }
  } else {
    logger.verbose('跳过 TaskBook 契约分发（默认模式，使用 --enable-orchestrator 启用）');
  }

  // ============ Agent Calls 契约分发（B 路线，需 --enable-orchestrator） ============
  let distributedAgentCalls: string[] = [];
  if (ctx.enableOrchestrator) {
    logger.log('分发 Agent Call 契约...');
    distributedAgentCalls = await distributeAgentCalls(ctx, logger, targetDir);
    if (distributedAgentCalls.length > 0) {
      logger.log(`已分发 ${distributedAgentCalls.length} 个 Agent Call 契约文件`);
      finalContent += generateAgentCallsPrompt(distributedAgentCalls);
    }
  } else {
    logger.verbose('跳过 Agent Call 契约分发（默认模式，使用 --enable-orchestrator 启用）');
  }

  // ============ 命令分发 ============
  logger.log('分发 Slash Commands...');
  const distributedCommands = await distributeCommands(ctx, logger, targetDir);
  if (distributedCommands.length > 0) {
    logger.log(`已分发 ${distributedCommands.length} 个命令`);
    finalContent += generateCommandsPrompt(distributedCommands);
  }

  // ============ 输出文件 ============
  const outputDir = path.join(targetDir, output?.dirName || '.codebuddy/rules');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, output?.fileName || 'project-rules.md');
  fs.writeFileSync(outputPath, finalContent, 'utf-8');

  // 更新 .gitignore
  updateGitignore(logger, targetDir);

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
  if (workspaceInfo.isWorkspace) {
    logger.log(`   Workspace 子项目: ${workspaceInfo.projects.length} 个`);
    for (const p of workspaceInfo.projects) {
      const rules = p.matchedLayer2Rules.map(r => r.rule).join(', ') || '无';
      logger.log(`     - ${p.name} (${p.relativePath}): ${p.frameworkLabel || '无框架'} | 规则: ${rules}`);
    }
  }
  logger.log('═══════════════════════════════════════════════════════════════════');
}

main().catch((err: Error) => {
  logError(`Fatal Error: ${err.message}`);
  process.exit(1);
});
