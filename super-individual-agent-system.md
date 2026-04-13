# 超级个体 Agent 系统设计方案
**Super Individual Powered by Claude Code**

> 版本：v1.0 | 日期：2026-04-11 | 状态：设计草案

---

## 一、核心理念

### 1.1 愿景

一个人，拥有一支专业团队的完整能力。

通过 Claude Code 驱动的模块化 Agent 体系，将软件研发全链路——从需求分析、UI 设计、代码开发、测试验证到上线运维——拆解为一组可独立运作、也可协同编排的专业 Agent。每个 Agent 是一名"专家单兵"，组合在一起是一条完整的"数字研发流水线"。

### 1.2 设计原则

**单兵作战**：每个 Agent 可独立接收指令、完成任务，具备该领域的专业深度。

**协同编排**：Agent 之间通过标准协议传递上下文，形成完整的研发流水线。

**规范驱动**：所有 Agent 的输出遵循统一规范，保证交付物的一致性与可追溯性。

**持续进化**：系统本身可自我优化——Agent 可以分析历史任务，迭代自身的 Prompt 与工具链。

**人在回路**：关键节点支持人工介入与审批，AI 执行，人类决策。

---

## 二、系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    超级个体控制台 (CLI / Web UI)               │
│              任务入口 · 进度监控 · 人工审批节点                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Orchestrator│  ← 主编排 Agent
                    │   Agent     │     任务拆解 · 调度 · 上下文管理
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────────┐
        │                  │                      │
   ┌────▼────┐        ┌────▼────┐           ┌────▼────┐
   │   PM    │        │  Design │           │   Dev   │
   │  Agent  │        │  Agent  │           │  Agent  │
   └────┬────┘        └────┬────┘           └────┬────┘
        │                  │                      │
   ┌────▼────┐        ┌────▼────┐           ┌────▼────┐
   │   QA    │        │  DevOps │           │ Review  │
   │  Agent  │        │  Agent  │           │  Agent  │
   └─────────┘        └─────────┘           └─────────┘
        │                  │                      │
        └──────────────────▼──────────────────────┘
                    ┌──────────────┐
                    │  共享上下文层  │
                    │ Context Store│
                    └──────────────┘
```

### 2.2 核心层次

**执行层**：Claude Code CLI，所有 Agent 的代码执行、文件操作、命令运行均在此层完成。

**Agent 层**：各专业 Agent，每个 Agent 由 System Prompt + 工具集 + 规范文档 组成。

**编排层**：Orchestrator Agent，负责任务理解、分解、调度与结果汇总。

**上下文层**：Context Store，跨 Agent 的共享记忆，存储项目状态、决策记录、产出物索引。

**接口层**：统一的 CLI 指令 + 可选 Web Dashboard，供人类介入与监控。

---

## 三、Agent 详细设计

### 3.1 Orchestrator Agent（主编排）

**职责**：接收自然语言需求，拆解为子任务，调度合适的专业 Agent，管理执行顺序与依赖关系，汇总最终交付物。

**核心能力**

- 需求理解与任务图生成（DAG）
- Agent 选择与参数传递
- 阶段性 Checkpoint 与人工审批触发
- 失败重试与降级处理
- 全局进度追踪

**触发方式**

```bash
# 全流程启动
claude-super start "开发一个用户管理后台，支持增删改查和权限控制"

# 指定阶段
claude-super run --from design --to dev

# 单 Agent 调用
claude-super agent ui "设计登录页面，Material Design 风格"
```

**输出产物**：任务计划书（task-plan.md）、执行日志、各 Agent 产出物索引。

---

### 3.2 PM Agent（产品需求）

**职责**：将模糊的业务想法转化为结构化的产品需求文档，输出可被后续 Agent 直接消费的标准化规格。

**核心能力**

- 用户故事生成（User Story + Acceptance Criteria）
- PRD 文档撰写
- 功能优先级排序（MoSCoW 方法）
- 竞品分析建议
- 需求澄清问题生成（与用户对话）

**输出规范**

```markdown
# PRD: {功能名称}
## 背景与目标
## 用户画像
## 核心功能列表
  - Feature ID / 名称 / 优先级 / 验收标准
## 非功能需求（性能 / 安全 / 兼容性）
## 边界与排除项
## 依赖与风险
```

**工具链**：Claude API（需求生成）、Web Search（竞品调研）、文件系统（文档存储）。

---

### 3.3 Design Agent（UI/UX 设计）

**职责**：根据 PRD 和设计规范，生成高质量、可直接使用的 UI 代码，支持多套设计体系，输出可在浏览器预览的原型。

这是当前优先构建的核心 Agent。

**核心能力**

- 设计规范解析（Material / Ant Design / Apple HIG / 自定义 Token）
- 页面级 UI 生成（React / HTML）
- 组件级生成（Button、Form、Table、Modal 等）
- 设计 Token 管理（颜色、字体、间距体系）
- 响应式与可访问性（a11y）保障
- 与 Figma MCP 集成（读取设计稿 → 生成代码）
- 设计评审报告（对照规范的自检）

**设计规范体系**

```
/design-system/
  tokens.json          # 设计 Token（颜色/字体/间距/圆角/阴影）
  components.md        # 组件规范文档
  patterns.md          # 交互模式库
  rules.md             # 设计决策规则
  examples/            # 参考示例页面
```

**内置规范库**

| 规范 | 适用场景 | 组件库 |
|------|---------|--------|
| Material Design 3 | To C 应用 / Android | MUI v6 |
| Ant Design 5 | 企业后台 / B 端 | antd |
| Apple HIG | iOS / macOS / Web | 自定义实现 |
| Shadcn/UI | 现代 SaaS | shadcn + Tailwind |
| 自定义规范 | 品牌一致性 | 上传 tokens.json |

**生成流程**

```
PRD + 规范选择
    ↓
理解页面结构（Layout / 信息层级）
    ↓
选择/生成组件列表
    ↓
生成 React 代码（含 Props / State）
    ↓
规范自检（颜色对比度 / 间距 / 字号）
    ↓
输出预览文件 + 组件文档
```

**输出产物**

- `pages/` —— 页面级 React 组件
- `components/` —— 可复用组件库
- `preview.html` —— 可直接浏览器预览
- `design-review.md` —— 设计规范符合性报告

---

### 3.4 Dev Agent（代码开发）

**职责**：根据 PRD 和 UI 产出物，生成完整的前后端业务代码，遵循项目技术栈规范，输出可运行的功能模块。

**核心能力**

- 技术栈识别与适配（Next.js / Nest.js / FastAPI / Go 等）
- 数据模型设计（ER 图 → Schema）
- API 接口设计与实现（RESTful / GraphQL）
- 前端业务逻辑实现
- 单元测试代码生成
- 代码规范遵守（ESLint / Prettier / 项目约定）
- Git 提交规范（Conventional Commits）

**工程规范**

```
/project-spec/
  tech-stack.md        # 技术栈与版本约定
  api-conventions.md   # API 设计规范
  code-style.md        # 代码风格规范
  folder-structure.md  # 目录结构规范
  git-convention.md    # Git 提交与分支规范
```

**工具链**：Claude Code（代码生成与执行）、Bash（依赖安装 / 构建 / 运行）、文件系统。

---

### 3.5 Review Agent（代码评审）

**职责**：对 Dev Agent 产出的代码进行多维度评审，输出带注释的评审报告，支持自动修复建议。

**评审维度**

- **正确性**：逻辑是否符合需求，边界处理是否完整
- **安全性**：SQL 注入、XSS、权限漏洞、敏感信息泄露
- **性能**：N+1 查询、无谓渲染、内存泄漏风险
- **可维护性**：命名规范、函数复杂度、重复代码
- **规范符合度**：对照项目 code-style.md 检查

**输出产物**：`review-report.md`（问题列表 + 严重等级 + 修复建议）、自动修复的 PR diff。

---

### 3.6 QA Agent（测试验证）

**职责**：根据 PRD 的验收标准，设计并执行测试用例，输出测试报告，标记未通过的功能。

**核心能力**

- 测试用例自动生成（基于 Acceptance Criteria）
- 单元测试执行（Jest / Vitest / Pytest）
- E2E 测试脚本生成（Playwright）
- API 测试（基于 OpenAPI Spec）
- 可访问性测试（axe-core）
- 回归测试套件维护

**输出产物**：`test-cases.md`、`test-report.html`、失败截图、覆盖率报告。

---

### 3.7 DevOps Agent（部署上线）

**职责**：将通过测试的代码自动化部署到目标环境，管理环境配置，监控上线健康状态。

**核心能力**

- 环境配置管理（.env 规范化）
- Docker 镜像构建与推送
- CI/CD 流水线生成（GitHub Actions / GitLab CI）
- 云平台部署（Vercel / Railway / AWS / 阿里云）
- 上线后健康检查（HTTP 探针 / 错误率监控）
- 回滚策略执行

**工具链**：Bash（Docker / CLI 工具）、云平台 API、监控平台 API。

---

## 四、共享上下文层（Context Store）

所有 Agent 共享同一个项目上下文，保证信息不割裂。

### 4.1 数据结构

```json
{
  "project": {
    "id": "proj_xxx",
    "name": "用户管理后台",
    "created_at": "2026-04-11",
    "tech_stack": { "frontend": "Next.js 15", "backend": "Nest.js", "db": "PostgreSQL" },
    "design_system": "ant-design-5"
  },
  "artifacts": {
    "prd": "docs/prd.md",
    "design": ["pages/login.tsx", "pages/user-list.tsx"],
    "api_spec": "docs/openapi.yaml",
    "test_report": "reports/test-2026-04-11.html"
  },
  "decisions": [
    { "agent": "PM", "decision": "排除移动端适配，MVP 仅做 PC", "reason": "资源限制", "ts": "..." }
  ],
  "checkpoints": [
    { "stage": "design", "status": "approved", "approver": "human", "ts": "..." }
  ]
}
```

### 4.2 上下文传递规范

每个 Agent 调用时，自动注入：

1. 项目基础信息（tech_stack / design_system）
2. 上游 Agent 的产出物路径
3. 本阶段的规范文档内容
4. 历史决策记录（避免重复犯错）

---

## 五、标准工作流

### 5.1 全流程模式

```
用户输入需求
     ↓
[Orchestrator] 理解 → 拆解任务图
     ↓
[PM Agent] 生成 PRD + 用户故事
     ↓ ← 人工审批节点 ①
[Design Agent] 生成 UI 原型 + 组件
     ↓ ← 人工审批节点 ②
[Dev Agent] 实现业务代码
     ↓
[Review Agent] 代码评审 + 自动修复
     ↓
[QA Agent] 测试执行 + 报告
     ↓ ← 人工审批节点 ③
[DevOps Agent] 部署上线
     ↓
上线成功通知 + 监控链接
```

### 5.2 单兵模式示例

```bash
# 仅调用 Design Agent
claude-super agent design \
  --spec "一个数据看板页面，包含 4 个 KPI 卡片、折线图、数据表格" \
  --system ant-design-5 \
  --output ./src/pages/dashboard

# 仅调用 QA Agent
claude-super agent qa \
  --prd docs/prd.md \
  --code src/ \
  --run-e2e true

# 仅调用 Review Agent
claude-super agent review \
  --diff git diff main...feature/login \
  --spec project-spec/
```

---

## 六、规范体系

### 6.1 规范文件结构

```
/specs/                          # 项目级规范根目录
  agents/
    pm-agent/
      system-prompt.md           # PM Agent 的 System Prompt
      output-template.md         # PRD 输出模板
    design-agent/
      system-prompt.md
      design-tokens.json         # 默认设计 Token
      component-rules.md         # 组件生成规则
      a11y-checklist.md          # 可访问性检查清单
    dev-agent/
      system-prompt.md
      code-conventions.md
      api-design-rules.md
    qa-agent/
      system-prompt.md
      test-case-template.md
    review-agent/
      system-prompt.md
      review-checklist.md
    devops-agent/
      system-prompt.md
      deploy-checklist.md
  shared/
    project-template.json        # 项目上下文模板
    decision-log-template.md     # 决策日志模板
```

### 6.2 Agent System Prompt 规范

每个 Agent 的 System Prompt 包含固定结构：

```markdown
# {Agent Name} — 角色定义

## 你是谁
## 你的输入是什么
## 你的输出是什么（格式 / 路径 / 规范）
## 你必须遵守的规则
## 你可以使用的工具
## 你的思考流程（Chain of Thought 指引）
## 错误处理：遇到不确定时，你应该做什么
```

---

## 七、技术实现路径

### 7.1 Phase 1：基础框架（当前阶段）

**目标**：验证核心流程，建立规范体系。

- [ ] 设计 Context Store 数据结构
- [ ] 实现 Design Agent（UI 生成核心能力）
- [ ] 建立设计规范库（Ant Design + Material）
- [ ] CLI 基础指令框架
- [ ] 人工审批节点交互

**交付物**：可运行的 Design Agent 单兵版本。

### 7.2 Phase 2：多 Agent 联动

**目标**：PM → Design → Dev 三段流水线打通。

- [ ] Orchestrator Agent 实现
- [ ] PM Agent 实现
- [ ] Dev Agent 实现
- [ ] Context Store 持久化
- [ ] Agent 间上下文传递协议

**交付物**：从需求到代码的自动化流水线 Demo。

### 7.3 Phase 3：质量与闭环

**目标**：加入 Review、QA、DevOps，形成完整闭环。

- [ ] Review Agent 实现
- [ ] QA Agent（单测 + E2E）实现
- [ ] DevOps Agent 实现（Vercel / Docker）
- [ ] 全链路集成测试
- [ ] Web Dashboard（可视化监控）

**交付物**：完整的超级个体系统 v1.0。

### 7.4 Phase 4：自进化能力

**目标**：系统能够从历史任务中学习，持续优化自身。

- [ ] 任务历史数据库
- [ ] Agent 效果评估指标体系
- [ ] System Prompt 自动优化（基于成功/失败案例）
- [ ] 私有设计规范学习（从现有项目提取 Token）
- [ ] MCP 生态扩展（Figma / Linear / Notion）

---

## 八、Design Agent 详细规格（优先实现）

### 8.1 能力矩阵

| 能力 | 描述 | 优先级 |
|------|------|--------|
| 页面生成 | 根据描述生成完整页面 | P0 |
| 组件生成 | 生成单个 UI 组件 | P0 |
| 规范切换 | 支持多套设计体系 | P0 |
| 响应式 | 适配不同屏幕尺寸 | P1 |
| 暗黑模式 | Light/Dark 切换 | P1 |
| Figma 导入 | 读取 Figma 文件生成代码 | P1 |
| 设计自检 | 对照规范自动检查 | P2 |
| Token 学习 | 从现有项目提取设计 Token | P2 |

### 8.2 Design Agent System Prompt 核心节选

```markdown
你是一名资深 UI 工程师，精通 React、Tailwind CSS 和主流设计系统。

## 你的输入
- 功能描述（来自 PRD 或用户直接输入）
- 设计规范（设计 Token + 组件规则）
- 技术栈（React / Vue / 纯 HTML）

## 你的输出规范
1. 所有颜色必须来自设计 Token，禁止硬编码颜色值
2. 间距使用 4px 基准网格（4/8/12/16/24/32/48/64）
3. 字体大小遵循规范层级（xs/sm/base/lg/xl/2xl/3xl）
4. 交互状态完整（default / hover / active / disabled / loading）
5. 包含必要的 ARIA 属性
6. 代码可直接运行，无需额外配置

## 你的思考流程
1. 理解页面目的和核心用户任务
2. 确定信息层级和视觉重心
3. 拆解页面为组件树
4. 逐组件生成代码
5. 组装为完整页面
6. 自检：颜色 / 间距 / 可访问性
```

### 8.3 设计 Token 标准格式

```json
{
  "color": {
    "brand": { "primary": "#1677FF", "secondary": "#722ED1" },
    "neutral": { "0": "#fff", "100": "#F5F5F5", "900": "#141414" },
    "semantic": { "success": "#52C41A", "warning": "#FAAD14", "error": "#FF4D4F" }
  },
  "typography": {
    "fontFamily": { "sans": "Inter, sans-serif", "mono": "JetBrains Mono, monospace" },
    "fontSize": { "xs": "12px", "sm": "14px", "base": "16px", "lg": "18px", "xl": "20px" },
    "fontWeight": { "regular": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "lineHeight": { "tight": 1.25, "normal": 1.5, "relaxed": 1.75 }
  },
  "spacing": { "1": "4px", "2": "8px", "3": "12px", "4": "16px", "6": "24px", "8": "32px" },
  "radius": { "sm": "4px", "md": "8px", "lg": "12px", "full": "9999px" },
  "shadow": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 6px rgba(0,0,0,0.07)",
    "lg": "0 10px 15px rgba(0,0,0,0.10)"
  }
}
```

---

## 九、前沿趋势对齐

### 9.1 AI-Native 工作流

- **Vibe Coding**：自然语言驱动代码生成，本系统的核心交互范式
- **Agent-to-Agent**：Agent 间通过结构化协议通信，而非人工中转
- **Human-in-the-Loop**：AI 执行，人类在关键节点决策，不是全自动也不是全手动

### 9.2 技术趋势适配

- **MCP 生态**：优先接入 Figma、Linear、Notion MCP，扩展 Agent 的工具边界
- **Context Window 优化**：结构化压缩上下文，避免 Token 浪费
- **Streaming 输出**：所有 Agent 支持流式输出，提升响应体验
- **本地优先**：核心执行在本地（Claude Code CLI），敏感代码不出域

### 9.3 可迭代架构设计

- **Prompt 版本控制**：System Prompt 纳入 Git 管理，可回滚、可 A/B 测试
- **工具热插拔**：每个 Agent 的工具集可配置，无需改代码
- **规范热更新**：设计 Token / 代码规范以文件形式存在，更新即生效
- **评估指标**：每次 Agent 执行记录质量分（人工评分 + 自动检查），驱动持续改进

---

## 十、快速开始（MVP 路径）

第一步：定义你的项目规范（/specs/ 目录初始化）

第二步：启动 Design Agent 单兵版本，验证 UI 生成质量

第三步：打通 PM → Design → Dev 三段流水线

第四步：加入 Review + QA，形成质量闭环

第五步：DevOps Agent 接入，实现一键部署

---

## 附录

### A. 目录结构约定

```
super-individual/
  agents/              # 各 Agent 实现
  specs/               # 规范文件（Prompt / Token / 模板）
  context/             # 项目上下文存储
  tools/               # 共享工具函数
  cli/                 # CLI 入口
  dashboard/           # Web 监控界面（Phase 3）
  examples/            # 示例项目
  docs/                # 系统文档
```

### B. 相关参考资源

- Claude Code 官方文档：https://docs.anthropic.com/claude-code
- MCP 协议规范：https://modelcontextprotocol.io
- Material Design 3：https://m3.material.io
- Ant Design 5：https://ant.design
- Figma MCP：https://mcp.figma.com

---

*本文档为动态设计方案，随系统演进持续更新。*
