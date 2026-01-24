# 项目架构设计文档

> 本文档定义了项目的核心架构设计，所有后续开发任务以此为基准。

## 项目概述

**项目名称**：my-fe-standards
**项目类型**：前端架构师规则库 - AI 编程助手（CodeBuddy GLM-4.7）的知识源与扩展工具

---

## Scripts 目录架构设计

### 核心原则

| 阶段 | 语言 | 目录 | 提交到 Git | 说明 |
|------|------|------|-----------|------|
| **开发** | TypeScript | `scripts/src/*.ts` | ✅ 是 | 类型安全、编译时校验 |
| **分发/执行** | JavaScript | `scripts/dist/*.js` | ✅ 是 | 用户直接可用，无需构建 |

### 目录结构

```
scripts/
├── src/                          # TypeScript 源码（开发用）
│   ├── types/
│   │   └── index.ts              # 类型定义
│   ├── generate-manifest.ts      # Manifest 生成器
│   ├── codebuddy-loader.ts       # 规则加载器（核心）
│   └── simple-server.ts          # 简单服务器
├── dist/                         # 编译输出（提交到 Git，用户直接使用）
│   ├── generate-manifest.js
│   ├── codebuddy-loader.js
│   └── simple-server.js
└── tsconfig.json                 # TypeScript 配置
```

### 开发流程

```
开发者修改 .ts 文件 → npm run build → 提交 src/ 和 dist/ 到 Git
```

### 用户使用流程

```
用户 clone/远程拉取 → 直接运行 node scripts/dist/codebuddy-loader.js → 完成
（无需 npm install，无需 npm run build）
```

---

## 构建命令

```bash
# 编译 TypeScript
npm run build:scripts

# 生成 manifest.json
npm run build:manifest

# 完整构建（编译 + 生成 manifest）
npm run build

# 运行规则加载器
npm run codebuddy
```

---

## 重要约定

1. **`scripts/dist/` 必须提交到 Git**
   这是用户直接使用的执行文件，确保 clone 后即可运行。

2. **修改 TypeScript 后必须重新构建**
   修改 `scripts/src/*.ts` 后，运行 `npm run build` 更新 `dist/` 目录。

3. **保持 JS 输出的零依赖**
   编译后的 JS 文件应仅使用 Node.js 内置模块，用户无需 `npm install`。

---

## 技术栈

- **开发语言**：TypeScript 5.x
- **运行环境**：Node.js（ES2018 目标）
- **模块规范**：CommonJS（兼容性）
- **包管理器**：npm

---

## 文件职责

| 文件 | 职责 |
|------|------|
| `generate-manifest.ts` | 扫描 rules/ 和 custom-skills/ 目录，生成 manifest.json |
| `codebuddy-loader.ts` | 三层规则架构加载器，支持远程/本地模式 |
| `simple-server.ts` | 简单 HTTP 服务器，用于本地测试 |
| `types/index.ts` | 共享类型定义 |
