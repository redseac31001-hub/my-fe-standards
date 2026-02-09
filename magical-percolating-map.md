# 计划：完整开发闭环流程分析与优化方案

## 一、流程合理性分析

### 1.1 原始流程回顾

```
需求分析 → PRD → 系统设计 → 需求分解/任务列表 → Open Spec → Spec Kit
→ TDD Task → 自驱测试 → 验收审查 → Build Fix → 可提交状态
```

共 11 个环节。下面逐一评估。

---

### 1.2 逐环节评估

#### ✅ 保留：需求分析（Requirement Clarification）
- **理由**：所有流程的起点，不可省略
- **现状**：planner Agent 有基础能力，prd Skill 有澄清问答机制
- **问题**：需求分析和 PRD 生成实际上是同一个动作的两面——澄清需求的过程就是在写 PRD
- **结论**：**与 PRD 合并为一个环节**

#### ✅ 保留：PRD 生成（与需求分析合并）
- **理由**：PRD 是后续所有环节的输入源，必须有
- **现状**：prd Skill 已经很完善（澄清问答 + 结构化输出 + User Stories + 验收标准）
- **结论**：保留，但需要增加结构化输出能力（当前只输出 Markdown，后续环节难以自动消费）

#### ⚠️ 需重新定义：系统设计（System Design）
- **问题**：对于前端项目，"系统设计"这个词太重了。前端的"系统设计"实际上是：
  - 组件树设计（哪些组件、层级关系）
  - 数据流设计（Store 结构、API 调用链）
  - 路由设计（页面结构）
  - 复用分析（哪些现有组件/工具可复用）
- **业界对比**：
  - Claude Code 的 Plan Mode = 分析代码 + 设计方案 + 用户确认，没有独立的"系统设计"环节
  - Codex 的 Task = 直接从需求到任务分解，设计内嵌在分解过程中
  - Cursor Composer = 分析上下文 + 直接生成代码，无显式设计阶段
- **结论**：**不单独设环节，融入"任务分解"阶段**。planner Agent 在分解任务时自然会做技术选型和模块划分。对于复杂项目，可选择性触发 structure-analyzer 做深度分析。

#### ✅ 保留：任务分解 / 计划（Task Decomposition）
- **理由**：这是你项目的核心竞争力——task-orchestrator + taskbook-manager 已经很成熟
- **现状**：7 阶段工作流，INVEST 原则，依赖分析，用户确认
- **结论**：保留，是流程的核心枢纽

#### ❌ 删除：Open Spec（接口契约）
- **问题**：
  1. 前端项目的"接口契约"实际上就是 TypeScript 类型定义，这是编码过程中自然产生的，不需要单独一个环节
  2. API 接口通常由后端定义，前端消费。前端单独定义 API Spec 没有意义
  3. 组件 Props/Events 的契约在 TDD 阶段通过测试用例自然定义（测试就是最好的契约）
  4. 业界没有任何主流 AI 编码工具有独立的"接口契约生成"环节
- **替代方案**：在 PRD 的 User Stories 中明确接口期望，在 TDD 阶段通过测试用例固化契约
- **结论**：**删除，能力分散到 PRD 和 TDD 中**

#### ❌ 删除：Spec Kit（实现规格包）
- **问题**：
  1. 这本质上是"任务分解"的细化版——每个任务要改哪些文件、创建哪些文件
  2. task-orchestrator 的 Phase 3（需求分解）已经在做这件事：拆分原子任务 + 定义验收标准
  3. 额外增加一个"规格包"环节会导致：信息重复（任务列表说一遍，规格包再说一遍）、维护成本翻倍、弱模型更容易迷失
  4. Claude Code / Codex 都是直接从任务描述开始编码，没有中间的"规格包"
- **替代方案**：在任务分解时，每个任务的描述中包含：影响文件列表、技术要点、验收标准
- **结论**：**删除，能力融入任务分解**

#### ✅ 保留但重命名：TDD Task → 测试先行实现（Test-First Implementation）
- **理由**：TDD 是提升弱模型代码质量的最有效手段——先写测试约束输出，再写实现
- **现状**：frontend-testing Skill 是知识型的，只提供测试模式参考，不驱动执行
- **问题**：需要一个能驱动 RED→GREEN→REFACTOR 循环的 Agent
- **业界趋势**：
  - Claude Code 的 tdd-guide Agent 就是这个模式
  - Codex 默认在沙箱中运行测试验证
  - 这是弱模型最需要的"护栏"——测试用例就是约束条件
- **结论**：保留，需要新建 tdd-driver Agent

#### ❌ 合并：自驱测试 → 融入 TDD
- **问题**："自驱测试"和"TDD Task"是同一件事的不同说法
- **结论**：**合并到 TDD 环节**，TDD 本身就包含"写测试→运行→验证"的自驱循环

#### ✅ 保留：代码审查（Code Review）
- **理由**：质量门禁，必须有
- **现状**：frontend-code-review Skill 存在但是知识型的，security-reviewer Agent 存在
- **问题**：缺少一个可执行的 code-review Agent
- **结论**：保留，需要新建 code-reviewer Agent

#### ✅ 保留：Build Fix
- **理由**：这是闭环的关键——构建失败后自动修复，而不是卡住等人
- **现状**：完全缺失
- **业界对比**：
  - Claude Code 有 build-error-resolver Agent
  - Codex 在沙箱中自动重试构建
  - 这是弱模型最容易卡住的地方（类型错误、导入错误等）
- **结论**：保留，需要新建 build-fix Agent

#### ✅ 保留：验收 → 可提交状态
- **理由**：闭环终点
- **现状**：task-orchestrator Phase 7 + acceptance report 已经很完善
- **结论**：保留现有实现

---

### 1.3 优化后的流程

**从 11 步精简为 7 步**：

```
① 需求澄清+PRD  →  ② 项目分析  →  ③ 任务分解+计划  →  ④ 测试先行实现(TDD)
→  ⑤ 代码审查  →  ⑥ 构建修复  →  ⑦ 验收提交
```

对比原始流程：

| 原始 11 步 | 优化后 7 步 | 处理方式 |
|-----------|-----------|---------|
| 需求分析 | ① 需求澄清+PRD | 合并 |
| PRD | ① 需求澄清+PRD | 合并 |
| 系统设计 | ③ 任务分解+计划 | 融入（planner 自然包含技术设计） |
| 需求分解/任务列表 | ③ 任务分解+计划 | 保留 |
| Open Spec | 删除 | 分散到 PRD 和 TDD |
| Spec Kit | 删除 | 融入任务分解 |
| TDD Task | ④ 测试先行实现 | 保留+增强 |
| 自驱测试 | ④ 测试先行实现 | 合并到 TDD |
| 验收审查 | ⑤ 代码审查 | 保留 |
| Build Fix | ⑥ 构建修复 | 保留（新建） |
| 可提交状态 | ⑦ 验收提交 | 保留 |

**精简理由**：
1. **减少弱模型的认知负担**——步骤越多，弱模型越容易在步骤间丢失上下文
2. **减少信息重复**——Open Spec 和 Spec Kit 的内容与 PRD、任务分解高度重叠
3. **符合业界实践**——Claude Code、Codex、Cursor 都是 Plan → Implement → Verify 三段式
4. **每一步都有明确的输入/输出契约**——不存在"可选"或"模糊"的环节

---

## 二、与业界趋势对比

### 2.1 Claude Code 的模式
```
Plan Mode(分析+设计+计划) → Implementation(编码) → Verification(测试+构建)
```
- 没有独立的 PRD/Spec 环节，Plan Mode 一步完成
- 强调 Agent 自主性，减少人工干预点
- 通过 hooks 实现自动格式化、类型检查

### 2.2 Codex (OpenAI) 的模式
```
Task Description → Sandbox Execution(编码+测试+构建) → PR Review
```
- 更激进：直接从任务描述到沙箱执行
- 沙箱内自动运行测试和构建
- 失败自动重试

### 2.3 你的项目的差异化定位
```
结构化流程引导 → 多 Agent 协作 → 弱模型也能执行
```
- **不是追求最少步骤**，而是追求**每一步都有足够的结构化引导**
- **不是依赖模型能力**，而是通过 Rules + Skills + Prompt 模板**补偿模型能力不足**
- **不是单 Agent 执行**，而是**多 Agent 分工协作**，每个 Agent 只需完成简单任务

这是你项目的核心价值：**让 GLM-4 级别的模型也能跑通 Claude Code 级别的工作流**。

---

## 三、现有资产盘点与缺口

### 3.1 已有且可直接复用

| 环节 | 已有资产 | 复用方式 |
|------|---------|---------|
| ① 需求澄清+PRD | `custom-skills/prd/SKILL.md` | 增强输出格式 |
| ② 项目分析 | `structure-analyzer` + `module-mapper` + `report-manager` | 直接复用 |
| ③ 任务分解 | `task-orchestrator` + `planner` + `taskbook-manager` | 直接复用 |
| ④ TDD（知识层） | `custom-skills/frontend-testing/` | 作为 tdd-driver 的知识源 |
| ⑤ 审查（知识层） | `custom-skills/frontend-code-review/` + `security-reviewer` Agent | 作为 code-reviewer 的知识源 |
| ⑦ 验收 | `task-orchestrator` Phase 7 + acceptance report | 直接复用 |

### 3.2 需要新建

| 缺口 | 类型 | 优先级 | 说明 |
|------|------|--------|------|
| tdd-driver Agent | Agent | **P0** | 驱动 RED→GREEN→REFACTOR 循环 |
| build-fix Agent | Agent | **P0** | 构建失败自动诊断修复 |
| code-reviewer Agent | Agent | **P1** | 将 Skill 升级为可执行 Agent |
| Prompt 模板体系 | 基础设施 | **P0** | 弱模型适配的核心 |

### 3.3 需要修改

| 文件 | 修改内容 | 优先级 |
|------|---------|--------|
| `workflows/templates/default.workflow.json` | 扩展为 7 步流程 | P0 |
| `scripts/src/types/index.ts` | 扩展 TaskType | P0 |
| `scripts/src/task-executor.ts` | 新任务类型路由 + prompt 注入 | P0 |
| `custom-skills/prd/SKILL.md` | 增加结构化输出 + TaskBook 衔接 | P1 |
| `agents/task-orchestrator/AGENT.md` | 更新 workflow 引用 | P1 |
| `scripts/src/codebuddy-loader.ts` | 分发 prompt 模板 | P1 |

---

## 四、优化后的实施计划

### 阶段 1：Workflow 扩展 + 类型系统更新

**目标**：将 workflow 从 6 步扩展为 7 步完整闭环

#### 1.1 更新 `workflows/templates/default.workflow.json`

新流程：
```json
{
  "steps": [
    { "id": "requirement_prd", "type": "requirement_and_prd", "title": "需求澄清与 PRD 生成" },
    { "id": "analyze", "type": "analyze_project", "title": "项目结构/模块分析" },
    { "id": "task_decompose", "type": "create_taskbook", "title": "任务分解与计划" },
    { "id": "tdd_implement", "type": "tdd_implement", "title": "测试先行实现" },
    { "id": "review", "type": "code_review", "title": "代码审查" },
    { "id": "build_fix", "type": "build_and_fix", "title": "构建验证与修复" },
    { "id": "acceptance", "type": "acceptance_and_archive", "title": "验收与提交" }
  ]
}
```

#### 1.2 更新 `scripts/src/types/index.ts`

扩展 TaskType：
```typescript
type TaskType =
  | 'requirement'    // 需求澄清
  | 'prd'            // PRD 生成
  | 'analysis'       // 项目分析
  | 'design'         // 技术设计（融入任务分解）
  | 'test'           // 测试编写（TDD RED）
  | 'implement'      // 代码实现（TDD GREEN）
  | 'refactor'       // 重构（TDD REFACTOR）
  | 'review'         // 代码审查
  | 'build-fix'      // 构建修复
  | 'acceptance'     // 验收
```

#### 1.3 更新 `scripts/src/task-executor.ts`

新增任务类型→Agent 路由：
- `requirement` / `prd` → prd Skill
- `test` → tdd-driver Agent
- `implement` → tdd-driver Agent（GREEN 阶段）
- `review` → code-reviewer Agent
- `build-fix` → build-fix Agent

---

### 阶段 2：新建核心 Agent

#### 2.1 tdd-driver Agent

**文件**：`agents/tdd-driver/AGENT.md`

核心工作流：
1. **读取任务描述和验收标准**（从 TaskBook）
2. **RED**：根据验收标准生成测试用例，运行确认失败
3. **GREEN**：编写最小实现代码，运行确认通过
4. **REFACTOR**：优化代码质量，运行确认仍通过
5. **输出**：测试文件 + 实现文件 + 覆盖率报告

关联资源：
- `custom-skills/frontend-testing/`（测试模式知识）
- `rules/layer3_action/testing.md`（测试规范）
- `rules/layer1_base/code-quality/clean-code.md`（代码质量）

#### 2.2 build-fix Agent

**文件**：`agents/build-fix/AGENT.md`

核心工作流：
1. **运行构建**：`npm run build` / `npm run typecheck`
2. **解析错误**：分类（类型错误/导入错误/语法错误/运行时错误）
3. **逐个修复**：按优先级修复，每次修复后重新验证
4. **循环**：最多 3 轮，超过请求人工介入
5. **输出**：修复报告 + 构建成功确认

关联资源：
- `custom-skills/build-optimization/`（构建知识）
- `rules/layer1_base/typescript/strict-types.md`（类型规范）

#### 2.3 code-reviewer Agent

**文件**：`agents/code-reviewer/AGENT.md`

核心工作流：
1. **收集变更**：读取 TaskBook 中已完成任务的 actualWork
2. **逐文件审查**：按 clean-code 规则 + 项目规范
3. **分级输出**：critical / high / medium / low
4. **自动修复**：medium 及以下自动修复，critical/high 生成修复任务
5. **输出**：审查报告

关联资源：
- `custom-skills/frontend-code-review/`（审查知识）
- `rules/layer1_base/code-quality/clean-code.md`（代码质量规则）
- `agents/security-reviewer/`（安全审查协作）

---

### 阶段 3：弱模型 Prompt 模板体系

**核心思路**：弱模型的问题是"不知道该做什么"。通过结构化 prompt 模板，将每个 Agent 的每个步骤固化为"填空题"。

#### 3.1 模板目录结构

```
agents/
├── tdd-driver/
│   ├── AGENT.md
│   └── prompts/
│       ├── red.md          # 测试编写引导
│       ├── green.md        # 实现编写引导
│       └── refactor.md     # 重构引导
├── build-fix/
│   ├── AGENT.md
│   └── prompts/
│       └── diagnose-fix.md # 诊断修复引导
├── code-reviewer/
│   ├── AGENT.md
│   └── prompts/
│       └── review.md       # 审查引导
```

#### 3.2 模板规范（每个模板必须包含）

```markdown
## 你的角色
[一句话定义]

## 你收到的输入
[明确列出字段和格式]

## 你必须执行的步骤
1. [具体动作]
2. [具体动作]
3. [具体动作]

## 你必须输出的内容
[格式 + 字段 + 示例]

## 完成前检查
- [ ] 检查项 1
- [ ] 检查项 2
```

#### 3.3 task-executor prompt 注入

修改 `scripts/src/task-executor.ts`：当生成 agent-call prompt 时，自动读取对应 Agent 的 prompt 模板，拼接到 prompt header 中。

#### 3.4 loader 分发

修改 `scripts/src/codebuddy-loader.ts`：分发 agents 时同时分发 prompts 目录。

---

### 阶段 4：集成验证 + 文档

#### 4.1 测试

修改 `test/run-tests.js`：
- 7 步 workflow 流转测试
- 新 Agent prompt 模板加载测试
- build-fix 错误解析测试
- 新任务类型路由测试

#### 4.2 文档更新

- `PROJECT.md`：更新能力矩阵和架构图
- `agents/AGENTS.md`：注册 tdd-driver、build-fix、code-reviewer
- `docs/HANDOFF.md`：更新交接说明
- `manifest.json`：重新生成

#### 4.3 验证命令

```bash
npm run build
node test/run-tests.js
```

---

## 五、为什么是 7 步而不是 11 步

| 维度 | 11 步 | 7 步 |
|------|-------|------|
| 弱模型友好度 | 差——步骤间上下文传递多，容易丢失 | 好——每步职责清晰，输入输出明确 |
| 信息重复 | 高——Open Spec/Spec Kit 与 PRD/任务分解重叠 | 低——每步产出唯一 |
| 维护成本 | 高——11 个环节的 Agent/Skill/Prompt 都要维护 | 适中——7 个环节 |
| 业界一致性 | 偏离——没有主流工具用 11 步 | 一致——Plan→Implement→Verify 三段式的细化 |
| 灵活性 | 差——小任务也要走 11 步 | 好——小任务可跳过 ①②，直接从 ③ 开始 |
| 闭环完整性 | 完整 | 同样完整，只是合并了重叠环节 |

---

## 六、关键文件清单

### 新建
| 文件 | 说明 |
|------|------|
| `agents/tdd-driver/AGENT.md` | TDD 驱动 Agent |
| `agents/tdd-driver/prompts/red.md` | RED 阶段 prompt |
| `agents/tdd-driver/prompts/green.md` | GREEN 阶段 prompt |
| `agents/tdd-driver/prompts/refactor.md` | REFACTOR 阶段 prompt |
| `agents/build-fix/AGENT.md` | 构建修复 Agent |
| `agents/build-fix/prompts/diagnose-fix.md` | 诊断修复 prompt |
| `agents/code-reviewer/AGENT.md` | 代码审查 Agent |
| `agents/code-reviewer/prompts/review.md` | 审查 prompt |

### 修改
| 文件 | 修改内容 |
|------|---------|
| `workflows/templates/default.workflow.json` | 7 步流程 |
| `scripts/src/types/index.ts` | 扩展 TaskType |
| `scripts/src/task-executor.ts` | 新路由 + prompt 注入 |
| `scripts/src/codebuddy-loader.ts` | 分发 prompts |
| `custom-skills/prd/SKILL.md` | 结构化输出增强 |
| `agents/task-orchestrator/AGENT.md` | 更新 workflow 引用 |
| `agents/AGENTS.md` | 注册新 Agent |
| `test/run-tests.js` | 新增测试 |
| `PROJECT.md` | 更新能力矩阵 |
| `docs/HANDOFF.md` | 更新交接说明 |

---

## 七、验证方式

1. `npm run build` 成功
2. `node test/run-tests.js` 全部通过
3. 在 mock project 中模拟 7 步 workflow 完整流转
4. 验证 prompt 模板被正确注入到 agent-call 中

---

## 八、实施顺序

阶段 1（Workflow + 类型） → 阶段 2（新建 Agent） → 阶段 3（Prompt 模板） → 阶段 4（集成验证）

每阶段完成后执行 `npm run build` 确认不破坏现有功能。
