# Host Metadata

有些宿主会要求额外的 UI 元数据或安装清单，但这些内容不应该污染 skill 的可移植 frontmatter。

## Rule

把跨宿主都通用的内容留在 `SKILL.md` frontmatter：

- `name`
- `description`
- `metadata`（可选）

把宿主专属文件放在独立位置，例如：

- `agents/openai.yaml`
- 其他平台要求的 skill manifest

## Why

这样做有两个好处：

1. 不破坏核心触发协议
2. 迁移到其他宿主时，不需要重写整个 `SKILL.md`

## Recommended Practice

- 把 UI 展示名、短描述、默认提示词这类信息放到宿主专属文件
- 保持它们与 `SKILL.md` 一致
- 如果当前仓库没有对应生成脚本，就把这些文件视为可选扩展，而不是基础要求

## Guardrails

- 不要因为某个平台需要字段，就把它加到通用 top-level frontmatter
- 不要在 `SKILL.md` 里假设所有宿主都支持同一份 UI 元数据
