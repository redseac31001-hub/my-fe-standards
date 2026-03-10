---
name: system-overview-design
description: "Generate a system overview design document from a Word `.docx` template and structured project inputs. Use when the user asks for 系统概要设计/概要设计/概设/概要设计模板, needs to convert an overview-design Word template into AI-readable guidance, or needs a final `.docx` overview design export."
metadata:
  triggers:
    - "系统概要设计"
    - "概要设计"
    - "概设"
    - "概要设计模板"
    - "设计文档模板"
    - "word 模板"
  roles:
    - architect
    - product
    - fullstack
  scenarios:
    - template-conversion
    - design-documentation
    - docx-export
  tools:
    - python:scripts/extract_template.py
    - python:scripts/render_overview_doc.py
---

# System Overview Design Skill

基于系统概要设计 Word 模板生成 AI 可读 schema，并把结构化设计内容回填到最终 `.docx` 文档。当前官方模板配置已经固化在 skill 资源内，业务项目默认按这套配置生成。

## Routing

- **需要理解当前官方模板章节、样式和表格结构**：优先读取 [assets/system-overview-template-guide.md](assets/system-overview-template-guide.md) 和 [assets/system-overview-template-schema.json](assets/system-overview-template-schema.json)
- **需要理解模板结构约束或维护说明**：读取 [references/template-structure.md](references/template-structure.md)
- **需要把需求说明、接口字段、页面说明、项目架构映射成输入 JSON**：读取 [references/input-contract.md](references/input-contract.md)

## Workflow

1. 日常业务生成时，默认使用内置模板配置 `assets/system-overview-template-config.json`、`assets/system-overview-template-schema.json` 和 `assets/system-overview-template-guide.md`。
2. 把需求说明、接口字段、页面说明、项目架构等内容整理到 `assets/system-overview-input.template.json` 对应的结构化字段中。
3. 缺信息时保留待确认项，不要自行臆造系统边界、容量、安全策略或部署拓扑。
4. 运行 `scripts/render_overview_doc.py`，将结构化内容按内置模板配置写回 Word 模板。
5. 只有在官方模板发生变化或要接入新模板时，才运行 `scripts/extract_template.py` 重新抽取 schema / guide 并更新内置资源。
6. 导出后人工在 Word 中刷新目录字段，确认页码、分页和表格布局。

## Installed Path

- 仓库本地调试时，脚本路径是 `custom-skills/system-overview-design/scripts/...`
- 业务项目安装后，脚本路径变为 `<skills-root>/system-overview-design/scripts/...`
- `<skills-root>` 以 `.codebuddy/install.json -> outputs.skillsRootDir` 为准
- 官方 Word 模板随 skill 一起分发，默认路径是 `assets/templates/system-overview-template.docx`

## Scripts

- 模板抽取器： [scripts/extract_template.py](scripts/extract_template.py)
- Word 回填导出器： [scripts/render_overview_doc.py](scripts/render_overview_doc.py)

## Assets

- 官方模板本体： [assets/templates/system-overview-template.docx](assets/templates/system-overview-template.docx)
- 官方模板配置： [assets/system-overview-template-config.json](assets/system-overview-template-config.json)
- 官方模板 schema： [assets/system-overview-template-schema.json](assets/system-overview-template-schema.json)
- 官方模板 guide： [assets/system-overview-template-guide.md](assets/system-overview-template-guide.md)
- 输入模板： [assets/system-overview-input.template.json](assets/system-overview-input.template.json)
- 示例输入： [assets/system-overview-input.example.json](assets/system-overview-input.example.json)

## Output

- 可供 AI 读取的模板 schema / guide
- 结构化概要设计输入 JSON
- 按模板样式生成的系统概要设计 `.docx`
