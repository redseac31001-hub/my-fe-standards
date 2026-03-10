---
name: your-skill-name
description: Describe what this skill does and when to use it. Include concrete triggers, tasks, or file types.
metadata:
  triggers:
    - "keyword-1/keyword-2"
  related:
    - related-skill
  # Optional. Use only when a markdown link intentionally points outside this skill folder.
  # Entries are relative to the skill root. Trailing slash means prefix allowlist.
  # link_whitelist:
  #   - ../../shared-docs/
---

# Skill Title

一句话说明这个 skill 的目标和边界。

## Routing

- **需要背景/规则细节**：读取 `references/your-reference.md`
- **需要固定格式生成**：运行 `scripts/your-script.py`
- **需要复用模板/样板**：使用 `assets/your-template.ext`

## Workflow

1. 先确认输入是否足够；只补问阻塞执行的关键信息。
2. 先用脚本和模板处理高重复、易出错的部分。
3. 只在需要时读取对应 reference，不把所有细节塞进 `SKILL.md`。
4. 输出结果时明确边界、假设和后续动作。

## Output

- 交付物 1
- 交付物 2
- 明确的下一步或验证方式
