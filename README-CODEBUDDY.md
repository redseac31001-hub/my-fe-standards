# 前端架构规范 - CodeBuddy GLM-4.7 专用版

> 专为 CodeBuddy (GLM-4.7) 优化的前端开发规范库

## 快速开始

### 方式一：直接复制规则文件

将 `rules/codebuddy-rules.md` 的内容复制到你的项目中：

```bash
# 克隆仓库
git clone -b feature/codebuddy-glm https://github.com/redseac31001-hub/my-fe-standards.git

# 进入目录
cd my-fe-standards

# 安装规则到当前项目
npm run codebuddy
```

### 方式二：在业务项目中使用

```bash
# 在你的业务项目目录下执行
npx https://github.com/redseac31001-hub/my-fe-standards#feature/codebuddy-glm
```

## 规则内容

本规范包含以下核心内容：

| 模块 | 说明 |
|------|------|
| **核心原则** | 最小改动原则、稳定优先原则 |
| **TypeScript 规范** | 类型安全、灵活处理遗留代码 |
| **Vue 组件规范** | Vue 2/3 最佳实践 |
| **重构检查清单** | P0/P1/P2 分级，避免过度重构 |
| **防御性编程边界** | 明确何时需要/不需要防御 |
| **自我验证协议** | 限制版 RCI，最多 2 轮 |
| **文件操作规范** | CodeBuddy 工具适配 |

## 与通用版本的区别

| 特性 | 通用版 (feature/remote-fetch) | CodeBuddy 版 (feature/codebuddy-glm) |
|------|-------------------------------|--------------------------------------|
| 规则文件 | 多文件分层 | 单一整合文件 |
| 语言 | 中英混合 | 全中文 |
| 工具名称 | Claude Code 工具 | CodeBuddy 工具 |
| 文件大小 | ~13 KB | ~4.5 KB |
| Skills 系统 | 支持 | 不支持 |
| MCP Server | 支持 | 不支持 |

## 文件结构

```
my-fe-standards/
├── rules/
│   └── codebuddy-rules.md    # 整合规则文件
├── scripts/
│   └── codebuddy-loader.js   # 加载脚本
├── config/
│   └── loader-config-codebuddy.json
└── .codebuddy/
    └── rules/
        └── project-rules.md  # 生成的规则文件
```

## 核心原则

### 1. 最小改动原则

- 仅修改与当前任务直接相关的代码
- 不要"顺手"修复无关问题
- 使用 `replace_in_file` 进行针对性编辑

### 2. 稳定优先原则

- "能工作的代码" > "完美的代码"
- 优先保持代码稳定性
- 改动范围应与任务范围匹配

### 3. 防御性编程边界

**必须防御**：用户输入、API 响应、异步操作

**不需要防御**：稳定的 Vuex store、简单 UI 操作

### 4. 自我验证限制

- 最多执行 2 轮自我批评
- P2 级问题不作为改进依据

## 命令

```bash
# 安装规则到当前项目
npm run codebuddy

# 或指定目标项目
npm run codebuddy /path/to/your/project
```

## 分支说明

- `main` - 稳定版本
- `feature/remote-fetch` - 通用版本（支持 Claude/GPT 等）
- `feature/codebuddy-glm` - CodeBuddy GLM-4.7 专用版本（当前分支）

## 许可证

MIT
