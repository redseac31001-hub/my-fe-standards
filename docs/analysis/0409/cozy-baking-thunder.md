# my-fe-standards v3.3.0 运行机制全维度分析报告

> 分析日期：2026-04-09
> 分析范围：项目在业务项目安装后的运行机制、触发时机、功能完善度、自驱动能力

---

## 一、Context（分析背景）

my-fe-standards 是一套面向 AI 编程助手（CodeBuddy GLM-4.7）的**前端架构师规则库 + 自主编码系统**，v3.3.0 版本包含 26 个 TypeScript 源文件（约 21,000 行），编译后产出 53 个 JS 文件。项目通过 `codebuddy-loader` 将规则、技能、Agent 等资源安装到业务项目的 `.codebuddy/` 目录，生成 `project-rules.md` 作为 AI 的知识输入。

本报告从四个关键维度评估项目在**业务项目安装后**的实际运行效果。

---

## 二、维度 1：运行机制 — 评分 78/100

### 2.1 安装流程

| 方式 | 命令 | 特点 |
|------|------|------|
| 本地模式 | `node scripts/dist/codebuddy-loader.js` | 需要先 clone 规则库到本地 |
| 远程模式 | `curl ... \| node - --remote <url>` | 零依赖一行安装，但需要网络 |
| ContentPack | `--remote <url> --pack-only` | 一次下载整个包，适合弱网 |

**核心流程**（codebuddy-loader.ts 主函数，约 540 行逻辑）：

```
CLI 参数解析 → 配置加载 → 项目元数据检测 → Workspace 发现
→ Layer1 Eager 加载 → Layer2 Lazy 索引 → Layer3 Lazy 索引
→ 技能加载（三层过滤）→ Agent 加载 → 脚本分发（按 profile）
→ 编排契约分发 → 生成 project-rules.md + install.json
→ 快照 GC → 输出统计
```

### 2.2 文件同步机制（install-sync.ts）

- **SHA256 增量写入**：对比文件哈希，仅在内容变化时写入（`writeManagedFile`）
- **陈旧文件清理**：根据 `install.json` 中的 `managedFiles` 列表，自动清理不再需要的文件（`cleanupStaleManagedFiles`）
- **空目录修剪**：删除文件后自动向上清理空父目录（`pruneEmptyParents`）
- **快照保留策略**：技能和 Agent 快照保留最近 N 个（默认 3），自动 GC 旧版本

### 2.3 诊断能力（install-health.ts）

提供 `status` 和 `doctor` 两个诊断命令：

| 检查项 | 说明 |
|--------|------|
| install-state-schema | 检查 schema 版本兼容性 |
| rules-file | 规则文件是否存在 |
| managed-files-missing | 跟踪文件是否缺失 |
| unexpected-static-files | 是否有未跟踪的静态文件 |
| profile-residual-cleanup | 降级 profile 后是否有越界残留 |
| architecture-constraints | workflow / agent-call 契约漂移检测 |
| validator-gate-report | 验证门禁趋势分析（regressed/improved/stable） |
| workflow-routing-report | 工作流路由决策健康检查 |
| system-overview-python | Python 运行时检测（python-docx 依赖） |

### 2.4 优势

- ✅ 增量同步避免不必要的文件写入
- ✅ 完善的安装状态跟踪（install.json 包含完整元数据）
- ✅ 诊断系统全面，支持 JSON 输出便于自动化消费
- ✅ 快照 GC 自动管理版本历史

### 2.5 缺陷

- ❌ **无 npm 包化**：不是 npm 包，没有 `bin` 字段，没有 `postinstall` 钩子，业务项目无法通过 `npm install` 或 `npx` 直接使用
- ❌ **无幂等性保障机制**：缺少锁文件或并发控制，多终端同时运行 loader 可能产生竞争
- ❌ **安装后无版本检查**：不会主动提示规则库有新版本可用

---

## 三、维度 2：触发时机 — 评分 45/100

### 3.1 现状：纯手动触发

| 操作 | 触发方式 | 自动化程度 |
|------|----------|-----------|
| 安装/更新规则 | 手动执行 `node codebuddy-loader.js` | ❌ 手动 |
| 规则校验 | 手动执行 `npm run validate:all` | ❌ 手动 |
| 状态检查 | 手动执行 `codebuddy-loader.js status` | ❌ 手动 |
| 健康诊断 | 手动执行 `codebuddy-loader.js doctor` | ❌ 手动 |
| 任务入口判断 | AI 主动调用 `task-intake-router.js` | ⚠️ 依赖 AI 遵循指令 |
| 任务编排执行 | AI 主动调用 `task-orchestrator.js` | ⚠️ 依赖 AI 遵循指令 |
| Agent 激活 | AI 匹配触发词后读取 `AGENT.md` | ⚠️ 依赖 AI 遵循指令 |
| 技能加载 | AI 匹配场景后读取 `SKILL.md` | ⚠️ 依赖 AI 遵循指令 |

### 3.2 缺失的触发时机

| 缺失的触发点 | 影响 | 优先级 |
|-------------|------|--------|
| **npm postinstall 钩子** | 业务项目 `npm install` 后不会自动安装规则 | 🔴 高 |
| **git hooks 集成**（pre-commit/pre-push） | 提交前不会自动校验规则一致性 | 🔴 高 |
| **文件 watch 模式** | 规则库更新后需手动重新安装 | 🟡 中 |
| **CI/CD 集成脚本** | 没有现成的 CI 配置模板 | 🟡 中 |
| **IDE 扩展/插件** | CodeBuddy 以外的 AI 工具无法自动识别 | 🟠 中低 |
| **定时自动更新** | 远程模式下不会自动检查版本更新 | 🟢 低 |

### 3.3 "强制激活规则"的局限性

`prompt-builder.ts` 中的 `generateActivationRules()` 生成的激活规则是**嵌入在 project-rules.md 中的自然语言指令**：

```markdown
# ⚡ 强制激活规则（MANDATORY ACTIVATION RULES）
## 规则 1：代码审查与质量
- WHEN：用户请求命中以下任一关键词时触发
  `review` | `security` | `审查` | `代码质量` | ...
- THEN：
  1. 优先读取 Agent 定义：`.codebuddy/agents/code-reviewer/AGENT.md`
  2. 补充读取 Skill...
  3. 严格按照 AGENT.md 工作流程执行
- NEVER：
  - ❌ 不得跳过已安装的 Skill/Agent
```

**问题**：这完全依赖 AI 模型对指令的遵循���度。没有任何程序化的强制机制。如果 AI 忽略了这些规则，系统没有兜底手段。

### 3.4 task-intake-router 的被动性

`task-intake-routing.ts` 实现了智能的任务复杂度判断（直接执行 vs 编排），但它是一个**被动的 CLI 工具**，需要 AI 主动调用：

```
AI 收到用户需求 → AI 决定是否调用 task-intake-router → 路由判断
```

如果 AI 跳过这一步直接编码，整个编排系统就被绕过了。

---

## 四、维度 3：功能完善度 — 评分 82/100

### 4.1 功能矩阵

| 功能模块 | 完善度 | 说明 |
|---------|--------|------|
| 三层规则架构 | ⭐⭐⭐⭐⭐ | Eager/Lazy混合加载，规则裁剪（summary/quick/full），设计成熟 |
| 项目检测 | ⭐⭐⭐⭐⭐ | 自动检测语言/框架/UI库/Vue版本/monorepo，覆盖全面 |
| 远程加载 | ⭐⭐⭐⭐⭐ | manifest + ContentPack + Bearer Token 认证 + 超时重试 |
| 技能系统 | ⭐⭐⭐⭐ | 15个技能，三层过滤（scope/stack/role），快照管理 |
| Agent ���统 | ⭐⭐⭐⭐ | 11个Agent，触发词匹配，但缺少运行时验证 |
| 编排系统 | ⭐⭐⭐⭐ | workflow路由（micro/sprint/default）+ TaskBook + Agent Call |
| 脚本分发 | ⭐⭐⭐⭐ | 按profile分层，依赖管理自动递归复制 |
| 安装状态管理 | ⭐⭐⭐⭐⭐ | install.json 完整记录，SHA256 校验，增量同步 |
| 诊断系统 | ⭐⭐⭐⭐ | status/doctor 命令，趋势分析，但无自动修复 |
| 事件记录 | ⭐⭐⭐ | execution-metrics 记录完整事件，但仅供事后分析 |
| 提示词工程 | ⭐⭐⭐⭐⭐ | 分组路由表、快速行动指引、激活规则，精心设计 |
| 校验系统 | ⭐⭐⭐⭐ | 规则/技能/契约/仓库状态四维校验，支持strict模式 |
| Workspace 支持 | ⭐⭐⭐⭐⭐ | monorepo自动发现、子项目独立匹配、路径路由、@project快捷定位 |

### 4.2 亮点设计

1. **规则裁剪算法**（`filterRuleByLevel`）：通过 `<!--@level:summary/quick/full-->` 标记实现同一规则文件的多级裁剪，优雅解决 context window 有限的问题

2. **Workspace 路径路由**：按路径前缀匹配项目 → 加载对应 Layer2 规则缓存 → 应用技术栈约定，支持 `@project <名称>` 快捷定位

3. **统一调度指南**（prompt-builder.ts）：将 Agent 和 Skill 统一到"任务规模 → 场景分类 → 路由"的决策树中，减少 AI 的决策负担

4. **validator-gate 趋势分析**：不仅检查当前状态，还对比历史记录计算 delta（regressed/improved/stable）

### 4.3 不足

- ❌ **doctor 无自动修复**：��现问题后只报告，不提供 `--fix` 选项
- ❌ **execution-metrics 无闭环**：事件记录后无告警、无阈值、无异常检测
- ❌ **规则版本锁定缺失**：业务项目无法锁定特定版本的规则库
- ❌ **回滚能力有限**：虽有快���保留，但无一键回滚命令

---

## 五、维度 4：自驱动运行能力 — 评分 38/100

### 5.1 自驱动的定义

"自驱动"指系统安装到业务项目后，能够**不依赖人工干预**地持续发挥作用：
- 自动感知环境变化并响应
- 自动保持规则的最新状态
- 自动在关键时机执行校验
- 自动引导 AI 遵循规范

### 5.2 现状评估

| 自驱动能力 | 现状 | 评估 |
|-----------|------|------|
| 自动安装 | 无。需手动执行 loader | ❌ 不具备 |
| 自动更新 | 无。需手动重新执行 loader | ❌ 不具备 |
| 自动校验 | 无。需手动执行 validate:all | ❌ 不具备 |
| 自动修复 | 无。doctor 只报告不修复 | ❌ 不具备 |
| 规则自激活 | 部分。依赖 AI 遵循 project-rules.md 中的指令 | ⚠️ 弱依赖 |
| 任务自路由 | 部分。task-intake-router 需 AI 主动调用 | ⚠️ 弱依赖 |
| Agent 自触发 | 部分。触发词匹配依赖 AI 自主判断 | ⚠️ 弱依赖 |
| 编排自执行 | 部分。task-orchestrator 可闭环但需 AI 发起 | ⚠️ 弱依赖 |
| 变更感知 | 无。不监控 package.json 等文件变化 | ❌ 不具备 |
| 版本感知 | 无。不检查规则库是否有新版本 | ❌ 不具备 |

### 5.3 核心矛盾

项目的架构设计非常精细（三层规则、智能路由、编排闭环），但**缺乏驱动这些能力自动运转的引擎**。具体表现为：

1. **"安装即完成"假设**：系统假设安装后 `project-rules.md` 会被 AI 工具正确消费，但没有验证手段
2. **"AI 遵循指令"假设**：强制激活规则、任务路由、Agent 触发都依赖 AI 模型的指令遵循能力，没有程序化兜底
3. **"环境不变"假设**：安装后如果业务项目新增了依赖（如从 React 切换到 Vue），规则不会自动更新

---

## 六、综合评分与改进建议

### 6.1 综合评分

| 维度 | 评分 | 权重 | 加权分 |
|------|------|------|--------|
| 运行机制 | 78/100 | 25% | 19.5 |
| 触发时机 | 45/100 | 25% | 11.25 |
| 功能完善度 | 82/100 | 25% | 20.5 |
| 自驱动能力 | 38/100 | 25% | 9.5 |
| **综合** | **60.75/100** | - | - |

### 6.2 关键改进建议

#### 🔴 P0：立即需要（触发时机 + 自驱动）

**1. npm 包化与 postinstall 集成**
```json
// 业务项目 package.json
{
  "devDependencies": {
    "my-fe-standards": "^3.3.0"
  },
  "scripts": {
    "postinstall": "codebuddy-loader install"
  }
}
```
- 在 package.json 中添加 `bin` 字段注册 CLI 命令
- 支持 `npx codebuddy-loader install` 一键安装
- 通过 postinstall 实现 `npm install` 后自动安装规则

**2. git hooks 集成（husky/simple-git-hooks）**
```bash
# pre-commit
node .codebuddy/scripts/validator-gate.js run --scope rules

# pre-push  
node .codebuddy/scripts/codebuddy-loader.js doctor
```
- 提供 husky 配置模板
- 在提交前自动校验规则一致性
- 在推送前自动执行健康检查

**3. 依赖变更感知**
```bash
# package.json 的 postinstall 中
codebuddy-loader install --if-deps-changed
```
- 在 install.json 中记录安装时的依赖哈希
- 检测到依赖变化时提示需要重新安装

#### 🟡 P1：近期需要（功能完善 + 运行机制）

**4. doctor --fix 自动修复**
- 缺失文件自动重新生成
- 越界残留文件自动清理
- 过期快照自动清理

**5. 版本检查与自动更新**
```bash
codebuddy-loader check-update
# 输出: my-fe-standards v3.3.0 → v3.4.0 available
# 选项: --auto-update
```
- 远程模式下比对 manifest 版本
- 支持 `--auto-update` 静默更新

**6. execution-metrics 告警阈值**
- 当 task_failed 连续 N 次时告警
- 当 workflow_route_fallback 比例过高时��警
- 输出到 `.codebuddy/reports/alerts/`

#### 🟢 P2：中期优化（自驱动能力）

**7. watch 模式**
```bash
codebuddy-loader watch
# 监控 package.json、tsconfig.json 等关键文件
# 变化时自动重新安装
```

**8. AI 遵循度验证机制**
- 在 agent-call 的 result.json 中记录是否读取了必要的规则文件
- 通过 execution-metrics 统计 Agent/Skill 的实际加载率
- 生成"规则遵循度报告"

**9. CI/CD 集成模板**
- 提供 GitHub Actions / GitLab CI 配置模板
- 在 CI 中自动运行 `validate:all:strict`
- 在 PR 中自动运行 `doctor --json`

---

## 七、架构级结论

### 项目最大优势
**精细的规则架构设计**：三层加载、规则裁剪、Workspace路由、技能/Agent统一调度 —— 这些设计在"规则如何被组织和消费"这个维度上达到了很高的成熟度。

### 项目最大短板
**缺乏自动化驱动层**：项目有引擎（codebuddy-loader）、有燃油（规则/技能/Agent）、有变速箱（task-intake-router / workflow-routing），但**缺少点火装置和自动驾驶系统**。所有能力都需要人工（或AI）主动触发，系统不会自己动起来。

### 改进优先级建议
```
Phase 1: npm包化 + postinstall + git hooks → 解决"触发时机"
Phase 2: doctor --fix + 版本检查 → 解决"功能完善度"  
Phase 3: watch模式 + AI遵循度验证 → 解决"自驱动能力"
```

---

## 八、关键文件索引

| 文件 | 行数 | 职责 |
|------|------|------|
| `scripts/src/codebuddy-loader.ts` | ~1587 | 核心加载器，安装主流程 |
| `scripts/src/generate-manifest.ts` | ~299 | manifest 和 ContentPack 生成 |
| `scripts/src/lib/install-sync.ts` | ~225 | 文件同步、增量写入、陈旧清理 |
| `scripts/src/lib/install-health.ts` | ~755 | 诊断系统（status/doctor） |
| `scripts/src/lib/prompt-builder.ts` | ~1320 | 提示词生成（AI消费的核心） |
| `scripts/src/lib/project-detection.ts` | - | 项目元数据检测 |
| `scripts/src/lib/context-targeting.ts` | - | 技能三层过滤 |
| `scripts/src/lib/workflow-routing.ts` | - | 工作流路由决策 |
| `scripts/src/lib/task-intake-routing.ts` | - | 任务入口判断 |
| `scripts/src/lib/execution-metrics.ts` | - | 事件记录和指标聚合 |
| `scripts/src/lib/distribution-profiles.ts` | - | 脚本分发档位管理 |
| `config/loader-config.json` | - | 三层规则配置中心 |
| `package.json` | 60 | 58个npm scripts，无bin/postinstall |

---

*报告完成。建议从 P0 改进项开始实施，优先解决触发时机和自驱动能力的短板。*
