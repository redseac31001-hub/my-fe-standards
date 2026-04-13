# 下游项目接入能力改进计划

> 版本：1.0.0
> 日期：2026-04-10
> 角色：架构设计文档，供 AI 模型或开发者直接读取并执行
> 前置依赖：运行机制全维度分析报告（修订版）
> 基线：my-fe-standards v3.3.0

---

## 背景与动机

### 问题陈述

运行机制全维度分析（综合评分 64.25/100）揭示了一个核心矛盾：**仓库内部工程化能力成熟（CI 门禁、doctor 诊断、增量同步），但下游业务项目没有开箱即用的接入方式**。

具体表现：
1. 业务项目无法通过 `npx` 一键安装（无 `bin` 字段）
2. 安装后无 git hooks 自动校验规则一致性
3. 无法验证 AI 是否真的遵循了规则（读取了必须的 Agent/Skill）
4. 并发安装无锁保护，依赖变更无指纹检测

### 设计约束（来自 ROADMAP.md）

- ❌ **不做**：`postinstall` 不做所有项目类型的主安装路径（`ROADMAP.md:543` 显式非目标）
- ❌ **不做**：不替换本地文件分发为 MCP 内容获取
- ✅ **保持**：现有跨平台远程安装器（`codebuddy-install.ts`）可复用
- ✅ **保持**：`gate:quick` 作为主线置信度门禁

### 成功标准

改进完成后，下游业务项目应能：
1. 一条命令安装规则（`npx codebuddy-loader install`）
2. 一条命令生成完整接入配置（git hooks + CI + npm scripts）
3. 每次提交前自动校验规则一致性
4. 检测到依赖变更时提示重新安装
5. 可量化 AI 对规则/技能/Agent 的实际遵循度

---

## 改进阶段总览

```
Phase 1 (P0): npm 包化 + bin 暴露 + 接入能力生成器 + 安装锁/依赖指纹
              → 目标：下游项目开箱即用接入
              → 涉及文件：6 个修改 + 3 个新增
              → 预计工作量：中等

Phase 2 (P1): AI 遵循度验证 + doctor --fix + 版本检查
              → 目标：信任验证闭环 + 功能完善
              → 涉及文件：5 个修改 + 2 个新增
              → 预计工作量：中等

Phase 3 (P2): loader watch 模式 + execution-metrics 告警
              → 目标：向自驱动演进
              → 涉及文件：3 个修改
              → 预计工作量：较小
```

---

## Phase 1：下游项目开箱即用接入

### 任务 1.1：npm 包化与 bin 暴露

**目标**：让业务项目可通过 `npx codebuddy-loader install` 一键安装。

**修改文件**：
- `package.json`

**具体变更**：

```jsonc
// package.json 新增 bin 字段
{
  "bin": {
    "codebuddy-loader": "./scripts/dist/codebuddy-loader.bundle.js",
    "codebuddy-install": "./scripts/dist/codebuddy-install.js"
  }
}
```

**实现步骤**：

1. 在 `package.json` 中添加 `bin` 字段，指向已有的 bundle 输出
2. 确认 `scripts/dist/codebuddy-loader.bundle.js` 顶部有 `#!/usr/bin/env node` shebang
3. 确认 `scripts/dist/codebuddy-install.js` 顶部有 `#!/usr/bin/env node` shebang
4. 若 shebang 缺失，在 esbuild 的 `build:bundle:loader` 脚本中添加 `--banner:js='#!/usr/bin/env node'`

**验证方式**：
```bash
# 本地链接测试
npm link
# 在任意目录执行
codebuddy-loader --help
codebuddy-install --help
# 确认帮助信息正常输出
npm unlink
```

**注意事项**：
- `postinstall` 不做默认主路径（ROADMAP.md 显式非目标），仅通过 bin 暴露 CLI
- 现有 `codebuddy-install.ts` 源码第 1 行已有 `#!/usr/bin/env node`，但编译后可能丢失

---

### 任务 1.2：接入能力生成器（`codebuddy-loader init`）

**目标**：一条命令为下游项目生成 git hooks、CI 模板、npm scripts。

**新增文件**：
- `scripts/src/lib/init-generator.ts`（核心生成逻辑）

**修改文件**：
- `scripts/src/codebuddy-loader.ts`（新增 `init` 命令）
- `scripts/src/types/index.ts`（若需新增类型）

**命令设计**：
```bash
codebuddy-loader init [options]
  --git-hooks          生成 git hooks（默认 true）
  --ci                 生成 CI 模板（默认 true）
  --ci-provider <type> CI 类型：github | gitlab（默认 github）
  --scripts            注入 npm scripts（默认 true）
  --force              覆盖已有配置（默认 false）
  --dry-run            仅输出将要生成的文件，不写入
```

**生成产物**：

```
目标项目/
├─ .husky/
│   ├─ pre-commit      → node .codebuddy/scripts/validator-gate.js run --scope rules
│   └─ pre-push        → node .codebuddy/scripts/codebuddy-loader.js doctor
├─ .github/workflows/
│   └─ codebuddy-gate.yml  → validate:all + doctor --json
└─ package.json (scripts 注入)
    ├─ "codebuddy:install": "npx codebuddy-loader install"
    ├─ "codebuddy:doctor": "node .codebuddy/scripts/codebuddy-loader.js doctor"
    └─ "codebuddy:validate": "node .codebuddy/scripts/validator-gate.js run"
```

**实现要点**：

```typescript
// scripts/src/lib/init-generator.ts 核心接口

export interface InitOptions {
  targetDir: string;
  gitHooks: boolean;
  ci: boolean;
  ciProvider: 'github' | 'gitlab';
  scripts: boolean;
  force: boolean;
  dryRun: boolean;
}

export interface InitResult {
  generated: string[];   // 生成的文件路径
  skipped: string[];     // 因已存在而跳过的文件路径
  injected: string[];    // 注入的 npm scripts 键名
}

export function runInit(options: InitOptions, logger: Logger): InitResult {
  // 1. 检测 .codebuddy/ 是否已安装（读 install.json）
  // 2. 若未安装，提示先执行 install
  // 3. 生成 git hooks（检测 husky / simple-git-hooks / .husky/ 目录）
  // 4. 生成 CI 模板（不覆盖已有 workflow 文件，除非 --force）
  // 5. 注入 npm scripts（不覆盖已有同名 script，除非 --force）
  // 6. 返回 InitResult
}
```

**git hooks 生成逻辑**：
1. 检测目标项目是否使用 husky（检查 `package.json` 的 `devDependencies` 和 `.husky/` 目录）
2. 若使用 husky：在 `.husky/pre-commit` 和 `.husky/pre-push` 追加命令
3. 若未使用 husky：在 `.git/hooks/` 直接写入脚本（需 `chmod +x`）
4. 不覆盖已有内容，追加到文件末尾

**CI 模板生成逻辑**：
```yaml
# .github/workflows/codebuddy-gate.yml 模板
name: CodeBuddy Gate
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: node .codebuddy/scripts/validator-gate.js run --json
      - run: node .codebuddy/scripts/codebuddy-loader.js doctor --json
```

**codebuddy-loader.ts 修改**：
```typescript
// 第 122 行附近，扩展命令集
const COMMANDS = new Set(['install', 'status', 'doctor', 'init']);
type LoaderCommand = 'install' | 'status' | 'doctor' | 'init';

// main() 函数中新增分支
if (command === 'init') {
  const result = runInit(initOptions, logger);
  // 输出结果
  process.exit(0);
}
```

**验证方式**：
```bash
# 在测试项目中
npm run build
node scripts/dist/codebuddy-loader.js install
node scripts/dist/codebuddy-loader.js init --dry-run
# 确认输出待生成文件列表
node scripts/dist/codebuddy-loader.js init
# 确认文件已生成
ls .husky/pre-commit .husky/pre-push
cat .github/workflows/codebuddy-gate.yml
cat package.json | grep "codebuddy:"
```

---

### 任务 1.3：安装锁（防并发竞争）

**目标**：防止多终端同时运行 loader 产生文件竞争。

**修改文件**：
- `scripts/src/lib/install-sync.ts`（新增锁逻辑）
- `scripts/src/codebuddy-loader.ts`（在 install 前获取锁）

**实现方式**：

```typescript
// scripts/src/lib/install-sync.ts 新增

const LOCK_FILE_NAME = '.install.lock';
const LOCK_STALE_MS = 5 * 60 * 1000; // 5 分钟视为过期

export interface InstallLock {
  pid: number;
  startedAt: string;
  hostname: string;
}

export function acquireInstallLock(targetDir: string, logger: Logger): boolean {
  const lockPath = path.join(targetDir, '.codebuddy', LOCK_FILE_NAME);

  if (fs.existsSync(lockPath)) {
    const existing = JSON.parse(fs.readFileSync(lockPath, 'utf-8')) as InstallLock;
    const age = Date.now() - new Date(existing.startedAt).getTime();

    if (age < LOCK_STALE_MS) {
      logger.warn(`另一个安装进程正在运行 (PID: ${existing.pid}, 开始于: ${existing.startedAt})。`);
      logger.warn(`若确认无冲突，可删除 ${lockPath} 后重试。`);
      return false;
    }
    // 过期锁，覆盖
    logger.warn(`发现过期锁文件 (${Math.round(age / 1000)}s)，将覆盖。`);
  }

  const lock: InstallLock = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    hostname: os.hostname(),
  };

  const lockDir = path.dirname(lockPath);
  if (!fs.existsSync(lockDir)) {
    fs.mkdirSync(lockDir, { recursive: true });
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf-8');
  return true;
}

export function releaseInstallLock(targetDir: string): void {
  const lockPath = path.join(targetDir, '.codebuddy', LOCK_FILE_NAME);
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
  }
}
```

**codebuddy-loader.ts 集成**：
```typescript
// install 命令执行前
if (!acquireInstallLock(targetDir, logger)) {
  process.exit(1);
}
try {
  // ... 现有安装逻辑 ...
} finally {
  releaseInstallLock(targetDir);
}
```

**验证方式**：
```bash
# 并发测试（两个终端同时执行）
node scripts/dist/codebuddy-loader.js &
node scripts/dist/codebuddy-loader.js
# 第二个应输出警告并退出
```

---

### 任务 1.4：依赖指纹（变更检测）

**目标**：记录安装时的 dependencies 哈希，支持 `--if-deps-changed` 按需安装。

**修改文件**：
- `scripts/src/types/index.ts`（`InstallState` 接口新增字段）
- `scripts/src/lib/install-state.ts`（构建 installState 时计算依赖指纹）
- `scripts/src/codebuddy-loader.ts`（新增 `--if-deps-changed` 参数）

**InstallState 类型扩展**：
```typescript
// types/index.ts InstallState 接口新增
export interface InstallState {
  // ... 现有字段 ...
  depsFingerprint?: string | null; // 安装时 dependencies + devDependencies 的 SHA256
}
```

**指纹计算**：
```typescript
// install-state.ts 新增
export function computeDepsFingerprint(targetDir: string): string | null {
  const pkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = {
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
    };
    return createHash('sha256').update(JSON.stringify(deps)).digest('hex');
  } catch {
    return null;
  }
}
```

**`--if-deps-changed` 逻辑**：
```typescript
// codebuddy-loader.ts install 命令前
if (ctx.ifDepsChanged) {
  const previousState = readInstallState(targetDir, logger);
  const currentFingerprint = computeDepsFingerprint(targetDir);

  if (previousState?.depsFingerprint && previousState.depsFingerprint === currentFingerprint) {
    logger.info('依赖未变更，跳过安装。');
    process.exit(0);
  }
}
```

**验证方式**：
```bash
# 首次安装
node scripts/dist/codebuddy-loader.js install
# 确认 install.json 中有 depsFingerprint 字段
cat .codebuddy/install.json | grep depsFingerprint

# 未变更时跳过
node scripts/dist/codebuddy-loader.js install --if-deps-changed
# 应输出 "依赖未变更，跳过安装"

# 修改 package.json 后重新检测
# 应输出 "检测到依赖变更" 并执行安装
```

---

## Phase 2：信任验证闭环 + 功能完善

### 任务 2.1：AI 遵循度验证机制

**目标**：量化 AI 对规则/技能/Agent 的实际遵循度。

**新增文件**：
- `scripts/src/lib/compliance-tracker.ts`

**修改文件**：
- `scripts/src/lib/execution-metrics.ts`（新增遵循度事件类型）
- `scripts/src/lib/prompt-builder.ts`（在激活规则中嵌入遵循度报告指令）

**设计思路**：

由于无法在程序层面强制 AI 读取文件，采用**声明式验证**方式：

1. 在 `project-rules.md` 的强制激活规则中，要求 AI 在 agent-call 的 result.json 中声明已读取的文件
2. compliance-tracker 分析 result.json 中的声明，对比 install.json 的 managedFiles 列表
3. 生成遵循度报告

**prompt-builder.ts 修改**：
```typescript
// generateActivationRules() 中，在 THEN 步骤末尾追加：
thenSteps.push(
  '在 result.json 的 `meta.filesRead` 字段中声明本次实际读取的所有 Agent/Skill 文件路径。'
);
```

**compliance-tracker.ts 核心接口**：
```typescript
export interface ComplianceReport {
  generatedAt: string;
  totalAgentCalls: number;
  compliantCalls: number;
  nonCompliantCalls: number;
  complianceRate: number;       // 0-1
  missingReads: Array<{
    requestId: string;
    expectedFiles: string[];
    actualFiles: string[];
    missingFiles: string[];
  }>;
}

export function analyzeCompliance(
  targetDir: string,
  installState: InstallState,
): ComplianceReport {
  // 1. 扫描 .codebuddy/agent-calls/*.result.json
  // 2. 提取每个 result 的 meta.filesRead
  // 3. 根据触发词匹配预期应读取的文件
  // 4. 对比计算遵循率
}
```

**验证方式**：
```bash
node scripts/dist/report-manager.js compliance
# 输出遵循度报告
```

---

### 任务 2.2：doctor --fix 自动修复

**目标**：对 doctor 发现的常见问题提供自动修复。

**修改文件**：
- `scripts/src/lib/install-health.ts`（新增 fix 逻辑）
- `scripts/src/codebuddy-loader.ts`（doctor 命令新增 `--fix` 参数）

**修复范围（聚焦，不扩大）**：

| doctor 检查项 | --fix 行为 | 风险等级 |
|--------------|-----------|---------|
| managed-files-missing | 重新执行 install 恢复缺失文件 | 低 |
| profile-residual-cleanup | 自动删除越界残留文件 | 低 |
| unexpected-static-files | 提示用户确认后删除 | 中（需 `--fix --force`） |

**不做的修复**：
- 不自动重新安装（避免副作用）
- 不自动修改 workflow / agent-call 契约（需人工确认）

**验证方式**：
```bash
# 人为制造缺失
rm .codebuddy/scripts/rule-validator.js
node scripts/dist/codebuddy-loader.js doctor
# 应报告 managed-files-missing: FAIL

node scripts/dist/codebuddy-loader.js doctor --fix
# 应自动恢复文件并报告 fixed
```

---

### 任务 2.3：版本检查

**目标**：远程模式下检查规则库是否有新版本。

**修改文件**：
- `scripts/src/codebuddy-loader.ts`（新增 `check-update` 命令）

**实现方式**：
```typescript
const COMMANDS = new Set(['install', 'status', 'doctor', 'init', 'check-update']);

// check-update 命令逻辑
async function checkUpdate(ctx: Context, logger: Logger): Promise<void> {
  const installState = readInstallState(targetDir, logger);
  if (!installState) {
    logger.warn('未找到安装状态，请先执行 install。');
    return;
  }

  if (!ctx.isRemote) {
    logger.info('本地模式无法检查远程版本。请使用 --remote <URL> 指定远程源。');
    return;
  }

  // 获取远程 manifest
  const manifest = await fetchManifest(ctx, logger);
  const remoteVersion = manifest.version;
  const localVersion = installState.version;

  if (remoteVersion === localVersion) {
    logger.info(`当前版本 ${localVersion} 已是最新。`);
  } else {
    logger.info(`发现新版本: ${localVersion} → ${remoteVersion}`);
    logger.info(`运行 codebuddy-loader install --remote <URL> 更新。`);
  }
}
```

**验证方式**：
```bash
node scripts/dist/codebuddy-loader.js check-update --remote https://example.com/my-fe-standards
```

---

## Phase 3：向自驱动演进

### 任务 3.1：Loader 级 watch 模式

**目标**：监控关键文件变化，自动重新安装。

**修改文件**：
- `scripts/src/codebuddy-loader.ts`（新增 `watch` 命令）

**监控文件列表**：
```typescript
const WATCH_FILES = [
  'package.json',
  'tsconfig.json',
  'vue.config.js',
  'vite.config.ts',
  'vite.config.js',
  'nuxt.config.ts',
];
```

**实现方式**：使用 `fs.watch` 或 `fs.watchFile`（零依赖），检测到变化后延迟 2 秒去抖重新执行 install。

**注意**：此任务优先级低于 Phase 1/2，可视进度决定是否实施。

---

### 任务 3.2：execution-metrics 告警阈值

**目标**：当指标异常时自动产生告警。

**修改文件**：
- `scripts/src/lib/execution-metrics.ts`（新增告警检查）

**告警规则**：
```typescript
interface AlertRule {
  id: string;
  condition: (summary: ExecutionMetricsSummary) => boolean;
  severity: 'warn' | 'error';
  message: string;
}

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'consecutive-failures',
    condition: (s) => s.totals.failed >= 3 && s.totals.completed === 0,
    severity: 'error',
    message: '连续 3 次任务失败，建议检查环境配置。',
  },
  {
    id: 'high-fallback-rate',
    condition: (s) => {
      const total = s.totals.workflowRoutesSelected + s.totals.workflowRoutesReused + s.totals.workflowRoutesFallback;
      return total > 0 && s.totals.workflowRoutesFallback / total > 0.5;
    },
    severity: 'warn',
    message: 'Workflow 路由 fallback 比例过高（>50%），建议检查 workflow 配置。',
  },
];
```

---

## 构建与测试

### 构建命令

所有改动完成后执行：
```bash
npm run build
```

这会执行 `build:scripts`（tsc 编译）→ `build:bundle`（esbuild 打包）→ `build:manifest`（生成 manifest.json）。

### 测试策略

| 阶段 | 测试方式 | 命令 |
|------|---------|------|
| 单元测试 | lib-baseline.test.mjs 中新增测试用例 | `npm run test:lib` |
| 正确性回归 | test-correctness-regressions.mjs | `npm run test:correctness` |
| 快速门禁 | 构建 + 测试 + 全量校验 | `npm run gate:quick` |
| 安装冒烟 | 在临时目录模拟业务项目安装 | 手动或新增 fixture |

### 新增测试用例清单

1. **安装锁**：并发测试 — 同时获取锁应失败；过期锁应可覆盖
2. **依赖指纹**：修改 dependencies 后指纹变化；未修改时指纹不变
3. **init 生成器**：dry-run 不写文件；生成后文件存在且内容正确；不覆盖已有文件
4. **doctor --fix**：缺失文件修复后 doctor pass；残留文件清理后无 warn

---

## 文件变更清单

### Phase 1
| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 修改 | `package.json` | 添加 `bin` 字段 |
| 新增 | `scripts/src/lib/init-generator.ts` | 接入能力生成器核心逻辑 |
| 修改 | `scripts/src/codebuddy-loader.ts` | 新增 `init` 命令 + `--if-deps-changed` + 安装锁集成 |
| 修改 | `scripts/src/lib/install-sync.ts` | 新增安装锁（acquire/release） |
| 修改 | `scripts/src/lib/install-state.ts` | 新增 `computeDepsFingerprint` + `depsFingerprint` 字段 |
| 修改 | `scripts/src/types/index.ts` | `InstallState` 新增 `depsFingerprint` 字段 |

### Phase 2
| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新增 | `scripts/src/lib/compliance-tracker.ts` | AI 遵循度分析 |
| 修改 | `scripts/src/lib/execution-metrics.ts` | 新增遵循度事件类型 |
| 修改 | `scripts/src/lib/prompt-builder.ts` | 激活规则追加遵循度声明要求 |
| 修改 | `scripts/src/lib/install-health.ts` | doctor --fix 逻辑 |
| 修改 | `scripts/src/codebuddy-loader.ts` | doctor --fix + check-update 命令 |

### Phase 3
| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 修改 | `scripts/src/codebuddy-loader.ts` | watch 命令 |
| 修改 | `scripts/src/lib/execution-metrics.ts` | 告警规则和阈值检查 |

---

## 执行顺序与依赖关系

```
1.1 npm 包化     ─────────────────────────────────┐
1.3 安装锁       ─────────────────────────────────┤
1.4 依赖指纹     ─────────────────────────────────┤→ Phase 1 完成 → gate:quick 通过
1.2 init 生成器  ← 依赖 1.1（bin 可用后才有意义）──┘

2.1 AI 遵循度验证 ─────────────────────────────────┐
2.2 doctor --fix  ─────────────────────────────────┤→ Phase 2 完成 → gate:quick 通过
2.3 版本检查      ─────────────────────────────────┘

3.1 watch 模式    ─────────────────────────────────┐→ Phase 3 完成
3.2 metrics 告警  ─────────────────────────────────┘
```

**关键约束**：
- 每个任务完成后必须通过 `npm run gate:quick`
- Phase 1 完成后必须通过 `npm run test:full`
- 不修改现有 loader 的默认行为，所有新功能通过新命令或新参数暴露
- install.json schema 版本从 `1.2.0` 升级到 `1.3.0`（新增 `depsFingerprint` 字段）

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| bin 暴露后 bundle 文件过大 | 首次 npx 下载慢 | 已有 esbuild bundle，体积可控；ContentPack 模式可选 |
| init 生成器覆盖用户已有配置 | 用户不满 | 默认不覆盖，需 `--force`；`--dry-run` 预览 |
| 安装锁在 Windows 上行为差异 | 锁文件残留 | 5 分钟过期自动覆盖 + 手动删除提示 |
| AI 不遵循遵循度声明要求 | 遵循度永远为 0 | 渐进式引导，先记录再强制 |
| install.json schema 升级 | 旧版 doctor 无法识别新字段 | 新字段标记为 optional（`?`），不影响向后读取 |
