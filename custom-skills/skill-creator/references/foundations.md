# Foundations

Skill 是面向另一个 agent 实例的可复用工作包，不只是说明文档。

## What A Skill Should Provide

一个好的 skill 至少应当提供下面几类价值中的一项：

1. 专项工作流
2. 可重复执行的脚本
3. 特定领域知识
4. 输出模板或静态资源

## Directory Anatomy

```text
skill-name/
├── SKILL.md
├── scripts/      # 可执行逻辑
├── references/   # 按需加载的文档
└── assets/       # 输出时复用的模板或资源
```

`SKILL.md` 必须存在，其余目录按需创建。

## Frontmatter Contract

顶层 frontmatter 保持可移植：

- `name`
- `description`
- `metadata`（可选）

把宿主相关提示放到 `metadata` 下，而不是继续扩展新的顶层字段。当前推荐字段：

- `triggers`
- `tools`
- `related`
- `languages`
- `frameworks`
- `roles`
- `scenarios`
- `workspace_scope`
- `link_whitelist`（仅在链接必须越出 skill 根目录时使用）

`metadata.link_whitelist` 里的路径一律相对 skill 根目录书写。只有当 Markdown 链接确实需要引用 skill 包外部资源时才加，避免把外部依赖默默带进技能文档。

## What Not To Add

不要额外创建这些面向人的辅助文档：

- `README.md`
- `INSTALLATION_GUIDE.md`
- `CHANGELOG.md`
- `QUICK_REFERENCE.md`

Skill 目录只保留能帮助 agent 执行任务的内容。
