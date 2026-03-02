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

  if (args.includes('--verbose') || args.includes('-v')) {
    isVerbose = true;
  }

  if (args.includes('--enable-orchestrator')) {
    enableOrchestrator = true;
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

  const { layers, skills: skillsConfig, output, frontmatter } = config;

  // 检测项目依赖
  const pkg = getPackageJson(logger, targetDir);
  const dependencies: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
  const vueProfile = checkVueProfile(dependencies);

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
  logger.log('═══════════════════════════════════════════════════════════════════');
}

main().catch((err: Error) => {
  logError(`Fatal Error: ${err.message}`);
  process.exit(1);
});
