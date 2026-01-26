# AI 辅助开发平台

> **前端架构师规则库 + Ralph 自主编码系统**

这是一个完整的 AI 辅助开发平台，集成了：
- **规则引擎**：三层规则架构，为 CodeBuddy (GLM-4.7) 提供知识源
- **技能系统**：可扩展的专业技能库
- **Ralph 自主代理**：基于 PRD 的自主编码循环系统
- **MCP Server**：标准化工具接口

## 🎯 核心特性

- **三层规则架构**：基础层 + 业务层 + 动作层，渐进式加载
- **技能系统**：支持 CodeBuddy Skills，动态加载专业技能
- **Ralph 自主编码**：PRD 驱动的自主开发循环
- **智能检测**：自动识别 Vue 2/3 版本和 UI 库依赖
- **远程加载**：支持 HTTP 远程模式和 Git 私有仓库模式
- **多工具支持**：CodeBuddy / Claude Code / Amp
- **全中文支持**：规则内容和提示词全部使用简体中文

## 📂 目录结构

```text
my-fe-standards/
├── config/
│   └── loader-config.json      # 加载器配置
├── custom-skills/              # 🧩 技能库
│   ├── component-refactoring/  #    组件重构技能
│   ├── frontend-code-review/   #    代码审查技能
│   ├── frontend-testing/       #    前端测试技能
│   ├── prd/                    #    PRD 生成技能 (新增)
│   ├── ralph-converter/        #    PRD 转换技能 (新增)
│   └── skill-creator/          #    技能创建指南
├── packages/
│   └── agent/                  # 🤖 Ralph Agent (Claude SDK)
├── mcp-server/                 # 🔌 MCP Server
├── rules/
│   ├── layer1_base/            # 🧱 基础层 - 通用技术标准
│   ├── layer2_business/        # 🏢 业务层 - UI 库规范
│   └── layer3_action/          # ⚡ 动作层 - 任务检查清单
└── scripts/
    ├── dist/                   # 编译后的脚本
    ├── src/                    # TypeScript 源码
    └── ralph/                  # 🚀 Ralph 自主编码系统 (新增)
        ├── ralph.sh            #    自主循环脚本
        ├── prompt.md           #    Amp 提示词
        └── CLAUDE.md           #    Claude Code 提示词
```

## 🚀 快速开始

### 方式一：远程一键执行 (推荐)

无需下载任何文件，直接从远程拉取脚本并执行：

```bash
# 一键远程加载规则（无需预先下载脚本）
curl -fsSL https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm/scripts/dist/codebuddy-loader.js | node - --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/feature/codebuddy-glm
```

### 方式二：本地模式

```bash
# 1. 克隆仓库
git clone -b feature/codebuddy-glm https://github.com/redseac31001-hub/my-fe-standards.git
cd my-fe-standards

# 2. 在目标项目中运行加载器
node scripts/dist/codebuddy-loader.js /path/to/your/project

# 或使用 npm 脚本
npm run codebuddy
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

### 可用的 npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译 TypeScript + 生成 manifest.json |
| `npm run build:scripts` | 仅编译 TypeScript 脚本 |
| `npm run build:manifest` | 仅生成规则清单 manifest.json |
| `npm run codebuddy` | 本地模式运行加载器 |
| `npm run serve` | 启动本地 HTTP 服务器（测试用） |
| `npm run remote` | **远程模式测试**：从 GitHub 远程拉取脚本和规则 |

### 远程模式测试

`npm run remote` 命令用于验证完整的远程拉取流程：

```bash
# 1. 先将代码推送到 GitHub
git add . && git commit -m "更新规则" && git push

# 2. 运行远程测试
npm run remote
```

该命令会：
1. 从 GitHub Raw URL 下载 `codebuddy-loader.js`
2. 执行加载器，从远程拉取 `manifest.json` 和规则文件
3. 在当前目录生成 `.codebuddy/` 配置

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
