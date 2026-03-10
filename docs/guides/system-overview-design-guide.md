# 系统概要设计模板使用指南

适用范围：把 `docs/系统概要设计模版.docx` 或其他同类概要设计模板转换成 AI 可读 schema，并导出最终 Word 文档。

## 1. 运行前提

- 业务项目或本仓库机器需要安装 Python 3
- 需要安装 `python-docx`

```powershell
python -m pip install python-docx
```

## 2. 路径约定

- 仓库本地调试时，skill 根路径是 `custom-skills/system-overview-design`
- 业务项目远程安装后，skill 根路径是 `<skills-root>/system-overview-design`
- `<skills-root>` 以 `.codebuddy/install.json -> outputs.skillsRootDir` 为准
- Word 模板 `.docx` 由业务项目本地提供，不随 content pack 分发

## 3. 抽取模板结构

### 仓库本地

```powershell
python custom-skills/system-overview-design/scripts/extract_template.py `
  docs/系统概要设计模版.docx `
  --output-dir tmp/system-overview-template `
  --overwrite
```

### 业务项目安装后

先读取 active skills root：

```powershell
$skillsRoot = (Get-Content .codebuddy/install.json | ConvertFrom-Json).outputs.skillsRootDir
```

再执行：

```powershell
python ".\$skillsRoot\system-overview-design\scripts\extract_template.py" `
  .\docs\系统概要设计模版.docx `
  --output-dir .\tmp\system-overview-template `
  --overwrite
```

输出：

- `tmp/system-overview-template/template-schema.json`
- `tmp/system-overview-template/template-guide.md`

## 4. 准备结构化输入

可从这里复制输入模板：

- `custom-skills/system-overview-design/assets/system-overview-input.template.json`

业务项目安装后则使用：

- `<skills-root>/system-overview-design/assets/system-overview-input.template.json`

建议来源映射：

- 需求说明 -> `background_and_objectives`
- 接口字段说明 -> `application_architecture.system_context.interfaces`
- 页面说明 -> `application_architecture.use_case_design`
- 项目架构 -> `application_architecture.decomposition_design` / `technical_architecture`

## 5. 导出 Word 文档

### 仓库本地

```powershell
python custom-skills/system-overview-design/scripts/render_overview_doc.py `
  --template docs/系统概要设计模版.docx `
  --spec custom-skills/system-overview-design/assets/system-overview-input.example.json `
  --output output/doc/system-overview-example.docx `
  --overwrite
```

### 业务项目安装后

```powershell
$skillsRoot = (Get-Content .codebuddy/install.json | ConvertFrom-Json).outputs.skillsRootDir

python ".\$skillsRoot\system-overview-design\scripts\render_overview_doc.py" `
  --template .\docs\系统概要设计模版.docx `
  --spec ".\$skillsRoot\system-overview-design\assets\system-overview-input.example.json" `
  --output .\output\doc\system-overview-example.docx `
  --overwrite
```

## 6. 导出后检查

- 在 Word 中刷新目录字段
- 检查封面、版本控制表和接口表
- 检查分页和表格跨页情况
- 缺图时确认文档中保留了“图应包含什么”的说明

## 7. 当前限制

- 当前能力只覆盖“系统概要设计”，不覆盖“系统详细设计”
- 图类内容先输出文字说明，不自动绘图
- 远程安装现已支持分发该 skill 的脚本和 JSON 资产，但模板 `.docx` 仍需业务项目本地提供
