---
name: skill-creator
description: Guide for creating or refactoring skills that extend Codex with reusable workflows, references, scripts, and templates. Use when defining a new skill, restructuring an existing skill, or improving skill portability and maintainability.
metadata:
  triggers:
    - "创建技能/新技能/skill"
  roles:
    - architect
    - fullstack
  scenarios:
    - skill-design
    - skill-refactoring
---

# Skill Creator

创建或重构 skill，目标是得到可触发、可维护、可打包、可迭代的技能目录，而不是只写一份长说明文档。

## Routing

- **需要理解 skill 的职责、目录结构、frontmatter 约束**：读取 [references/foundations.md](references/foundations.md)
- **需要决定什么内容放进 SKILL.md、references、assets、scripts**：读取 [references/progressive-disclosure.md](references/progressive-disclosure.md)
- **需要从零创建或重构一个 skill 的完整流程**：读取 [references/creation-lifecycle.md](references/creation-lifecycle.md)
- **需要准备发布、打包、索引更新或引用白名单**：读取 [references/release-workflow.md](references/release-workflow.md)
- **需要设计输出模板或示例**：读取 [references/output-patterns.md](references/output-patterns.md)
- **需要组织顺序流程或条件分支**：读取 [references/workflows.md](references/workflows.md)
- **需要处理宿主特定的 UI / 列表元数据文件**：读取 [references/host-metadata.md](references/host-metadata.md)

## Workflow

1. 先明确 skill 的触发场景和具体使用样例。
2. 判断哪些内容应该固化为 `scripts/`、`references/`、`assets/`，不要把所有细节都塞进 `SKILL.md`。
3. 新 skill 优先运行 `scripts/init_skill.py` 初始化；已有 skill 则先审视结构是否需要重组。
4. 先实现可复用资源，再把 `SKILL.md` 收敛成入口、路由、工作流和输出约束。
5. 用 `scripts/quick_validate.py` 校验，再用 `scripts/package_skill.py` 验证可打包性。
6. 以真实使用反馈继续迭代，而不是只看文档长度。

## Scripts

- 初始化： [scripts/init_skill.py](scripts/init_skill.py)
- 校验： [scripts/quick_validate.py](scripts/quick_validate.py)
- 打包： [scripts/package_skill.py](scripts/package_skill.py)

## Assets

- 精简 SKILL 模板： [assets/minimal-skill-template/SKILL.md](assets/minimal-skill-template/SKILL.md)

## Output

- 精简但可路由的 `SKILL.md`
- 必要的 `references/`、`assets/`、`scripts/`
- 可校验、可打包、可继续扩展的 skill 目录
