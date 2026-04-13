# 下游项目接入能力改进计划（修订版）

> 版本：1.1.0
> 日期：2026-04-10
> 角色：面向实现的产品化计划
> 基线：my-fe-standards v3.3.0
> 本版目标：把“可讨论的想法”收缩成“当前代码结构下可落地的计划”

---

## 一、结论

这项改进值得做，但应收缩范围，优先解决下游项目“能装、能接、能查、能更新”四件事。

本版判断：

1. **必须立即推进（P0）**
   - CLI 暴露与发布入口对齐
   - `init` 接入生成器
   - 安装锁（原子实现）
   - 依赖变更检测

2. **可以作为 P1，但要收缩定义**
   - `doctor --fix`
   - `check-update`
   - AI 遵循度先做“声明采集”，暂不做强评分/门禁

3. **延期**
   - loader watch 模式
   - execution-metrics 告警阈值

---

## 二、为什么要修订

原版计划方向正确，但有 4 个关键问题需要先纠正：

### 2.1 CLI 命令名与包发布名未对齐

原计划把目标命令写成：

```bash
npx codebuddy-loader install
```

但当前仓库包名仍是 `my-fe-standards`，不是 `codebuddy-loader`。仅增加 `bin` 字段，并不会自动让 `npx codebuddy-loader` 成立。

这件事必须先冻结一个对外方案：

1. **推荐**：发布专用包名，例如 `@codebuddy/loader`
2. **备选**：保留当前包名，但文档和 CI 使用
   `npx --package <published-package> codebuddy-loader install`

在包名未冻结前，不应把 `npx codebuddy-loader install` 写成既定成功标准。

### 2.2 CI 模板不能假设 `.codebuddy/` 已存在

当前 loader 会自动把 `.codebuddy/` 加入目标项目 `.gitignore`，因此 CI fresh clone 后默认没有 `.codebuddy/` 产物。

所以生成的 CI 模板必须采用：

```bash
npm ci
<bootstrap install>
node .codebuddy/scripts/validator-gate.js run --json
node .codebuddy/scripts/codebuddy-loader.js doctor --json
```

不能直接从 `validator-gate` 或 `doctor` 开始。

### 2.3 安装锁必须使用原子创建

如果实现方式是：

1. `existsSync(lockPath)`
2. `writeFileSync(lockPath)`

那仍然存在并发竞争窗口，不能真正防双进程安装。

本计划改为：**必须使用原子创建语义**，例如 `openSync(lockPath, 'wx')` 或锁目录方案。

### 2.4 AI 遵循度评分现在证据不足

当前系统可以通过提示词要求 AI 在 `result.json` 中声明读取了哪些文件，但“预期应读取哪些文件”没有稳定的机器判定依据。

因此本版调整为：

1. 先采集 `meta.filesRead`
2. 先输出原始统计
3. 暂不作为 gate
4. 暂不计算高置信度“遵循率评分”

---

## 三、目标与非目标

### 3.1 本次目标

改进完成后，下游业务项目应能：

1. 通过一个稳定的 bootstrap 命令完成安装
2. 通过一个命令生成最小可用接入配置
3. 在提交前执行基本规则校验
4. 在依赖变更后提示重新安装或自动按需安装
5. 在远程模式下检查是否有新版本
6. 对常见安装问题提供低风险自动修复

### 3.2 本次非目标

1. 不把 `postinstall` 作为所有项目类型的主安装路径
2. 不改变当前 `.codebuddy/` 本地分发契约
3. 不把 MCP 内容获取替换为主安装面
4. 不把 AI 遵循度做成强门禁
5. 不引入持续 watch 守护进程

---

## 四、执行分期

### P0：把入口打通

**目标**：下游项目可以稳定 bootstrap、初始化和增量同步。

**收益**：最高  
**可行性**：高  
**建议优先级**：立即执行

包含任务：

1. CLI 暴露与发布入口对齐
2. `init` 接入生成器
3. 安装锁
4. 依赖变更检测

### P1：补足诊断闭环

**目标**：减少人工排障成本，补齐更新和修复入口。

**收益**：中高  
**可行性**：中高  
**建议优先级**：P0 完成后立即跟进

包含任务：

1. `doctor --fix`
2. `check-update`
3. AI 遵循度声明采集

### P2：自驱动增强

**目标**：增强自动化和观测。

**收益**：中  
**可行性**：中  
**建议优先级**：延后

包含任务：

1. watch 模式
2. metrics 告警规则

---

## 五、P0 详细计划

### 任务 P0.1：CLI 暴露与发布入口对齐

**目标**：让业务项目存在一个稳定、文档可写、CI 可复用的 bootstrap 命令。

**涉及文件**：

- `package.json`
- `scripts/src/codebuddy-loader.ts`
- `scripts/src/build-release.ts`
- 相关发布文档

**实施要求**：

1. 在 `package.json` 中增加 `bin`
2. 保持 `scripts/dist/codebuddy-loader.bundle.js` 与 `scripts/dist/codebuddy-install.js` 顶部 shebang
3. 明确一个对外支持的安装命令
4. 不把“bin 名称”误写成“npm 包名称”

**命令策略**：

在包名未冻结前，文档统一写成占位格式：

```bash
npx --package <published-package> codebuddy-loader install
```

如果后续决定发布专用包名，再把 `<published-package>` 替换为最终值。

**验收标准**：

1. 本地 `npm link` 后可以运行 `codebuddy-loader --help`
2. release 产物仍包含 `scripts/dist/codebuddy-loader.bundle.js`
3. release 产物仍包含 `scripts/dist/codebuddy-install.js`
4. 文档中的 bootstrap 命令与真实发布策略一致

---

### 任务 P0.2：`codebuddy-loader init` 接入生成器

**目标**：在下游项目中一条命令生成最小可用接入面。

**本版收缩范围**：

1. 只支持 Node 项目
2. 只支持 GitHub Actions
3. `husky` 存在时优先集成 `husky`
4. 不自动兼容所有 hooks 管理器
5. 不直接改 `.git/hooks/`

**涉及文件**：

- `scripts/src/codebuddy-loader.ts`
- `scripts/src/lib/init-generator.ts`（新增）
- `scripts/src/types/index.ts`（如需新增类型）

**命令设计**：

```bash
codebuddy-loader init [options]
  --ci
  --git-hooks
  --scripts
  --force
  --dry-run
```

**默认行为**：

1. 检测 `.codebuddy/install.json`，未安装则直接退出并提示先执行 install
2. 检测 `package.json`
3. 仅在以下产物上工作：
   - `.github/workflows/codebuddy-gate.yml`
   - `package.json` scripts
   - `.husky/pre-commit`
   - `.husky/pre-push`

**关键修正**：

生成的 GitHub Actions 模板必须先 bootstrap，再验证：

```yaml
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
      - run: npx --package <published-package> codebuddy-loader install --if-deps-changed
      - run: node .codebuddy/scripts/validator-gate.js run --json
      - run: node .codebuddy/scripts/codebuddy-loader.js doctor --json
```

**建议注入脚本**：

```json
{
  "scripts": {
    "codebuddy:install": "npx --package <published-package> codebuddy-loader install",
    "codebuddy:doctor": "node .codebuddy/scripts/codebuddy-loader.js doctor",
    "codebuddy:validate": "node .codebuddy/scripts/validator-gate.js run"
  }
}
```

**验收标准**：

1. `init --dry-run` 只输出变更计划，不落盘
2. `init` 不覆盖已有同名配置，除非 `--force`
3. 生成后的 CI 在 fresh clone 场景下可运行
4. 生成后的 hooks 不依赖仓库已提交 `.codebuddy/`

---

### 任务 P0.3：安装锁

**目标**：避免两个进程同时执行 install 导致 managed files 状态竞争。

**涉及文件**：

- `scripts/src/lib/install-sync.ts`
- `scripts/src/codebuddy-loader.ts`

**实现要求**：

1. 锁文件位置：`.codebuddy/.install.lock`
2. 使用原子创建语义获取锁
3. 锁内容记录 `pid`、`startedAt`、`hostname`
4. 支持 stale lock 覆盖
5. `finally` 中释放锁

**必须避免**：

1. 先判断存在再写入的非原子方案
2. 将锁实现为仅日志提示、不真正阻止执行

**验收标准**：

1. 并发双进程 install 时，后一个进程稳定退出
2. 过期锁可自动覆盖
3. 异常退出后 stale lock 可恢复

---

### 任务 P0.4：依赖变更检测

**目标**：提供 `--if-deps-changed`，避免无意义重复安装。

**涉及文件**：

- `scripts/src/types/index.ts`
- `scripts/src/lib/install-state.ts`
- `scripts/src/codebuddy-loader.ts`

**本版实现策略**：

二选一，必须在实现前明确：

1. **推荐**：workspace-aware
   - 根 `package.json`
   - 已发现子项目 `package.json`
   - 一并参与指纹计算

2. **降级**：仅支持单包项目
   - 但要在日志和帮助信息中明确限制

**不建议的做法**：

仅哈希根目录 `dependencies/devDependencies`，却对外宣称适用于 workspace。

**schema 策略**：

优先采用**向后兼容的可选字段**：

```ts
depsFingerprint?: string | null;
```

若只新增 optional 字段，可不强制升级 major schema；若升级 `schemaVersion`，必须同步更新 doctor 的受支持列表。

**验收标准**：

1. 未变更依赖时 `install --if-deps-changed` 可直接跳过
2. 依赖变更后重新执行 install
3. workspace 项目不会因子项目依赖变化而误判

---

## 六、P1 详细计划

### 任务 P1.1：`doctor --fix`

**目标**：自动修复低风险问题，降低人工排障成本。

**涉及文件**：

- `scripts/src/lib/install-health.ts`
- `scripts/src/codebuddy-loader.ts`

**本版仅做低风险修复**：

1. `managed-files-missing`
   - 重新执行 install 恢复缺失产物
2. `profile-residual-cleanup`
   - 删除越界残留文件

**默认不做**：

1. 不自动删除 `unexpected-static-files`
2. 不自动修复用户自定义 CI / hooks
3. 不自动处理高风险契约漂移

**命令设计**：

```bash
codebuddy-loader doctor --fix
codebuddy-loader doctor --fix --force
```

其中：

1. `--fix` 只处理低风险项
2. `--fix --force` 才允许处理中风险删除动作

**验收标准**：

1. 缺失 managed file 时可恢复
2. 残留 profile 文件可清理
3. doctor 输出必须标明 repaired / skipped / requires-force

---

### 任务 P1.2：`check-update`

**目标**：远程安装模式下，给出当前安装版本是否落后。

**涉及文件**：

- `scripts/src/codebuddy-loader.ts`

**范围**：

1. 仅适用于 remote install
2. 读取远程 `manifest.json`
3. 比较 `install.json.version` 与远程版本

**不扩展**：

1. 不自动升级
2. 不自动回滚
3. 不接入 npm registry 版本检查

**验收标准**：

1. 远程模式下可得到“已最新 / 有新版本”结果
2. 本地模式下清晰提示“不支持远程检查”

---

### 任务 P1.3：AI 遵循度声明采集

**目标**：先采集证据，再决定是否值得做评分。

**涉及文件**：

- `scripts/src/lib/prompt-builder.ts`
- `scripts/src/lib/compliance-tracker.ts`（新增）
- `scripts/src/report-manager.ts` 或独立入口

**本版只做以下事情**：

1. 在激活规则中增加声明要求：
   - `result.json.meta.filesRead`
2. 扫描 `.codebuddy/agent-calls/*.result.json`
3. 输出原始报告：
   - 哪些请求声明了 `filesRead`
   - 声明了哪些路径
   - 哪些请求完全没声明

**本版明确不做**：

1. 不输出高置信度“遵循率评分”
2. 不将其纳入 `validator-gate`
3. 不以启发式规则判定“理论上必须读取哪些文件”

**验收标准**：

1. result schema 保持向后兼容
2. 报告可读、可导出
3. 缺失声明仅作为观测信号，不阻断主流程

---

## 七、延期项

以下能力保留在 backlog，不进入当前迭代承诺：

### 7.1 watch 模式

原因：

1. onboarding 主矛盾不是“自动监听”
2. 容易引入跨平台文件监听差异
3. 容易与安装锁、长时进程管理耦合

### 7.2 execution-metrics 告警阈值

原因：

1. 当前 metrics 已具备基础记录能力
2. 但告警阈值缺少足够生产样本校准
3. 过早做默认阈值，噪音大于价值

---

## 八、推荐实施顺序

```text
P0.1 CLI 暴露与发布入口对齐
  ↓
P0.2 init 生成器
  ↓
P0.3 安装锁（原子）
  ↓
P0.4 依赖变更检测
  ↓
P1.1 doctor --fix
  ↓
P1.2 check-update
  ↓
P1.3 AI 遵循度声明采集
```

---

## 九、测试与验收

### 9.1 每个任务完成后的最低验证

```bash
npm run build
npm run gate:quick
```

### 9.2 P0 完成后的增强验证

至少覆盖以下场景：

1. 本地 bootstrap 冒烟
2. 远程 bootstrap 冒烟
3. fresh clone CI 模板冒烟
4. 双进程 install 并发测试
5. workspace 依赖变更检测测试

**推荐命令**：

```bash
npm run smoke:business-remote
npm run test:full
```

### 9.3 P1 完成后的增强验证

1. `doctor --fix` 修复缺失 managed file
2. `check-update` 远程版本检查
3. `filesRead` 报告生成

---

## 十、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 发布包名未冻结 | 文档命令和真实入口不一致 | 先冻结 `<published-package>`，再固化文档 |
| CI 模板未先 install | fresh clone 直接失败 | 模板固定为 `npm ci -> install -> validate -> doctor` |
| 锁实现非原子 | 并发安装仍会打架 | 必须使用 `wx` 或锁目录 |
| workspace 指纹设计过窄 | 依赖变了但误判跳过安装 | 明确 workspace-aware 或显式限制 |
| `doctor --fix` 删除过度 | 误删用户文件 | 默认仅做低风险修复，高风险需 `--force` |
| AI 遵循度误报 | 误导团队决策 | 先采集，不评分，不 gate |

---

## 十一、最终建议

本计划按“产品面可交付”排序后的建议是：

1. **本迭代只承诺 P0 + P1.1 + P1.2**
2. **P1.3 作为观测功能实现，不承诺评分**
3. **P2 全部延期**

如果需要一句话定义本次版本目标，应写为：

> 让下游业务项目能够稳定 bootstrap、初始化、诊断和更新，而不是在本轮把所有自动化想法一次性做完。
