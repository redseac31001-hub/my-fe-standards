# CodeBuddy 配置规范

> 本文档定义 CodeBuddy 的用户级和项目级配置结构，作为所有配置相关内容的权威参考。

## 目录

- [配置层级概述](#配置层级概述)
- [用户级配置](#用户级配置)
- [项目级配置](#项目级配置)
- [配置优先级](#配置优先级)
- [目录结构规范](#目录结构规范)
- [配置文件详解](#配置文件详解)

---

## 配置层级概述

CodeBuddy 采用**双层配置架构**，支持用户级全局配置和项目级局部配置：

| 层级 | 路径 | 作用域 | 优先级 |
|------|------|--------|--------|
| **用户级** | `C:\Users\<用户名>\.codebuddy\` | 所有项目共享 | 低 |
| **项目级** | `<项目根目录>\.codebuddy\` | 仅当前项目 | 高 |

**核心原则**：项目级配置 > 用户级配置（同名配置项目级覆盖用户级）

---

## 用户级配置

### 路径

```
C:\Users\<用户名>\.codebuddy\
```

### 目录结构

```
C:\Users\<用户名>\.codebuddy\
├── agents/                    # 用户级 Agents
│   ├── <agent-name>.md        # Agent 定义文件 (YAML frontmatter 格式)
│   └── ...
├── skills/                    # 用户级 Skills
│   ├── <skill-id>/
│   │   ├── SKILL.md           # Skill 定义文件
│   │   └── references/        # Skill 参考资料
│   └── ...
├── rules/                     # 用户级 Rules
│   └── user-rules.md          # 用户全局规则
└── settings.json              # 用户配置文件
```

### 用途说明

| 目录/文件 | 说明 |
|-----------|------|
| `agents/` | 用户自定义的全局 Agents，适用于所有项目 |
| `skills/` | 用户自定义的全局 Skills，适用于所有项目 |
| `rules/` | 用户全局规则，作为所有项目的基础规范 |
| `settings.json` | CodeBuddy 全局设置（主题、快捷键等） |

---

## 项目级配置

### 路径

```
<项目根目录>\.codebuddy\
```

### 目录结构

```
<项目根目录>\.codebuddy\
├── agents/                    # 项目级 Agents
│   ├── <agent-name>.md        # Agent 定义文件 (YAML frontmatter 格式)
│   └── ...
├── skills/                    # 项目级 Skills
│   ├── <skill-id>/
│   │   ├── SKILL.md           # Skill 定义文件
│   │   └── references/        # Skill 参考资料
│   └── ...
├── rules/                     # 项目级 Rules
│   └── project-rules.md       # 项目规则文件 (主入口)
├── rules_cache/               # 规则缓存 (Lazy Load)
│   ├── layer2_business/       # 业务层规则缓存
│   └── layer3_action/         # 动作层规则缓存
└── .gitignore                 # 忽略缓存文件
```

### 用途说明

| 目录/文件 | 说明 |
|-----------|------|
| `agents/` | 项目专属 Agents，仅在当前项目生效 |
| `skills/` | 项目专属 Skills，仅在当前项目生效 |
| `rules/project-rules.md` | **核心规则文件**，CodeBuddy 自动读取 |
| `rules_cache/` | Layer 2/3 规则缓存，按需加载 |

---

## 配置优先级

### 合并策略

当用户级和项目级存在同名配置时，遵循以下规则：

```
项目级配置 > 用户级配置
```

### Agents 合并

```
最终 Agents = 用户级 Agents + 项目级 Agents
（同 ID 的 Agent，项目级覆盖用户级）
```

### Skills 合并

```
最终 Skills = 用户级 Skills + 项目级 Skills
（同 ID 的 Skill，项目级覆盖用户级）
```

### Rules 合并

```
最终 Rules = 用户级 Rules + 项目级 Rules
（项目级规则追加到用户级规则之后，冲突时项目级优先）
```

---

## 目录结构规范

### 完整路径对照表

| 配置类型 | 用户级路径 | 项目级路径 |
|----------|-----------|-----------|
| **根目录** | `C:\Users\<用户名>\.codebuddy\` | `<项目>\.codebuddy\` |
| **Agents** | `C:\Users\<用户名>\.codebuddy\agents\` | `<项目>\.codebuddy\agents\` |
| **Skills** | `C:\Users\<用户名>\.codebuddy\skills\` | `<项目>\.codebuddy\skills\` |
| **Rules** | `C:\Users\<用户名>\.codebuddy\rules\` | `<项目>\.codebuddy\rules\` |
| **Settings** | `C:\Users\<用户名>\.codebuddy\settings.json` | - |

### 示例：Windows 完整路径

```
# 用户级
C:\Users\wozhifu\.codebuddy\
C:\Users\wozhifu\.codebuddy\agents\
C:\Users\wozhifu\.codebuddy\agent-snapshots\<snapshot-id>\
C:\Users\wozhifu\.codebuddy\skill-snapshots\<snapshot-id>\
C:\Users\wozhifu\.codebuddy\rules\

# 项目级 (以 my-fe-standards 为例)
E:\mygit\my-fe-standards\.codebuddy\
E:\mygit\my-fe-standards\.codebuddy\agent-snapshots\<snapshot-id>\
E:\mygit\my-fe-standards\.codebuddy\skill-snapshots\<snapshot-id>\
E:\mygit\my-fe-standards\.codebuddy\rules\
```

说明：项目级 `agent-snapshots/` 与 `skill-snapshots/` 均为不可变快照目录；loader 会将当前激活 root 记录到 `.codebuddy/install.json`，并自动保留最近 3 个快照。

---

## 配置文件详解

### 1. Agent 定义文件 (<agent-name>.md)

**路径**：`<agents目录>/<agent-name>.md`

**格式**：YAML Frontmatter + Markdown 内容

**完整结构**：

```markdown
---
name: <Agent 显示名称>
description: <Agent 功能描述>
model: glm-4.7
tools: list_files, search_file, search_content, read_file, read_lints, replace_in_file, write_to_file, execute_command, create_rule, delete_files, web_fetch, use_skill
agentMode: agentic
enabled: true
enabledAutoRun: true
---

<Agent 的详细说明、工作流程、使用指南等 Markdown 内容>
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | Agent 显示名称 |
| `description` | string | ✅ | Agent 功能描述 |
| `model` | string | ✅ | 使用的模型，如 `glm-4.7` |
| `tools` | string | ✅ | 可用工具列表，逗号分隔 |
| `agentMode` | string | ✅ | Agent 模式，固定为 `agentic` |
| `enabled` | boolean | ✅ | 是否启用 |
| `enabledAutoRun` | boolean | ✅ | 是否启用自动运行 |

**可用工具列表**：

| 工具 | 说明 |
|------|------|
| `list_files` | 列出目录文件 |
| `search_file` | 搜索文件 |
| `search_content` | 搜索文件内容 |
| `read_file` | 读取文件 |
| `read_lints` | 读取 Lint 结果 |
| `replace_in_file` | 替换文件内容 |
| `write_to_file` | 写入文件 |
| `execute_command` | 执行命令 |
| `create_rule` | 创建规则 |
| `delete_files` | 删除文件 |
| `web_fetch` | 网页抓取 |
| `use_skill` | 使用技能 |

**示例：用户级 Agent**

```markdown
---
name: 用户测试agent
description: 用户级全局测试Agent
model: glm-4.7
tools: list_files, search_file, search_content, read_file, read_lints, replace_in_file, write_to_file, execute_command, create_rule, delete_files, web_fetch, use_skill
agentMode: agentic
enabled: true
enabledAutoRun: true
---

这是一个用户级的测试 Agent，适用于所有项目。

## 使用场景
- 场景一
- 场景二

## 工作流程
1. 步骤一
2. 步骤二
```

**示例：项目级 Agent**

```markdown
---
name: 项目测试agent
description: 项目专属测试Agent
model: glm-4.7
tools: list_files, search_file, search_content, read_file, read_lints, replace_in_file, write_to_file, execute_command, create_rule, delete_files, web_fetch, use_skill
agentMode: agentic
enabled: true
enabledAutoRun: true
---

这是一个项目级的测试 Agent，仅在当前项目生效。

## 使用场景
- 项目特定场景

## 工作流程
1. 分析项目结构
2. 执行特定任务
```

### 2. Skill 定义文件 (SKILL.md)

**路径**：`<skills目录>/<skill-id>/SKILL.md`

**结构**：

```markdown
# <Skill 名称>

## 触发场景
描述何时使用此技能

## 核心能力
技能的主要功能

## 使用流程
1. 步骤一
2. 步骤二
3. ...

## 路由逻辑
根据任务类型加载不同的参考文档

## 参考资料
- [参考文档1](references/doc1.md)
- [参考文档2](references/doc2.md)
```

### 3. Rules 文件 (project-rules.md)

**路径**：`<rules目录>/project-rules.md`

**结构**：

```markdown
# 项目规则

## Layer 1: 基础规范
通用的技术标准和编码规范

## Layer 2: 业务规范
特定业务场景的规则索引

## Layer 3: 动作检查清单
任务类型的检查清单索引

## 技能索引
可用技能列表

## Agent 索引
可用 Agent 列表
```

### 4. 用户设置文件 (settings.json)

**路径**：`C:\Users\<用户名>\.codebuddy\settings.json`

**结构**：

```json
{
  "version": "1.0",
  "theme": "auto",
  "language": "zh-CN",
  "autoLoadRules": true,
  "cacheExpiry": 3600000,
  "remoteSource": {
    "enabled": false,
    "url": "",
    "branch": "main"
  }
}
```

---

## Git 忽略配置

### 项目级 .gitignore

建议将以下内容添加到项目 `.gitignore`：

```gitignore
# CodeBuddy 缓存
.codebuddy/rules_cache/

# 保留规则和配置
!.codebuddy/rules/
!.codebuddy/agents/
!.codebuddy/agent-snapshots/
!.codebuddy/skill-snapshots/
```

### 用户级配置

用户级配置通常不提交到任何仓库，仅存在于用户本地。

---

## 最佳实践

### 1. 分层管理

| 配置类型 | 放置位置 | 原因 |
|----------|----------|------|
| 通用编码规范 | 用户级 | 适用于所有项目 |
| 团队共享规则 | 项目级 + Git | 团队成员共享 |
| 个人偏好 | 用户级 | 不影响团队 |
| 项目特定规则 | 项目级 | 仅当前项目需要 |

### 2. Agent/Skill 命名约定

```
# Agent ID 命名
<领域>-<功能>
示例：frontend-reviewer, api-designer, test-generator

# Skill ID 命名
<动作>-<目标>
示例：component-refactoring, code-review, unit-testing
```

### 3. 规则文件命名约定

```
# Layer 1 (基础层)
rules/layer1_base/<技术栈>/<规则名>.md

# Layer 2 (业务层)
rules/layer2_business/<UI库或框架>.md

# Layer 3 (动作层)
rules/layer3_action/<任务类型>.md
```

---

## 配置加载流程

```
┌─────────────────────────────────────────────────────────────┐
│                    CodeBuddy 启动                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. 加载用户级配置                                           │
│     C:\Users\<用户名>\.codebuddy\                            │
│     ├── settings.json                                       │
│     ├── rules/user-rules.md                                 │
│     ├── agents/*                                            │
│     └── skills/*                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 加载项目级配置                                           │
│     <项目>\.codebuddy\                                       │
│     ├── rules/project-rules.md                              │
│     ├── agents/*                                            │
│     └── skills/*                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 合并配置                                                 │
│     - 项目级覆盖用户级（同名配置）                            │
│     - 规则追加合并                                           │
│     - Agents/Skills 按 ID 去重                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 就绪                                                     │
│     CodeBuddy 使用合并后的配置提供服务                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 附录

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CODEBUDDY_USER_DIR` | 用户配置目录 | `~/.codebuddy` |
| `CODEBUDDY_CACHE_EXPIRY` | 缓存过期时间(ms) | `3600000` |

### 相关文档

- [远程接入指南](remote-usage-guide.md)
- [技能系统说明](../custom-skills/custom-skills-guide.md)
- [规则编写指南](../rules/_meta/rule-template.md)

---

**版本**: 1.0.0
**更新日期**: 2026-01-26
**适用工具**: CodeBuddy (GLM-4.7)
