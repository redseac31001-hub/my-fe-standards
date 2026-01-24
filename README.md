# 前端架构师规则库 (CodeBuddy 专用版)

> 专为 **CodeBuddy (GLM-4.7)** 优化的前端开发规范知识库

这是一个标准化的前端专家规则库，旨在作为 CodeBuddy AI 编程助手的知识源 (Context Source)。通过维护一系列高质量、结构化的规则文件，确保 AI 助手在辅助编码时遵循团队的最佳实践和代码规范。

## 🎯 核心特性

- **三层规则架构**：基础层 + 业务层 + 动作层，渐进式加载
- **技能系统**：支持 CodeBuddy Skills，动态加载专业技能
- **智能检测**：自动识别 Vue 2/3 版本和 UI 库依赖
- **远程加载**：支持 HTTP 远程模式和 Git 私有仓库模式
- **全中文支持**：规则内容和提示词全部使用简体中文

## 📂 目录结构

```text
my-fe-standards/
├── config/
│   └── loader-config.json      # 加载器配置
├── custom-skills/              # 🧩 技能库 (CodeBuddy Skills)
│   ├── component-refactoring/  #    组件重构技能
│   ├── frontend-code-review/   #    代码审查技能
│   ├── frontend-testing/       #    前端测试技能
│   └── skill-creator/          #    技能创建指南
├── mcp-server/                 # 🔌 MCP Server (待后续实现)
├── rules/
│   ├── layer1_base/            # 🧱 基础层 - 通用技术标准
│   │   ├── architecture/       #    架构规范
│   │   ├── typescript/         #    TypeScript 类型安全
│   │   ├── vue3/               #    Vue 3 最佳实践
│   │   └── vue2/               #    Vue 2 兼容规则
│   ├── layer2_business/        # 🏢 业务层 - UI 库规范
│   │   ├── antdv.md            #    Ant Design Vue
│   │   └── vant.md             #    Vant UI
│   └── layer3_action/          # ⚡ 动作层 - 任务检查清单
│       ├── refactoring.md      #    重构检查清单
│       ├── debugging.md        #    调试检查清单
│       ├── testing.md          #    测试策略
│       └── self-verification.md #   自检清单
└── scripts/
    ├── codebuddy-loader.js     # 规则加载器
    └── generate-manifest.js    # Manifest 生成器
```

## 🚀 快速开始

### 方式一：本地模式

```bash
# 1. 克隆仓库
git clone -b feature/codebuddy-glm https://github.com/redseac31001-hub/my-fe-standards.git
cd my-fe-standards

# 2. 在目标项目中运行加载器
node scripts/codebuddy-loader.js /path/to/your/project
```

### 方式二：远程模式 (推荐)

```bash
# 下载加载器脚本到项目根目录
curl -O https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm/scripts/codebuddy-loader.js

# 从远程加载规则
node codebuddy-loader.js --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm
```

### 方式三：Git 私有仓库模式

```bash
# 在 package.json 中添加配置
{
  "scripts": {
    "rules:update": "node architect-bootstrap.js"
  },
  "architect": {
    "repo": "git@github.com:your-org/my-fe-standards.git",
    "branch": "feature/codebuddy-glm"
  }
}

# 执行更新
npm run rules:update
```

## 📋 三层规则架构

| 层级 | 加载模式 | 内容 |
|------|----------|------|
| **Layer 1 (Base)** | Eager 加载 | 通用的 Vue/TS/架构规范，根据项目自动分流 |
| **Layer 2 (Business)** | Lazy 加载 | 检测到特定 UI 库依赖时加载对应规范 |
| **Layer 3 (Action)** | Lazy 加载 | 任务检查清单，按需读取 |

### 渐进式加载

- **Layer 1** 规则直接嵌入 `project-rules.md`（核心规范常驻）
- **Layer 2/3** 规则生成索引，缓存到 `.codebuddy/rules_cache/`
- CodeBuddy 根据任务类型使用 `read_file` 按需加载

## 🧩 技能系统

本规则库支持 CodeBuddy Skills 功能，提供以下技能：

| 技能 | 触发场景 |
|------|----------|
| **component-refactoring** | 组件重构、代码优化 |
| **frontend-code-review** | 代码审查、PR Review |
| **frontend-testing** | 编写测试、测试策略 |
| **skill-creator** | 创建新技能 |

### 技能调用

当 CodeBuddy 识别到相关任务时，会自动：
1. 读取 `.codebuddy/skills/<技能ID>/SKILL.md`
2. 根据路由逻辑加载 `references/` 下的详细文档
3. 基于完整上下文执行任务

## 🔧 命令行选项

```bash
node codebuddy-loader.js [options]
```

| 选项 | 说明 |
|------|------|
| `--help, -h` | 显示帮助信息 |
| `--remote <URL>` | 从远程 URL 获取规则 |
| `--task <type>` | 按任务类型筛选规则 |
| `--threshold <n>` | 设置相关性阈值 (0-1) |
| `--verbose, -v` | 启用详细日志 |
| `--timeout <ms>` | 设置网络请求超时 |

### 任务类型

- `refactoring` - 代码重构、优化
- `debugging` - Bug 修复、问题排查
- `testing` - 编写测试、测试策略
- `new-feature` - 开发新功能
- `code-review` - 代码审查

## 📖 输出说明

加载器会在目标项目生成以下文件：

```text
.codebuddy/
├── rules/
│   └── project-rules.md    # 主规则文件 (CodeBuddy 自动读取)
├── rules_cache/            # 规则缓存 (按需读取)
│   ├── layer2_business/
│   └── layer3_action/
└── skills/                 # 技能文件 (动态加载)
```

## 🔨 开发指南

### 生成 Manifest

```bash
node scripts/generate-manifest.js
```

### 测试加载器

```bash
# 本地模式测试
node scripts/codebuddy-loader.js

# 远程模式测试
node scripts/codebuddy-loader.js --remote <URL> --verbose
```

### 添加新规则

1. 在对应层级目录创建 `.md` 文件
2. 参考 `rules/_meta/rule-template.md` 编写规则
3. 运行 `node scripts/generate-manifest.js` 更新清单

## 📝 规则编写指南

每条规则应包含：

1. **Context**: 适用场景
2. **The Rule**: 具体的规范描述
3. **Reasoning**: 背后的原理（帮助 AI 理解权衡）
4. **Examples**: 正面 (✅) 与反面 (❌) 的代码示例

## 🔗 相关文档

- [远程接入指南](docs/remote-usage-guide.md)
- [技能系统说明](custom-skills/custom-skills-guide.md)
- [技能增强文档](README-SKILLS-ENHANCEMENT.md)

## 📌 版本信息

- **版本**: 2.0.0
- **适用工具**: CodeBuddy (GLM-4.7)
- **分支**: feature/codebuddy-glm
- **更新日期**: 2026-01-24

## 📄 许可证

MIT
