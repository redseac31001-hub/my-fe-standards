# my-fe-standards 使用指南

> 面向 CodeBuddy coding-copilot 插件的前端架构规则库

## 快速开始

### 方式一：本地模式（推荐）

```bash
# 1. 克隆规则库到本地
git clone https://github.com/your-org/my-fe-standards.git

# 2. 进入你的目标项目目录
cd your-vue-project

# 3. 运行规则加载器
node /path/to/my-fe-standards/scripts/rule-loader.js
```

**输出**：生成 `.codebuddy/.rules/project-rules.md`，CodeBuddy 将自动识别。

---

### 方式二：远程模式

```bash
# 从远程 URL 加载规则（无需克隆仓库）
node rule-loader.js --remote https://raw.githubusercontent.com/your-org/my-fe-standards/main
```

---

## 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│                    rule-loader.js                           │
├─────────────────────────────────────────────────────────────┤
│  1. 读取目标项目的 package.json                              │
│  2. 检测技术栈 (Vue 2/3, TypeScript, UI 库)                  │
│  3. 根据依赖动态加载规则                                      │
│  4. 生成 .codebuddy/.rules/project-rules.md                 │
└─────────────────────────────────────────────────────────────┘
```

| 检测项 | 加载规则 |
|--------|----------|
| Vue 3 | `vue3-script-setup.md` |
| Vue 2 | `vue2-general.md` 或 `vue2-composition.md` |
| ant-design-vue | `antdv.md` |
| vant | `vant.md` |
| 始终加载 | `architecture`, `typescript`, `testing`, `debugging`, `refactoring`, `self-verification` |

---

## 目录结构

```
.codebuddy/
└── .rules/
    └── project-rules.md    # ← CodeBuddy 自动读取此文件
```

---

## 常用命令

```bash
# 本地测试
npm run test:local

# 远程测试
npm run test:remote

# 重新生成 manifest
npm run build:manifest
```

---

## 规则层级说明

| 层级 | 内容 | 加载策略 |
|------|------|----------|
| **Layer 1: Base** | 架构、TypeScript、Vue 规范 | 静态 + 技术栈检测 |
| **Layer 2: Business** | UI 库规范 (Antdv, Vant) | 按依赖加载 |
| **Layer 3: Action** | 调试、测试、重构、自验证 | 始终加载 |

---

## 自定义规则

1. 在 `rules/` 目录下新建 `.md` 文件
2. 运行 `npm run build:manifest` 更新清单
3. 修改 `config/loader-config.json` 配置加载策略

---

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| 远程加载超时 | 使用 `--timeout 30000` 增加超时时间 |
| 网络受限 | 使用镜像 URL 或本地模式 |
| 规则未生效 | 确认 `.codebuddy/.rules/project-rules.md` 已生成 |

---

## 更多信息

- 规则模板：`rules/_meta/rule-template.md`
- 配置说明：`config/loader-config.json`
