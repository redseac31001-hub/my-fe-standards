# 系统概要设计模板使用指南

适用范围：业务项目按当前官方“系统概要设计模板”配置生成 Word 文档；如果官方模板变化，再重新抽取模板 schema。

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
- 官方 Word 模板会随 skill 一起分发，默认路径是 `assets/templates/system-overview-template.docx`
- 当前官方模板配置已经固化在以下资源内：
  - `assets/templates/system-overview-template.docx`
  - `assets/system-overview-template-config.json`
  - `assets/system-overview-template-schema.json`
  - `assets/system-overview-template-guide.md`

## 3. AI 对话触发（CodeBuddy 推荐入口）

在 VSCode CodeBuddy 对话窗口里，优先直接发自然语言请求，而不是先手工跑底层脚本。

推荐说法：

- `请根据当前项目、需求说明、接口字段和页面说明生成系统概要设计 Word 文档`
- `生成系统概要设计，自动分析当前代码结构并按官方模板导出`
- `把这个需求整理成概要设计文档，缺失信息请列待确认项`

预期行为：

- 宿主优先路由到 `system-overview-writer`
- Agent 自动收集需求、接口、页面、架构和现有代码结构
- Agent 按内置模板配置生成结构化输入并导出 Word
- 仅在 Python 或关键输入明显缺失时，才回退到人工补充或底层命令

边界说明：

- 如果用户要的是任务拆解、工时估算、方案对比，仍然由 `planner` 负责
- 如果用户要的是正式概要设计文档导出，必须由 `system-overview-writer` 接管
- 当前版本里，`/task` 入口下的 `design` 任务只有明确命中 `系统概要设计 / 概要设计文档 / 概设 / 系统设计文档`，或同时具备“系统/概要 + 设计方案 + 导出/Word/模板”信号时，才会优先绑定 `system-overview-writer`

## 4. 日常业务生成

日常生成时，不需要先执行模板抽取。直接使用内置模板配置即可。

```powershell
$skillsRoot = (Get-Content .codebuddy/install.json | ConvertFrom-Json).outputs.skillsRootDir
```

可直接查看当前固定模板配置：

```powershell
Get-Content ".\$skillsRoot\system-overview-design\assets\system-overview-template-guide.md"
```

## 5. 准备结构化输入

可从这里复制输入模板：

- `custom-skills/system-overview-design/assets/system-overview-input.template.json`

业务项目安装后则使用：

- `<skills-root>/system-overview-design/assets/system-overview-input.template.json`

建议来源映射：

- 需求说明 -> `background_and_objectives`
- 接口字段说明 -> `application_architecture.system_context.interfaces`
- 页面说明 -> `application_architecture.use_case_design`
- 项目架构 -> `application_architecture.decomposition_design` / `technical_architecture`

## 6. 导出 Word 文档

### 仓库本地

```powershell
python custom-skills/system-overview-design/scripts/render_overview_doc.py `
  --spec custom-skills/system-overview-design/assets/system-overview-input.example.json `
  --output output/doc/system-overview-example.docx `
  --overwrite
```

如需覆盖官方模板，再显式传入：

```powershell
--template docs/系统概要设计模版.docx
```

### 业务项目安装后

```powershell
$skillsRoot = (Get-Content .codebuddy/install.json | ConvertFrom-Json).outputs.skillsRootDir

python ".\$skillsRoot\system-overview-design\scripts\render_overview_doc.py" `
  --spec ".\$skillsRoot\system-overview-design\assets\system-overview-input.example.json" `
  --output .\output\doc\system-overview-example.docx `
  --overwrite
```

这条命令默认使用安装下发的官方模板，不再要求业务项目本地再放一份 `.docx`。

## 7. 官方模板变化时再抽取

只有以下场景才需要重新执行模板抽取：

- 官方概要设计模板换版
- 需要把另一套模板切换为新的默认模板
- 需要校验外部模板与当前官方模板是否一致

仓库本地：

```powershell
python custom-skills/system-overview-design/scripts/extract_template.py `
  docs/系统概要设计模版.docx `
  --output-dir tmp/system-overview-template `
  --overwrite
```

业务项目安装后：

```powershell
$skillsRoot = (Get-Content .codebuddy/install.json | ConvertFrom-Json).outputs.skillsRootDir

python ".\$skillsRoot\system-overview-design\scripts\extract_template.py" `
  .\docs\系统概要设计模版.docx `
  --output-dir .\tmp\system-overview-template `
  --overwrite
```

## 8. 导出后检查

- 在 Word 中刷新目录字段
- 检查封面、版本控制表和接口表
- 检查分页和表格跨页情况
- 缺图时确认文档中保留了“图应包含什么”的说明

## 9. 当前限制

- 当前能力只覆盖“系统概要设计”，不覆盖“系统详细设计”
- 图类内容先输出文字说明，不自动绘图
- 远程安装现已支持分发该 skill 的脚本、JSON 配置、模板 guide 和官方模板 `.docx`
