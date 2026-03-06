# Custom Skills 使用指南

本文档列出了 `custom-skills` 文件夹下的所有自定义技能，并提供详细的使用说明。

---

## 技能列表概览

| 技能名称 | 描述 | 触发条件 |
|----------|------|----------|
| [frontend-code-review](#1-frontend-code-review-前端代码审查) | 前端代码审查工具 | 用户请求审查 `.tsx`、`.ts`、`.js` 文件 |
| [component-refactoring](#2-component-refactoring-组件重构) | React 组件重构工具 | 复杂度 > 50 或行数 > 300 的组件 |
| [frontend-testing](#3-frontend-testing-前端测试) | 前端测试生成工具 | 请求编写测试、Vitest、RTL 相关 |
| [skill-creator](#4-skill-creator-技能创建器) | 技能创建指南 | 创建或更新自定义技能 |

---

## 详细使用指南

### 1. frontend-code-review (前端代码审查)

#### 基本信息

- **名称**：frontend-code-review
- **路径**：`custom-skills/frontend-code-review/`
- **触发条件**：当用户请求审查前端文件（如 `.tsx`、`.ts`、`.js`）时触发

#### 功能描述

该技能用于审查前端代码，支持两种审查模式：

1. **待提交变更审查（Pending-change review）**
   - 检查暂存区/工作树中准备提交的文件
   - 在提交前标记检查清单违规项

2. **指定文件审查（File-targeted review）**
   - 审查用户指定的特定文件
   - 报告相关的检查清单发现

#### 检查规则分类

##### 代码质量（Code Quality）

| 规则 | 紧急程度 | 说明 |
|------|----------|------|
| 条件类名使用工具函数 | 🔴 紧急 | 使用 `cn()` 工具函数处理条件 CSS |
| Tailwind 优先样式 | 🔴 紧急 | 优先使用 Tailwind CSS 工具类 |
| 类名顺序便于覆盖 | ⚪ 建议 | 将传入的 `className` prop 放在组件自身类值之后 |

##### 性能（Performance）

| 规则 | 紧急程度 | 说明 |
|------|----------|------|
| React Flow 数据使用 | 🔴 紧急 | UI 消费使用 `useNodes`/`useEdges` |
| 复杂 prop 记忆化 | 🔴 紧急 | 使用 `useMemo` 包装复杂 prop 值 |

##### 业务逻辑（Business Logic）

| 规则 | 紧急程度 | 说明 |
|------|----------|------|
| Node 组件禁用 workflowStore | 🔴 紧急 | Node 组件中不能使用 workflowStore |

#### 输出格式

**模板 A（发现问题时）**：
```
# Code review
Found <N> urgent issues need to be fixed:

## 1 <问题简述>
FilePath: <路径> line <行号>
<相关代码片段>

### Suggested fix
<修复建议>
---
```

**模板 B（无问题时）**：
```
## Code review
No issues found.
```

#### 文件结构

```
custom-skills/frontend-code-review/
├── SKILL.md
└── references/
    ├── code-quality.md
    ├── performance.md
    └── business-logic.md
```

---

### 2. component-refactoring (组件重构)

#### 基本信息

- **名称**：component-refactoring
- **路径**：`custom-skills/component-refactoring/`
- **触发条件**：
  - 项目自带 `pnpm analyze-component --json` 时显示复杂度 > 50 或行数 > 300
  - 用户请求代码拆分、Hook 提取或复杂度降低
  - 项目自带 `pnpm analyze-component` 且提示需要在测试前重构

#### 复杂度评分解读

| 分数 | 级别 | 操作建议 |
|------|------|----------|
| 0-25 | 🟢 简单 | 可直接测试 |
| 26-50 | 🟡 中等 | 考虑小幅重构 |
| 51-75 | 🟠 复杂 | **测试前必须重构** |
| 76-100 | 🔴 非常复杂 | **必须重构** |

#### 核心重构模式

##### 模式 1：提取自定义 Hook

**适用场景**：组件有复杂状态管理、多个 `useState`/`useEffect`、或业务逻辑与 UI 混合

```typescript
// ❌ 重构前：复杂状态逻辑在组件中
const Configuration: FC = () => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(...)
  const [datasetConfigs, setDatasetConfigs] = useState<DatasetConfigs>(...)
  // 50+ 行状态管理逻辑...
}

// ✅ 重构后：提取到自定义 Hook
// hooks/use-model-config.ts
export const useModelConfig = (appId: string) => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(...)
  return { modelConfig, setModelConfig }
}

const Configuration: FC = () => {
  const { modelConfig, setModelConfig } = useModelConfig(appId)
  return <div>...</div>
}
```

##### 模式 2：提取子组件

**适用场景**：单个组件有多个 UI 区块、条件渲染块或重复模式

```typescript
// ✅ 拆分为聚焦的组件
// app-info/
//   ├── index.tsx           (仅编排)
//   ├── app-header.tsx      (头部 UI)
//   ├── app-operations.tsx  (操作 UI)
//   └── app-modals.tsx      (弹窗管理)
```

##### 模式 3：简化条件逻辑

**适用场景**：深层嵌套（> 3 层）、复杂三元表达式、多个 `if/else` 链

```typescript
// ✅ 使用查找表 + 提前返回
const TEMPLATE_MAP = {
  [AppModeEnum.CHAT]: {
    [LanguagesSupported[1]]: TemplateChatZh,
    default: TemplateChatEn,
  },
}
```

##### 模式 4：提取 API/数据逻辑

**适用场景**：组件直接处理 API 调用、数据转换或复杂异步操作

```typescript
// ✅ 使用 React Query
export const useAppConfig = (appId: string, isBasicApp: boolean) => {
  return useQuery({
    enabled: isBasicApp && !!appId,
    queryKey: [NAME_SPACE, 'detail', appId],
    queryFn: () => get<AppDetailResponse>(`/apps/${appId}`),
  })
}
```

##### 模式 5：提取弹窗管理

```typescript
type ModalType = 'edit' | 'duplicate' | 'delete' | null

const useAppInfoModals = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  return { activeModal, openModal, closeModal, isOpen }
}
```

#### 常用命令

```bash
cd web

# 生成重构提示
pnpm refactor-component <path>   # 项目自带时可用

# 输出重构分析为 JSON
pnpm refactor-component <path> --json   # 项目自带时可用

# 分析组件复杂度
pnpm analyze-component <path> --json   # 项目自带时可用
```

#### 重构工作流

1. **生成重构提示**：项目提供该命令时运行 `pnpm refactor-component <path>`
2. **分析详情**：项目提供该命令时运行 `pnpm analyze-component <path> --json`
3. **制定计划**：根据检测到的特性规划重构
4. **增量执行**：每次提取一个部分，运行 lint、类型检查和测试
5. **验证**：重新运行分析命令验证改进

#### 文件结构

```
custom-skills/component-refactoring/
├── SKILL.md
└── references/
    ├── complexity-patterns.md
    ├── component-splitting.md
    └── hook-extraction.md
```

---

### 3. frontend-testing (前端测试)

#### 基本信息

- **名称**：frontend-testing
- **路径**：`custom-skills/frontend-testing/`
- **触发条件**：
  - 请求为组件、Hook 或工具函数编写测试
  - 提及 Vitest、React Testing Library、RTL 或 spec 文件
  - 请求测试覆盖率改进
  - 项目提供 `pnpm analyze-component` 时可用其输出作为上下文

#### 技术栈

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | 4.0.16 | 测试运行器 |
| React Testing Library | 16.0 | 组件测试 |
| jsdom | - | 测试环境 |
| nock | 14.0 | HTTP 模拟 |

#### 常用命令

```bash
# 运行所有测试
pnpm test

# 监视模式
pnpm test:watch

# 运行特定文件
pnpm test path/to/file.spec.tsx

# 生成覆盖率报告
pnpm test:coverage

# 分析组件复杂度（项目提供该命令时）
pnpm analyze-component <path>
```

#### 测试结构模板

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Component from './index'

// ✅ 只模拟外部依赖
vi.mock('@/service/api')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()  // ✅ 每个测试前重置
  })

  // 渲染测试（必需）
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<Component />)
      expect(screen.getByText('Test')).toBeInTheDocument()
    })
  })

  // Props 测试（必需）
  describe('Props', () => { ... })

  // 用户交互
  describe('User Interactions', () => { ... })

  // 边界情况（必需）
  describe('Edge Cases', () => { ... })
})
```

#### 测试工作流（关键）

**⚠️ 必须采用增量方式**

```
对于每个文件：
  ┌────────────────────────────────────────┐
  │ 1. 编写测试                             │
  │ 2. 运行: pnpm test <file>.spec.tsx     │
  │ 3. 通过? → 标记完成，下一个文件          │
  │    失败? → 先修复，再继续                │
  └────────────────────────────────────────┘
```

**复杂度顺序**：
1. 🟢 工具函数（最简单）
2. 🟢 自定义 Hook
3. 🟡 简单组件（展示型）
4. 🟡 中等组件（状态、副作用）
5. 🔴 复杂组件（API、路由）
6. 🔴 集成测试（index 文件 - 最后）

#### 核心原则

1. **AAA 模式**：Arrange（准备）- Act（执行）- Assert（断言）
2. **黑盒测试**：测试可观察行为，而非实现细节
3. **单一行为**：每个测试验证一个用户可观察的行为
4. **语义命名**：`should <行为> when <条件>`

#### 覆盖率目标（每个文件）

- ✅ **100%** 函数覆盖率
- ✅ **100%** 语句覆盖率
- ✅ **>95%** 分支覆盖率
- ✅ **>95%** 行覆盖率

#### 文件结构

```
custom-skills/frontend-testing/
├── SKILL.md
├── assets/
│   ├── component-test.template.tsx
│   ├── hook-test.template.ts
│   └── utility-test.template.ts
└── references/
    ├── async-testing.md
    ├── checklist.md
    ├── common-patterns.md
    ├── domain-components.md
    ├── mocking.md
    └── workflow.md
```

---

### 4. skill-creator (技能创建器)

#### 基本信息

- **名称**：skill-creator
- **路径**：`custom-skills/skill-creator/`
- **触发条件**：用户想要创建新技能或更新现有技能

#### 技能是什么

技能是模块化、自包含的包，通过提供以下内容扩展 Claude 的能力：
1. **专业工作流** - 特定领域的多步骤程序
2. **工具集成** - 处理特定文件格式或 API 的指令
3. **领域专业知识** - 公司特定知识、模式、业务逻辑
4. **捆绑资源** - 脚本、参考资料和资产

#### 技能结构

```
skill-name/
├── SKILL.md (必需)
│   ├── YAML frontmatter (name, description, optional metadata)
│   └── Markdown 指令
└── 捆绑资源 (可选)
    ├── scripts/      - 可执行脚本 (Python/Bash 等)
    ├── references/   - 按需加载的参考文档
    └── assets/       - 输出中使用的文件（模板、图标等）
```

#### 核心原则

##### 简洁是关键

上下文窗口是公共资源。只添加 Claude 尚未拥有的上下文。

##### 设置适当的自由度

| 自由度 | 使用场景 |
|--------|----------|
| 高（文本指令） | 多种方法有效，决策依赖上下文 |
| 中（伪代码/带参数脚本） | 存在首选模式，允许一些变化 |
| 低（特定脚本，少量参数） | 操作脆弱易错，一致性关键 |

##### 渐进式披露

1. **元数据**（name + description）- 始终在上下文中（约100词）
2. **SKILL.md body** - 技能触发时加载（<5k词）
3. **捆绑资源** - 按需由 Claude 加载（无限制）

#### 6 步创建流程

1. **理解技能**：通过具体示例理解技能用途
2. **规划内容**：分析需要哪些脚本、参考资料和资产
3. **初始化技能**：运行 `init_skill.py`
4. **编辑技能**：实现资源并编写 SKILL.md
5. **打包技能**：运行 `package_skill.py`
6. **迭代改进**：基于实际使用反馈优化

#### 常用命令

```bash
# 初始化新技能
scripts/init_skill.py <skill-name> --path <output-directory>

# 打包技能
scripts/package_skill.py <path/to/skill-folder>

# 快速验证
scripts/quick_validate.py <path/to/skill-folder>
```

#### SKILL.md 模板

```markdown
---
name: your-skill-name
description: "功能描述和触发条件"
---

# 技能标题

## Intent
描述技能的用途和触发场景

## 工作流程
详细的步骤说明

## 输出格式
期望的输出模板
```

#### 文件结构

```
custom-skills/skill-creator/
├── SKILL.md
├── scripts/
│   ├── init_skill.py
│   ├── package_skill.py
│   └── quick_validate.py
└── references/
    ├── output-patterns.md
    └── workflows.md
```

---

## 技能工作原理

```
用户请求 → Claude 读取所有 skills 的 description
        → 匹配到相关 skill
        → 加载该 skill 的 SKILL.md 内容
        → Claude 根据 SKILL.md 的指导：
            ├─ 执行 scripts/ 中的脚本
            ├─ 读取 references/ 中的参考文档
            └─ 使用 assets/ 中的资源文件
```

**关键点**：
- Claude 是决策者，SKILL.md 是操作手册
- references/ 中的文件按需加载
- scripts/ 可直接执行，无需读入上下文

---

## 技能关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    前端开发工作流                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐    复杂度 > 50    ┌─────────────────┐ │
│  │ frontend-code-   │ ───────────────→ │ component-      │ │
│  │ review           │                   │ refactoring     │ │
│  │ (代码审查)        │                   │ (组件重构)       │ │
│  └──────────────────┘                   └────────┬────────┘ │
│           │                                      │          │
│           │ 审查通过                              │ 重构完成  │
│           ↓                                      ↓          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              frontend-testing (前端测试)               │  │
│  │              生成 Vitest + RTL 测试                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    技能开发工作流                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              skill-creator (技能创建器)                 │  │
│  │              创建和管理自定义技能                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速参考

### 所有技能命令汇总

```bash
# === 代码审查 ===
# 触发：请求审查前端代码

# === 组件重构 ===
cd web
pnpm refactor-component <path>           # 项目提供该命令时生成重构提示
pnpm refactor-component <path> --json    # 项目提供该命令时输出 JSON
pnpm analyze-component <path> --json     # 项目提供该命令时分析复杂度

# === 前端测试 ===
cd web
pnpm test                                # 运行所有测试
pnpm test:watch                          # 监视模式
pnpm test path/to/file.spec.tsx          # 运行特定文件
pnpm test:coverage                       # 覆盖率报告
pnpm analyze-component <path>            # 项目提供该命令时分析组件
pnpm analyze-component <path> --review   # 项目提供该命令时审查现有测试

# === 技能创建 ===
scripts/init_skill.py <name> --path <dir>    # 初始化技能
scripts/package_skill.py <path>              # 打包技能
scripts/quick_validate.py <path>             # 快速验证
```

---

*文档更新时间：2026-01-12*
