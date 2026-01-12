#!/usr/bin/env node
/**
 * Architect Rule Loader Script V7 (TypeScript Version)
 *
 * Features:
 * - Supports Remote Fetch Mode via --remote <URL>
 * - Task-aware progressive disclosure via --task <type>
 * - Async architecture
 * - Enhanced error handling and user-friendly messages
 * - Verbose mode for debugging
 * - Request timeout handling
 * - Full TypeScript type safety
 *
 * Usage:
 *   node rule-loader.js [options]
 *
 * Options:
 *   --help, -h        Show this help message
 *   --remote <URL>    Fetch rules from remote URL
 *   --task <type>     Filter rules by task type (progressive disclosure)
 *   --threshold <n>   Set relevance threshold (0-1, default: 0.5)
 *   --verbose, -v     Enable verbose logging for debugging
 *   --timeout <ms>    Set network request timeout in milliseconds (default: 10000)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import type {
  Manifest,
  RawLoaderConfig,
  LoaderConfig,
  VueProfile,
  PackageJson,
  LoaderContext,
  TasksConfig,
  DetailLevel,
  DetailLevelsConfig,
  SkillsConfig,
  Skill,
} from './types';

// --- 路径配置 ---
const RULES_ROOT = path.resolve(__dirname, '../../rules');
const CONFIG_PATH = path.resolve(__dirname, '../../config/loader-config.json');
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_DETAIL_LEVEL: DetailLevel = 'full';

// --- 全局上下文 ---
const ctx: LoaderContext = {
  isRemote: false,
  isVerbose: false,
  remoteBaseUrl: '',
  remoteManifest: null,
  requestTimeout: DEFAULT_TIMEOUT,
  taskType: null,
  relevanceThreshold: DEFAULT_THRESHOLD,
  detailLevel: DEFAULT_DETAIL_LEVEL,
};

// --- 全局配置缓存 ---
let tasksConfig: TasksConfig | null = null;
let detailLevelsConfig: DetailLevelsConfig | null = null;
let skillsConfig: SkillsConfig | null = null;

// ============ 日志工具 ============

function log(message: string): void {
  console.log(`[Architect] ${message}`);
}

function logVerbose(message: string): void {
  if (ctx.isVerbose) {
    console.log(`[Architect:DEBUG] ${message}`);
  }
}

function logError(message: string): void {
  console.error(`[Architect:ERROR] ${message}`);
}

function logWarn(message: string): void {
  console.warn(`[Architect:WARN] ${message}`);
}

// ============ 帮助信息 ============

function showHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║      Architect Rule Loader v7 - Progressive Disclosure           ║
╚══════════════════════════════════════════════════════════════════╝

USAGE:
  node rule-loader.js [options]

OPTIONS:
  --help, -h           Show this help message and exit
  --remote <URL>       Fetch rules from a remote URL instead of local files
  --task <type>        Filter rules by task type (progressive disclosure)
                       Types: refactoring, debugging, testing, new-feature, code-review
  --threshold <n>      Set relevance threshold (0-1, default: 0.5)
                       Use 0.7 for strict filtering, 0.3 for loose filtering
  --detail-level <l>   Set content detail level (default: full)
                       Levels: summary, quick, full
  --verbose, -v        Enable verbose/debug logging
  --timeout <ms>       Set network request timeout (default: 10000ms)

TASK TYPES:
  refactoring          Code refactoring, optimization, tech debt cleanup
  debugging            Bug fixing, troubleshooting, error handling
  testing              Writing tests, test strategy, coverage
  new-feature          Developing new features, adding functionality
  code-review          Code review, PR review

DETAIL LEVELS:
  summary              Only rule summaries (minimal context)
  quick                Summaries + quick reference (daily use)
  full                 Complete content (default, for deep learning)

EXAMPLES:
  # Load all rules (default)
  node rule-loader.js

  # Load only refactoring-relevant rules
  node rule-loader.js --task refactoring

  # Strict filtering for debugging task
  node rule-loader.js --task debugging --threshold 0.7

  # Load quick reference only
  node rule-loader.js --detail-level quick

  # Remote mode with task filtering and quick reference
  node rule-loader.js --remote https://example.com/standards --task new-feature --detail-level quick

OUTPUT:
  Generates .codebuddy/.rules/project-rules.md in the current working directory.
`);
  process.exit(0);
}

// ============ 网络请求 ============

function fetchUrl(url: string, retries: number = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    logVerbose(`Fetching: ${url} (Retries left: ${retries})`);

    const request = client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        logVerbose(`Redirecting to: ${res.headers.location}`);
        fetchUrl(res.headers.location, retries).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        if (res.statusCode && res.statusCode >= 500 && retries > 0) {
          res.resume();
          logWarn(`HTTP ${res.statusCode}. Retrying...`);
          setTimeout(() => {
            fetchUrl(url, retries - 1).then(resolve).catch(reject);
          }, 1000);
          return;
        }

        res.resume();
        reject(new Error(`HTTP ${res.statusCode}: Failed to fetch ${url}`));
        return;
      }

      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        logVerbose(`Fetched ${data.length} bytes from ${url}`);
        resolve(data);
      });
    });

    request.on('error', (e: NodeJS.ErrnoException) => {
      if (retries > 0) {
        logWarn(`Network Error (${e.code}). Retrying...`);
        setTimeout(() => {
          fetchUrl(url, retries - 1).then(resolve).catch(reject);
        }, 1000);
        return;
      }

      if (e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
        logError(`Connection failed: ${e.code}`);
        logError('If you are in a restricted network region, please try using a proxy or mirror URL.');
      }
      reject(new Error(`Network Error: ${e.message} (URL: ${url})`));
    });

    request.setTimeout(ctx.requestTimeout, () => {
      request.destroy();
      if (retries > 0) {
        logWarn(`Request Timeout. Retrying...`);
        setTimeout(() => {
          fetchUrl(url, retries - 1).then(resolve).catch(reject);
        }, 1000);
        return;
      }
      reject(new Error(`Request Timeout: ${url} did not respond within ${ctx.requestTimeout}ms`));
    });
  });
}

// ============ 任务相关性检查 ============

/**
 * 解析任务类型（支持别名）
 */
function resolveTaskType(input: string): string | null {
  if (!tasksConfig) return null;

  const normalized = input.toLowerCase().trim();

  // 直接匹配
  if (tasksConfig.definitions[normalized]) {
    return normalized;
  }

  // 别名匹配
  for (const [taskId, def] of Object.entries(tasksConfig.definitions)) {
    if (def.aliases.includes(normalized)) {
      return taskId;
    }
  }

  return null;
}

/**
 * 获取规则的任务相关性分数
 */
function getRuleRelevance(layerId: string, ruleId: string, taskType: string): number {
  if (!tasksConfig || !taskType) return 1.0; // 无任务筛选时，所有规则都加载

  const layerRelevance = tasksConfig.ruleRelevance[layerId as keyof typeof tasksConfig.ruleRelevance];
  if (!layerRelevance) return DEFAULT_THRESHOLD; // 未配置的层级使用默认阈值

  const ruleRelevance = layerRelevance[ruleId];
  if (!ruleRelevance) return DEFAULT_THRESHOLD; // 未配置的规则使用默认阈值

  return ruleRelevance[taskType] ?? DEFAULT_THRESHOLD;
}

/**
 * 检查规则是否应该加载
 */
function shouldLoadRule(layerId: string, ruleId: string): boolean {
  if (!ctx.taskType) return true; // 无任务筛选时，加载所有规则

  const relevance = getRuleRelevance(layerId, ruleId, ctx.taskType);
  const shouldLoad = relevance >= ctx.relevanceThreshold;

  logVerbose(`Rule ${layerId}/${ruleId}: relevance=${relevance.toFixed(2)}, threshold=${ctx.relevanceThreshold}, load=${shouldLoad}`);

  return shouldLoad;
}

// ============ 详略级别内容解析 ============

/**
 * 根据详略级别提取规则内容
 * 使用 <!-- @level:xxx --> 标记分隔不同级别的内容
 */
function extractContentByLevel(content: string, level: DetailLevel): string {
  // 如果是 full 级别，返回完整内容
  if (level === 'full') {
    return content;
  }

  // 定义各级别包含的标记
  const levelMarkers: Record<DetailLevel, string[]> = {
    summary: ['@level:summary'],
    quick: ['@level:summary', '@level:quick'],
    full: ['@level:summary', '@level:quick', '@level:full'],
  };

  const allowedMarkers = levelMarkers[level];

  // 解析内容，提取标记区块
  const markerRegex = /<!--\s*(@level:\w+)\s*-->/g;
  const sections: Array<{ marker: string; content: string }> = [];

  let lastIndex = 0;
  let lastMarker = '@level:full'; // 默认未标记的内容视为 full 级别
  let match: RegExpExecArray | null;

  // 查找所有标记位置
  const markers: Array<{ marker: string; index: number }> = [];
  while ((match = markerRegex.exec(content)) !== null) {
    markers.push({ marker: match[1], index: match.index });
  }

  // 如果没有任何标记，根据级别决定是否返回内容
  if (markers.length === 0) {
    // 无标记的文件，返回全部内容（向后兼容）
    logVerbose(`No level markers found in content, returning full content`);
    return content;
  }

  // 提取标记前的内容（视为 summary）
  if (markers[0].index > 0) {
    const preContent = content.substring(0, markers[0].index).trim();
    if (preContent) {
      sections.push({ marker: '@level:summary', content: preContent });
    }
  }

  // 提取各标记区块
  for (let i = 0; i < markers.length; i++) {
    const currentMarker = markers[i];
    const nextMarker = markers[i + 1];

    // 计算当前区块的起始位置（跳过标记本身）
    const markerEndMatch = content.substring(currentMarker.index).match(/<!--\s*@level:\w+\s*-->/);
    const markerLength = markerEndMatch ? markerEndMatch[0].length : 0;
    const startIndex = currentMarker.index + markerLength;

    // 计算当前区块的结束位置
    const endIndex = nextMarker ? nextMarker.index : content.length;

    const sectionContent = content.substring(startIndex, endIndex).trim();
    if (sectionContent) {
      sections.push({ marker: currentMarker.marker, content: sectionContent });
    }
  }

  // 根据允许的标记过滤内容
  const filteredSections = sections.filter((section) =>
    allowedMarkers.includes(section.marker)
  );

  if (filteredSections.length === 0) {
    logVerbose(`No content found for level: ${level}`);
    return '';
  }

  // 合并过滤后的内容
  const result = filteredSections.map((s) => s.content).join('\n\n');
  logVerbose(`Extracted ${filteredSections.length} sections for level: ${level}`);

  return result;
}

// ============ Skills 系统函数 ============

/**
 * 解析 YAML frontmatter
 * 支持有引号和无引号两种格式
 */
function parseYamlFrontmatter(content: string): { name: string; description: string } | null {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);

  if (!match) return null;

  const frontmatterText = match[1];
  const nameMatch = frontmatterText.match(/^name:\s*(.+)$/m);

  // 支持有引号和无引号两种格式
  let descMatch = frontmatterText.match(/^description:\s*["'](.+)["']$/m);
  if (!descMatch) {
    descMatch = frontmatterText.match(/^description:\s*(.+)$/m);
  }

  if (!nameMatch || !descMatch) return null;

  return {
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
  };
}

/**
 * 解析单个 SKILL.md 文件
 */
function parseSkillFile(skillId: string, content: string): Skill | null {
  const frontmatter = parseYamlFrontmatter(content);

  if (!frontmatter) {
    logWarn(`Failed to parse frontmatter for skill: ${skillId}`);
    return null;
  }

  // 移除 frontmatter，保留 markdown 内容
  const contentWithoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

  return {
    metadata: {
      id: skillId,
      name: frontmatter.name,
      description: frontmatter.description,
    },
    content: contentWithoutFrontmatter,
  };
}

/**
 * 加载所有技能
 */
async function loadSkills(skillsPath: string): Promise<Skill[]> {
  const skills: Skill[] = [];

  if (ctx.isRemote) {
    // 远程模式：从 manifest 中查找 custom-skills 目录下的 SKILL.md 文件
    const skillFiles = ctx.remoteManifest!.files.filter(
      (f) => f.path.startsWith(skillsPath) && f.path.endsWith('/SKILL.md')
    );

    for (const file of skillFiles) {
      const skillId = file.path.split('/')[1]; // 提取技能 ID（文件夹名）
      const fileUrl = `${ctx.remoteBaseUrl}/${file.path}`;

      try {
        const content = await fetchUrl(fileUrl);
        const skill = parseSkillFile(skillId, content);
        if (skill) {
          skills.push(skill);
          logVerbose(`Loaded skill: ${skillId}`);
        }
      } catch (e) {
        logWarn(`Failed to load skill: ${skillId}`);
      }
    }
  } else {
    // 本地模式：读取 custom-skills 目录
    const skillsDir = path.resolve(__dirname, '../../', skillsPath);

    if (!fs.existsSync(skillsDir)) {
      logWarn(`Skills directory not found: ${skillsDir}`);
      return skills;
    }

    const skillDirs = fs.readdirSync(skillsDir).filter((name) => {
      const fullPath = path.join(skillsDir, name);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const skillId of skillDirs) {
      const skillFile = path.join(skillsDir, skillId, 'SKILL.md');

      if (!fs.existsSync(skillFile)) {
        logVerbose(`Skipping ${skillId}: no SKILL.md found`);
        continue;
      }

      try {
        const content = fs.readFileSync(skillFile, 'utf-8');
        const skill = parseSkillFile(skillId, content);
        if (skill) {
          skills.push(skill);
          logVerbose(`Loaded skill: ${skillId}`);
        }
      } catch (e) {
        logWarn(`Failed to load skill: ${skillId}`);
      }
    }
  }

  return skills;
}

/**
 * 生成技能激活提示词
 */
function generateSkillsActivationPrompt(skills: Skill[]): string {
  if (skills.length === 0) {
    return '';
  }

  // 生成技能列表表格
  let skillsTable = '| 技能名称 | 技能 ID | 触发条件 |\n|---------|---------|----------|\n';
  for (const skill of skills) {
    skillsTable += `| **${skill.metadata.name}** | \`${skill.metadata.id}\` | ${skill.metadata.description} |\n`;
  }

  // 生成技能详情章节
  let skillsDetails = '';
  for (const skill of skills) {
    skillsDetails += `\n## ${skill.metadata.name} (\`${skill.metadata.id}\`)\n\n`;
    skillsDetails += `**触发条件**：${skill.metadata.description}\n\n`;
    skillsDetails += `**详细指南**：\n\n`;
    skillsDetails += skill.content;
    skillsDetails += '\n\n---\n';
  }

  return `

# 🎯 智能技能激活系统

## 技能检测和激活指南

作为 AI 编程助手，你需要根据用户的请求内容，**动态激活**相关的技能。这个系统模拟了 Claude Code + Skills 的动态激活能力。

### 📋 可用技能列表

${skillsTable}

### ⚡ 技能激活原则

1. **关键词匹配**：根据用户请求中的关键词，识别相关技能
2. **上下文理解**：结合用户的上下文（文件类型、任务类型等）判断
3. **主动应用**：识别到相关技能后，主动按照技能指南执行
4. **显式说明**：在回复中简要说明你应用了哪个技能

### 📌 使用示例

**场景 1：代码审查**

用户："审查这段代码，看看有什么问题"

你的思考过程：
1. 识别关键词：审查、代码
2. 激活技能：frontend-code-review
3. 按照技能指南执行审查流程

你的回复："我将按照前端代码审查技能的检查清单来审查这段代码..."

---

**场景 2：组件重构**

用户："这个组件太复杂了，帮我重构一下"

你的思考过程：
1. 识别关键词：复杂、重构
2. 激活技能：component-refactoring
3. 按照技能指南执行重构流程

你的回复："我将按照组件重构技能的模式来重构这个组件..."

---

**场景 3：测试编写**

用户："为这个组件添加测试"

你的思考过程：
1. 识别关键词：测试
2. 激活技能：frontend-testing
3. 按照技能指南执行测试编写流程

你的回复："我将按照前端测试技能的规范来编写测试..."

### ⚠️ 重要提醒

- **不要机械应用**：根据实际情况灵活应用技能
- **保持灵活性**：如果用户有特殊要求，优先遵循用户意图
- **持续学习**：根据用户反馈调整技能应用策略

---

# 📚 技能详情

${skillsDetails}
`;
}

// ============ 配置加载 ============

async function loadConfig(): Promise<LoaderConfig> {
  if (ctx.isRemote) {
    try {
      const manifestUrl = `${ctx.remoteBaseUrl}/manifest.json`;
      log(`Fetching manifest from: ${manifestUrl}`);
      const data = await fetchUrl(manifestUrl);
      ctx.remoteManifest = JSON.parse(data) as Manifest;

      logVerbose(
        `Manifest loaded. Version: ${ctx.remoteManifest.version}, Files: ${ctx.remoteManifest.files.length}`
      );

      const config = ctx.remoteManifest.config;
      tasksConfig = config.tasks || null;
      detailLevelsConfig = config.detailLevels || null;
      skillsConfig = config.skills || null;

      return {
        LAYERS: {
          BASE: config.layers.base,
          BUSINESS: config.layers.business,
          ACTION: config.layers.action,
        },
        TASKS: tasksConfig,
        DETAIL_LEVELS: detailLevelsConfig,
        SKILLS: skillsConfig,
        OUTPUT_DIR_NAME: config.output.dirName,
        OUTPUT_FILE_NAME: config.output.fileName,
        FRONTMATTER: config.frontmatter || {},
      };
    } catch (e) {
      const error = e as Error;
      logError(`Failed to fetch remote manifest: ${error.message}`);
      logError('Please ensure the URL is correct and the manifest.json is accessible.');
      process.exit(1);
    }
  } else {
    if (!fs.existsSync(CONFIG_PATH)) {
      logError(`Config file not found: ${CONFIG_PATH}`);
      logError('Run this script from the my-fe-standards repository root, or use --remote mode.');
      process.exit(1);
    }
    logVerbose(`Loading local config from: ${CONFIG_PATH}`);
    const config: RawLoaderConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    tasksConfig = config.tasks || null;
    detailLevelsConfig = config.detailLevels || null;
    skillsConfig = config.skills || null;

    return {
      LAYERS: {
        BASE: config.layers.base,
        BUSINESS: config.layers.business,
        ACTION: config.layers.action,
      },
      TASKS: tasksConfig,
      DETAIL_LEVELS: detailLevelsConfig,
      SKILLS: skillsConfig,
      OUTPUT_DIR_NAME: config.output.dirName,
      OUTPUT_FILE_NAME: config.output.fileName,
      FRONTMATTER: config.frontmatter || {},
    };
  }
}

// ============ 规则加载 ============

async function loadRulesFromFolder(
  layerDir: string,
  subFolder: string,
  layerId: string
): Promise<string[]> {
  // 提取规则 ID 用于相关性检查
  const ruleId = subFolder.replace(/\.md$/, '');

  // 检查是否应该加载此规则
  if (!shouldLoadRule(layerId, ruleId)) {
    logVerbose(`Skipping rule: ${layerId}/${ruleId} (below threshold)`);
    return [];
  }

  if (ctx.isRemote) {
    const targetPathStart = `rules/${layerDir}/${subFolder}`;
    const matches = ctx.remoteManifest!.files.filter((f) => f.path.startsWith(targetPathStart));

    if (matches.length === 0) return [];

    const contentPromises = matches.map(async (file) => {
      const fileUrl = `${ctx.remoteBaseUrl}/${file.path}`;
      try {
        const sourceLabel = file.path.split('/').slice(-2).join('/');
        const rawContent = await fetchUrl(fileUrl);
        const filteredContent = extractContentByLevel(rawContent, ctx.detailLevel);
        if (!filteredContent) return '';
        return `\n<!-- Source: ${sourceLabel} -->\n${filteredContent}`;
      } catch (e) {
        console.warn(`[Architect] Warning: Failed to fetch ${fileUrl}`);
        return '';
      }
    });

    return Promise.all(contentPromises);
  } else {
    const targetPath = path.join(layerDir, subFolder);
    if (!fs.existsSync(targetPath)) return [];

    if (targetPath.endsWith('.md')) {
      const rawContent = fs.readFileSync(targetPath, 'utf-8');
      const filteredContent = extractContentByLevel(rawContent, ctx.detailLevel);
      if (!filteredContent) return [];
      return [`\n<!-- Source: ${subFolder} -->\n${filteredContent}`];
    }

    if (fs.statSync(targetPath).isDirectory()) {
      const files = fs.readdirSync(targetPath);
      return files
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
          const rawContent = fs.readFileSync(path.join(targetPath, f), 'utf-8');
          const filteredContent = extractContentByLevel(rawContent, ctx.detailLevel);
          if (!filteredContent) return '';
          return `\n<!-- Source: ${subFolder}/${f} -->\n${filteredContent}`;
        })
        .filter((content) => content !== '');
    }
    return [];
  }
}

// ============ 辅助函数 ============

function getPackageJson(targetDir: string): PackageJson {
  const pkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    logWarn(`No package.json found at: ${pkgPath}`);
    logWarn('Running without dependency detection. Only default rules will be loaded.');
    return {};
  }
  logVerbose(`Reading package.json from: ${pkgPath}`);
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageJson;
  } catch (e) {
    const error = e as Error;
    logError(`Failed to parse package.json: ${error.message}`);
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

async function getSystemPrompt(targetDir: string, localRulesRoot: string): Promise<string> {
  if (ctx.isRemote) {
    return '';
  } else {
    const contextPath = path.join(localRulesRoot, '..', '.codebuddy', 'context.md');
    if (fs.existsSync(contextPath)) {
      console.log('[Architect] Loaded context.md as System Prompt.');
      return fs.readFileSync(contextPath, 'utf-8');
    }
    return '';
  }
}

// ============ 智能规则激活提示词生成 ============

/**
 * 生成智能规则激活提示词
 * 指导 AI 模型根据任务类型动态激活相关规则
 */
function generateSmartActivationPrompt(): string {
  if (!tasksConfig) {
    return ''; // 无任务配置时不生成激活提示词
  }

  const taskDefinitions = tasksConfig.definitions;
  const ruleRelevance = tasksConfig.ruleRelevance;

  // 生成任务类型识别表格
  let taskRecognitionTable = '| 任务类型 | 关键词 | 典型场景 |\n|---------|--------|----------|\n';
  for (const [taskId, def] of Object.entries(taskDefinitions)) {
    const keywords = def.aliases.join('、');
    const examples = getTaskExamples(taskId);
    taskRecognitionTable += `| **${def.name} (${taskId})** | ${keywords} | ${examples} |\n`;
  }

  // 生成规则激活策略
  let activationStrategies = '';
  for (const [taskId, def] of Object.entries(taskDefinitions)) {
    const relevantRules = getRelevantRulesForTask(taskId, ruleRelevance);
    activationStrategies += generateTaskActivationStrategy(taskId, def.name, relevantRules);
  }

  return `

# 🎯 智能规则激活系统

## 任务检测和规则激活指南

作为 AI 编程助手，你需要根据用户的请求类型，**动态激活**相关的规则集。这个系统模拟了 Claude Code + Skills 的动态激活能力。

### 📋 任务类型识别

请根据用户请求中的关键词和上下文，识别任务类型：

${taskRecognitionTable}

### ⚡ 规则激活策略

根据识别的任务类型，**重点参考**以下规则集：

${activationStrategies}

### 🧠 智能应用原则

1. **上下文优先**：如果用户明确提到某个技术栈或框架，优先应用相关规则
2. **渐进式应用**：先应用高相关性规则（≥0.8），再根据需要参考中等相关性规则（0.5-0.8）
3. **灵活调整**：如果用户的请求跨越多个任务类型，综合应用相关规则
4. **显式说明**：在回复中简要说明你应用了哪些规则，增强透明度

### 📌 示例对话

**场景 1：重构任务**

用户："重构这个组件，使用 Composition API"

你的思考过程：
1. 识别任务类型：重构 (refactoring)
2. 激活规则：architecture/feature-based-structure (0.9)、vue3/vue3-script-setup (0.9)、refactoring checklist (1.0)
3. 重点关注：组件结构、Composition API 最佳实践、重构步骤

你的回复："我将按照 Vue 3 Composition API 最佳实践和重构检查清单来重构这个组件..."

---

**场景 2：调试任务**

用户："这个函数报错了，帮我看看"

你的思考过程：
1. 识别任务类型：调试 (debugging)
2. 激活规则：debugging checklist (1.0)、typescript/strict-types (0.7)
3. 重点关注：错误排查步骤、类型安全检查

你的回复："让我按照调试检查清单来排查这个错误..."

---

**场景 3：新功能开发**

用户："实现一个用户登录表单"

你的思考过程：
1. 识别任务类型：新功能 (new-feature)
2. 激活规则：architecture (0.95)、vue3/vue3-script-setup (0.95)、typescript (0.9)、业务规则 (0.95)
3. 重点关注：架构设计、组件实现、类型定义、UI 组件库使用

你的回复："我将按照 Feature-Based 架构和 Vue 3 最佳实践来实现这个登录表单..."

### ⚠️ 重要提醒

- **不要机械应用所有规则**：根据任务类型选择性应用，避免信息过载
- **保持灵活性**：用户的需求可能不完全符合某个任务类型，根据实际情况调整
- **优先用户意图**：如果用户明确要求某种方式，优先遵循用户意图而非规则
- **持续学习**：根据用户反馈调整规则应用策略

---
`;
}

/**
 * 获取任务的典型场景示例
 */
function getTaskExamples(taskId: string): string {
  const examples: Record<string, string> = {
    'refactoring': '"重构这个组件"、"优化代码结构"',
    'debugging': '"修复这个 bug"、"为什么报错"',
    'testing': '"添加测试"、"如何测试这个功能"',
    'new-feature': '"实现登录功能"、"添加搜索"',
    'code-review': '"审查这段代码"、"有什么问题"',
  };
  return examples[taskId] || '相关开发任务';
}

/**
 * 获取任务的相关规则列表
 */
function getRelevantRulesForTask(
  taskId: string,
  ruleRelevance: Record<string, Record<string, Record<string, number>>>
): Array<{ layer: string; rule: string; relevance: number }> {
  const relevantRules: Array<{ layer: string; rule: string; relevance: number }> = [];

  for (const [layerId, layerRules] of Object.entries(ruleRelevance)) {
    for (const [ruleId, taskRelevances] of Object.entries(layerRules)) {
      const relevance = taskRelevances[taskId];
      if (relevance !== undefined && relevance >= 0.5) {
        relevantRules.push({ layer: layerId, rule: ruleId, relevance });
      }
    }
  }

  // 按相关性降序排序
  relevantRules.sort((a, b) => b.relevance - a.relevance);

  return relevantRules;
}

/**
 * 生成单个任务的激活策略
 */
function generateTaskActivationStrategy(
  taskId: string,
  taskName: string,
  relevantRules: Array<{ layer: string; rule: string; relevance: number }>
): string {
  if (relevantRules.length === 0) {
    return '';
  }

  // 分类规则：高相关性（≥0.8）、中等相关性（0.5-0.8）
  const highRelevance = relevantRules.filter((r) => r.relevance >= 0.8);
  const mediumRelevance = relevantRules.filter((r) => r.relevance >= 0.5 && r.relevance < 0.8);

  let strategy = `#### ${taskName} (${taskId})\n\n`;

  if (highRelevance.length > 0) {
    strategy += '**🔥 必读规则**（相关性 ≥ 0.8）：\n';
    for (const rule of highRelevance.slice(0, 5)) {
      // 最多显示 5 个
      strategy += `- ${formatRuleName(rule.layer, rule.rule)} (${rule.relevance.toFixed(2)})\n`;
    }
    strategy += '\n';
  }

  if (mediumRelevance.length > 0) {
    strategy += '**⭐ 参考规则**（相关性 0.5-0.8）：\n';
    for (const rule of mediumRelevance.slice(0, 3)) {
      // 最多显示 3 个
      strategy += `- ${formatRuleName(rule.layer, rule.rule)} (${rule.relevance.toFixed(2)})\n`;
    }
    strategy += '\n';
  }

  return strategy;
}

/**
 * 格式化规则名称
 */
function formatRuleName(layerId: string, ruleId: string): string {
  const layerNames: Record<string, string> = {
    layer1_base: 'Layer 1',
    layer2_business: 'Layer 2',
    layer3_action: 'Layer 3',
  };
  const layerName = layerNames[layerId] || layerId;
  return `${layerName}: ${ruleId}`;
}

// ============ 参数解析 ============

function parseArgs(): void {
  const args = process.argv.slice(2);

  // Help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
  }

  // Verbose
  if (args.includes('--verbose') || args.includes('-v')) {
    ctx.isVerbose = true;
    logVerbose('Verbose mode enabled.');
  }

  // Remote
  const remoteIndex = args.indexOf('--remote');
  if (remoteIndex !== -1) {
    const url = args[remoteIndex + 1];
    if (!url || url.startsWith('-')) {
      logError('--remote requires a URL argument.');
      process.exit(1);
    }
    ctx.isRemote = true;
    ctx.remoteBaseUrl = url.replace(/\/$/, '');
    logVerbose(`Remote mode enabled. Base URL: ${ctx.remoteBaseUrl}`);
  }

  // Task
  const taskIndex = args.indexOf('--task');
  if (taskIndex !== -1) {
    const taskInput = args[taskIndex + 1];
    if (!taskInput || taskInput.startsWith('-')) {
      logError('--task requires a task type argument.');
      logError('Available types: refactoring, debugging, testing, new-feature, code-review');
      process.exit(1);
    }
    ctx.taskType = taskInput.toLowerCase().trim();
    logVerbose(`Task mode enabled. Task type: ${ctx.taskType}`);
  }

  // Threshold
  const thresholdIndex = args.indexOf('--threshold');
  if (thresholdIndex !== -1) {
    const thresholdValue = parseFloat(args[thresholdIndex + 1]);
    if (isNaN(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) {
      logWarn('Invalid --threshold value (must be 0-1), using default 0.5.');
    } else {
      ctx.relevanceThreshold = thresholdValue;
      logVerbose(`Relevance threshold set to: ${ctx.relevanceThreshold}`);
    }
  }

  // Timeout
  const timeoutIndex = args.indexOf('--timeout');
  if (timeoutIndex !== -1) {
    const timeoutValue = parseInt(args[timeoutIndex + 1], 10);
    if (isNaN(timeoutValue) || timeoutValue <= 0) {
      logWarn('Invalid --timeout value, using default 10000ms.');
    } else {
      ctx.requestTimeout = timeoutValue;
      logVerbose(`Request timeout set to: ${ctx.requestTimeout}ms`);
    }
  }

  // Detail Level
  const detailLevelIndex = args.indexOf('--detail-level');
  if (detailLevelIndex !== -1) {
    const levelInput = args[detailLevelIndex + 1];
    if (!levelInput || levelInput.startsWith('-')) {
      logError('--detail-level requires a level argument.');
      logError('Available levels: summary, quick, full');
      process.exit(1);
    }
    const normalizedLevel = levelInput.toLowerCase().trim() as DetailLevel;
    if (!['summary', 'quick', 'full'].includes(normalizedLevel)) {
      logWarn(`Invalid --detail-level value: ${levelInput}`);
      logWarn('Available levels: summary, quick, full. Using default: full');
    } else {
      ctx.detailLevel = normalizedLevel;
      logVerbose(`Detail level set to: ${ctx.detailLevel}`);
    }
  }
}

// ============ 主函数 ============

async function main(): Promise<void> {
  parseArgs();

  log('Architect Rule Loader v7 (Progressive Disclosure)');
  log(ctx.isRemote ? `Mode: REMOTE (${ctx.remoteBaseUrl})` : 'Mode: LOCAL');

  if (ctx.taskType) {
    log(`Task: ${ctx.taskType} (threshold: ${ctx.relevanceThreshold})`);
  } else {
    log('Task: ALL (no filtering)');
  }

  log(`Detail Level: ${ctx.detailLevel}`);

  const targetDir = process.cwd();
  log(`Project: ${targetDir}`);

  // 加载配置
  const { LAYERS, TASKS, SKILLS, OUTPUT_DIR_NAME, OUTPUT_FILE_NAME, FRONTMATTER } = await loadConfig();

  // 验证任务类型
  if (ctx.taskType && TASKS) {
    const resolvedTask = resolveTaskType(ctx.taskType);
    if (!resolvedTask) {
      logWarn(`Unknown task type: ${ctx.taskType}`);
      logWarn(`Available types: ${Object.keys(TASKS.definitions).join(', ')}`);
      logWarn('Proceeding without task filtering.');
      ctx.taskType = null;
    } else if (resolvedTask !== ctx.taskType) {
      log(`Task resolved: ${ctx.taskType} -> ${resolvedTask}`);
      ctx.taskType = resolvedTask;
    }
  }

  const pkg = getPackageJson(targetDir);
  const dependencies: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
  const projectDeps = Object.keys(dependencies);

  logVerbose(`Detected ${projectDeps.length} dependencies.`);

  const systemPrompt = await getSystemPrompt(targetDir, RULES_ROOT);

  // 生成 YAML frontmatter
  const updatedAt = new Date().toISOString();
  const taskInfo = ctx.taskType ? `\ntask: ${ctx.taskType}\nthreshold: ${ctx.relevanceThreshold}` : '';
  const detailInfo = `\ndetailLevel: ${ctx.detailLevel}`;

  const frontmatterBlock = `---
description: ${FRONTMATTER.description || 'Frontend Architecture Standards'}
alwaysApply: ${FRONTMATTER.alwaysApply !== undefined ? FRONTMATTER.alwaysApply : true}
enabled: ${FRONTMATTER.enabled !== undefined ? FRONTMATTER.enabled : true}
updatedAt: ${updatedAt}
provider: ${FRONTMATTER.provider || ''}${taskInfo}${detailInfo}
---

`;

  // 生成智能规则激活提示词
  const smartActivationPrompt = generateSmartActivationPrompt();

  // 加载和生成技能激活提示词
  let skillsActivationPrompt = '';
  if (SKILLS && SKILLS.enabled) {
    log('Loading custom skills...');
    const skills = await loadSkills(SKILLS.path);
    log(`Loaded ${skills.length} skills.`);
    skillsActivationPrompt = generateSkillsActivationPrompt(skills);
  }

  let finalContent = `${frontmatterBlock}# Architect Rule Set
> Generated by Architect Rule Loader V7 (${ctx.isRemote ? 'Remote' : 'Local'})${smartActivationPrompt ? ' - Enhanced with Skills-like Activation' : ''}
> Generated at: ${updatedAt}
${ctx.taskType ? `> Task Filter: ${ctx.taskType} (threshold: ${ctx.relevanceThreshold})` : '> Task Filter: None (all rules loaded)'}
> Detail Level: ${ctx.detailLevel}
> For: CodeBuddy / AI Coding Assistants

---

${systemPrompt}
${smartActivationPrompt}
${skillsActivationPrompt}
`;

  let rulesLoaded = 0;
  let rulesSkipped = 0;

  // 处理 Layer 1: Base
  log('Processing Base Layer...');
  finalContent += `\n# ${LAYERS.BASE.title}\n`;

  const baseDir = ctx.isRemote ? LAYERS.BASE.id : path.join(RULES_ROOT, LAYERS.BASE.id);

  for (const folder of LAYERS.BASE.staticDeps) {
    const parts = await loadRulesFromFolder(baseDir, folder, 'layer1_base');
    if (parts.length > 0) {
      finalContent += parts.join('\n');
      rulesLoaded++;
    } else if (ctx.taskType) {
      rulesSkipped++;
    }
  }

  // Vue 版本特定规则
  const vueProfile = checkVueProfile(dependencies);

  if (vueProfile) {
    if (vueProfile.version === 3) {
      log('Detected Vue 3. Loading Script Setup rules.');
      const parts = await loadRulesFromFolder(baseDir, 'vue3', 'layer1_base');
      if (parts.length > 0) {
        finalContent += parts.join('\n');
        rulesLoaded++;
      }
    } else if (vueProfile.version === 2) {
      if (vueProfile.type === 'composition') {
        log('Detected Vue 2 + Composition API.');
        const parts = await loadRulesFromFolder(baseDir, 'vue2/vue2-composition.md', 'layer1_base');
        if (parts.length > 0) {
          finalContent += parts.join('\n');
          rulesLoaded++;
        }
      } else {
        log('Detected Vue 2 (Standard).');
        const parts = await loadRulesFromFolder(baseDir, 'vue2/vue2-general.md', 'layer1_base');
        if (parts.length > 0) {
          finalContent += parts.join('\n');
          rulesLoaded++;
        }
      }
    }
  } else {
    logWarn('No Vue detected. Skipping Vue-specific rules.');
  }

  // 处理 Layer 2: Business
  log('Processing Business Layer...');
  finalContent += `\n# ${LAYERS.BUSINESS.title}\n`;
  const bizDir = ctx.isRemote ? LAYERS.BUSINESS.id : path.join(RULES_ROOT, LAYERS.BUSINESS.id);

  for (const depKey of Object.keys(LAYERS.BUSINESS.dependencies)) {
    if (projectDeps.includes(depKey)) {
      log(`Detected ${depKey}. Loading related rules.`);
      for (const folder of LAYERS.BUSINESS.dependencies[depKey]) {
        const parts = await loadRulesFromFolder(bizDir, folder, 'layer2_business');
        if (parts.length > 0) {
          finalContent += parts.join('\n');
          rulesLoaded++;
        } else if (ctx.taskType) {
          rulesSkipped++;
        }
      }
    }
  }

  // 处理 Layer 3: Action
  log('Processing Action Layer...');
  finalContent += `\n# ${LAYERS.ACTION.title}\n`;
  const actionDir = ctx.isRemote ? LAYERS.ACTION.id : path.join(RULES_ROOT, LAYERS.ACTION.id);

  for (const item of LAYERS.ACTION.defaults) {
    const parts = await loadRulesFromFolder(actionDir, item + '.md', 'layer3_action');
    if (parts.length > 0) {
      finalContent += parts.join('\n');
      rulesLoaded++;
    } else if (ctx.taskType) {
      rulesSkipped++;
    }
  }

  // 输出
  const outputDir = path.join(targetDir, OUTPUT_DIR_NAME);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, OUTPUT_FILE_NAME);
  fs.writeFileSync(outputPath, finalContent, 'utf-8');

  log('');
  log('═══════════════════════════════════════════════════════════════════');
  log(`✅ Success! Rules written to ${outputPath}`);
  log(`   Content size: ${(finalContent.length / 1024).toFixed(2)} KB`);
  if (ctx.taskType) {
    log(`   Rules loaded: ${rulesLoaded}, Skipped: ${rulesSkipped}`);
  }
  log('═══════════════════════════════════════════════════════════════════');
}

main().catch((err: Error) => {
  console.error('[Architect] Fatal Error:', err);
  process.exit(1);
});
