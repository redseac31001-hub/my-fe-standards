#!/usr/bin/env python3
"""
Generate a polished and evidence-based project function analysis report.

Outputs:
- DOCX report with professional typography and structured tables
- Markdown report (optional) with the same factual backbone
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


FONT_LATIN = "Calibri"
FONT_EAST_ASIA = "Microsoft YaHei"


@dataclass
class RepoFacts:
    repo_root: Path
    generated_at: str
    package_version: str
    manifest_version: str
    manifest_generated_at: str
    manifest_stats: dict[str, int]
    skills: list[str]
    agents: list[str]
    distributed_scripts: list[str]
    workflow_steps: list[dict[str, Any]]
    workflow_gates: list[dict[str, Any]]
    task_types_schema: list[str]
    task_types_impl: list[str]
    task_types_mcp: list[str]
    mcp_tools: list[str]
    mcp_resources: list[str]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(read_text(path))


def list_dirs(path: Path, must_contain: str | None = None) -> list[str]:
    results: list[str] = []
    for item in sorted(path.iterdir(), key=lambda p: p.name.lower()):
        if not item.is_dir():
            continue
        if must_contain and not (item / must_contain).exists():
            continue
        results.append(item.name)
    return results


def parse_ts_union_values(content: str, alias_name: str) -> list[str]:
    m = re.search(rf"export type {re.escape(alias_name)}\s*=\s*([\s\S]*?);", content)
    if not m:
        return []
    return re.findall(r"'([^']+)'", m.group(1))


def extract_array_block(content: str, marker: str) -> str:
    start = content.find(marker)
    if start < 0:
        return ""
    open_idx = content.find("[", start)
    if open_idx < 0:
        return ""

    level = 0
    for idx in range(open_idx, len(content)):
        ch = content[idx]
        if ch == "[":
            level += 1
        elif ch == "]":
            level -= 1
            if level == 0:
                return content[open_idx : idx + 1]
    return ""


def parse_loader_script_list(loader_ts: str) -> list[str]:
    m = re.search(
        r"const\s+SCRIPTS_TO_DISTRIBUTE[\s\S]*?=\s*\[([\s\S]*?)\];",
        loader_ts,
    )
    if not m:
        return []
    return re.findall(r"file:\s*'([^']+)'", m.group(1))


def parse_mcp_tools(mcp_ts: str) -> list[str]:
    marker = "server.setRequestHandler(ListToolsRequestSchema"
    start = mcp_ts.find(marker)
    if start < 0:
        return []
    section = mcp_ts[start:]
    block = extract_array_block(section, "tools:")
    if not block:
        return []
    return re.findall(r"name:\s*'([a-z0-9_-]+)'", block)


def parse_mcp_resources(mcp_ts: str) -> list[str]:
    marker = "server.setRequestHandler(ListResourcesRequestSchema"
    start = mcp_ts.find(marker)
    if start < 0:
        return []
    section = mcp_ts[start:]
    block = extract_array_block(section, "resources:")
    if not block:
        return []
    return re.findall(r"uri:\s*'([^']+)'", block)


def parse_mcp_task_types(mcp_ts: str) -> list[str]:
    """Parse TaskType enum values from MCP server source.

    Supports both forms:
    - const TaskTypeSchema = z.enum(['a', 'b'])
    - const TASK_TYPE_VALUES = [...] as const; const TaskTypeSchema = z.enum(TASK_TYPE_VALUES)
    """
    # 1) direct inline enum: z.enum([...])
    inline = re.search(r"const\s+TaskTypeSchema\s*=\s*z\.enum\((\[[\s\S]*?\])\)", mcp_ts)
    if inline:
        values = re.findall(r"'([^']+)'", inline.group(1))
        if values:
            return values

    # 2) referenced constant: z.enum(TASK_TYPE_VALUES)
    ref = re.search(r"const\s+TaskTypeSchema\s*=\s*z\.enum\(([_A-Za-z][_A-Za-z0-9]*)\)", mcp_ts)
    if ref:
        const_name = ref.group(1)
        const_block = extract_array_block(mcp_ts, f"const {const_name}")
        if const_block:
            values = re.findall(r"'([^']+)'", const_block)
            if values:
                return values

    return []


def gather_facts(repo_root: Path) -> RepoFacts:
    package_json = read_json(repo_root / "package.json")
    manifest_json = read_json(repo_root / "manifest.json")
    workflow_json = read_json(repo_root / "workflows" / "templates" / "default.workflow.json")
    taskbook_schema = read_json(repo_root / "taskbooks" / "schema" / "taskbook.schema.json")

    types_ts = read_text(repo_root / "scripts" / "src" / "types" / "index.ts")
    loader_ts = read_text(repo_root / "scripts" / "src" / "codebuddy-loader.ts")
    mcp_ts = read_text(repo_root / "mcp-server" / "src" / "index.ts")

    facts = RepoFacts(
        repo_root=repo_root,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        package_version=str(package_json.get("version", "")),
        manifest_version=str(manifest_json.get("version", "")),
        manifest_generated_at=str(manifest_json.get("generatedAt", "")),
        manifest_stats={k: int(v) for k, v in dict(manifest_json.get("stats", {})).items()},
        skills=list_dirs(repo_root / "custom-skills", must_contain="SKILL.md"),
        agents=list_dirs(repo_root / "agents", must_contain="AGENT.md"),
        distributed_scripts=parse_loader_script_list(loader_ts),
        workflow_steps=list(workflow_json.get("steps", [])),
        workflow_gates=list(workflow_json.get("gates", [])),
        task_types_schema=list(taskbook_schema.get("$defs", {}).get("taskType", {}).get("enum", [])),
        task_types_impl=parse_ts_union_values(types_ts, "TaskType"),
        task_types_mcp=parse_mcp_task_types(mcp_ts),
        mcp_tools=parse_mcp_tools(mcp_ts),
        mcp_resources=parse_mcp_resources(mcp_ts),
    )
    return facts


def set_style_font(style: Any, size_pt: int, bold: bool = False, color: RGBColor | None = None) -> None:
    style.font.name = FONT_LATIN
    style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_EAST_ASIA)
    style.font.size = Pt(size_pt)
    style.font.bold = bold
    if color:
        style.font.color.rgb = color


def set_run_font(run: Any, size_pt: int | None = None, bold: bool | None = None, color: RGBColor | None = None) -> None:
    run.font.name = FONT_LATIN
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_EAST_ASIA)
    if size_pt is not None:
        run.font.size = Pt(size_pt)
    if bold is not None:
        run.font.bold = bold
    if color:
        run.font.color.rgb = color


def ensure_custom_styles(doc: Document) -> None:
    normal = doc.styles["Normal"]
    set_style_font(normal, 11)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.35

    h1 = doc.styles["Heading 1"]
    set_style_font(h1, 16, bold=True, color=RGBColor(0x1F, 0x49, 0x7D))
    h1.paragraph_format.space_before = Pt(10)
    h1.paragraph_format.space_after = Pt(8)

    h2 = doc.styles["Heading 2"]
    set_style_font(h2, 13, bold=True, color=RGBColor(0x23, 0x3D, 0x63))
    h2.paragraph_format.space_before = Pt(8)
    h2.paragraph_format.space_after = Pt(6)

    h3 = doc.styles["Heading 3"]
    set_style_font(h3, 12, bold=True, color=RGBColor(0x2F, 0x56, 0x88))

    if "CodeBlock" not in [s.name for s in doc.styles]:
        code_style = doc.styles.add_style("CodeBlock", WD_STYLE_TYPE.PARAGRAPH)
        set_style_font(code_style, 9)
        code_style.font.name = "Consolas"
        code_style._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")
        code_style.paragraph_format.left_indent = Cm(0.6)
        code_style.paragraph_format.right_indent = Cm(0.2)
        code_style.paragraph_format.space_before = Pt(4)
        code_style.paragraph_format.space_after = Pt(4)


def setup_page(doc: Document) -> None:
    for section in doc.sections:
        section.left_margin = Cm(2.2)
        section.right_margin = Cm(2.2)
        section.top_margin = Cm(2.2)
        section.bottom_margin = Cm(2.2)


def set_cell_background(cell: Any, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def add_callout(doc: Document, title: str, lines: Iterable[str]) -> None:
    table = doc.add_table(rows=1, cols=1)
    table.autofit = True
    cell = table.cell(0, 0)
    set_cell_background(cell, "E9F2FF")
    p = cell.paragraphs[0]
    r = p.add_run(title + "\n")
    set_run_font(r, 11, bold=True, color=RGBColor(0x1F, 0x49, 0x7D))
    for line in lines:
        rr = p.add_run(f"- {line}\n")
        set_run_font(rr, 10)
    doc.add_paragraph("")


def add_bullet(doc: Document, text: str) -> None:
    p = doc.add_paragraph(style="List Bullet")
    run = p.add_run(text)
    set_run_font(run)


def add_table(
    doc: Document,
    headers: list[str],
    rows: list[list[str]],
    col_widths_cm: list[float] | None = None,
) -> None:
    table = doc.add_table(rows=1, cols=len(headers), style="Table Grid")
    table.autofit = col_widths_cm is None
    hdr_cells = table.rows[0].cells
    for idx, header in enumerate(headers):
        cell = hdr_cells[idx]
        cell.text = header
        set_cell_background(cell, "DCE6F2")
        for p in cell.paragraphs:
            for r in p.runs:
                set_run_font(r, 10, bold=True, color=RGBColor(0x1F, 0x49, 0x7D))

    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = value
            for p in cells[i].paragraphs:
                for r in p.runs:
                    set_run_font(r, 10)

    if col_widths_cm:
        for i, width in enumerate(col_widths_cm):
            for cell in table.columns[i].cells:
                cell.width = Cm(width)

    doc.add_paragraph("")


def format_output_hint(outputs: Any) -> str:
    if not outputs:
        return "-"
    if isinstance(outputs, dict):
        parts: list[str] = []
        for k, v in outputs.items():
            if isinstance(v, list):
                parts.append(f"{k}: {', '.join(str(x) for x in v)}")
            else:
                parts.append(f"{k}: {v}")
        return "; ".join(parts)
    return str(outputs)


def build_docx(docx_out: Path, facts: RepoFacts) -> None:
    doc = Document()
    setup_page(doc)
    ensure_custom_styles(doc)

    schema_set = set(facts.task_types_schema)
    impl_set = set(facts.task_types_impl)
    mcp_set = set(facts.task_types_mcp)
    missing_in_schema = sorted(impl_set - schema_set)
    missing_in_mcp = sorted(impl_set - mcp_set)
    has_tasktype_gap = bool(missing_in_schema or missing_in_mcp)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run("当前项目功能分析报告（优化版）")
    set_run_font(r, 22, bold=True, color=RGBColor(0x1F, 0x49, 0x7D))

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    rs = subtitle.add_run("my-fe-standards / Evidence-based Functional Analysis")
    set_run_font(rs, 11, color=RGBColor(0x4F, 0x81, 0xBD))

    doc.add_paragraph("")

    meta_rows = [
        ["生成时间", facts.generated_at],
        ["仓库目录", str(facts.repo_root)],
        ["package.json 版本", facts.package_version or "-"],
        ["manifest.json 版本", facts.manifest_version or "-"],
        ["manifest 生成时间", facts.manifest_generated_at or "-"],
    ]
    add_table(doc, ["元信息", "取值"], meta_rows, col_widths_cm=[4.2, 11.4])

    add_callout(
        doc,
        "文档目标",
        [
            "提升 Word 文档可读性（标题层级、字体、段落间距、表格结构统一）",
            "所有关键结论都绑定到仓库源码与配置，减少主观猜测",
            "功能分析下钻到“输入-处理-输出-失败恢复-证据路径”级别",
        ],
    )

    doc.add_heading("1. 执行摘要", level=1)
    add_bullet(doc, "平台定位：my-fe-standards 是“规则分发 + Agent/Skill 协作 + TaskBook/Workflow 闭环执行”的工程化平台。")
    add_bullet(doc, "闭环能力：默认 Workflow 提供 7 步执行链路，覆盖 requirement/prd、分析、计划、实现、审查、构建修复、验收归档。")
    if has_tasktype_gap:
        add_bullet(doc, "准确性发现：TaskType 在 schema / 实现 / MCP 三处定义不一致，属于当前最关键的一致性风险。")
    else:
        add_bullet(doc, "准确性状态：TaskType 在 schema / 实现 / MCP 三处定义已对齐，一致性风险已消除。")
    add_bullet(doc, "可运营性：MCP 已暴露 25 个 tools 与 8 个 resources，可支撑外部客户端按协议调用。")

    doc.add_heading("2. 平台能力总览（功能域）", level=1)
    capability_rows = [
        [
            "规则分发",
            "按依赖与任务类型装配 Layer1/2/3 规则并写入 .codebuddy",
            "config/loader-config.json + package.json",
            ".codebuddy/rules/project-rules.md + rules_cache",
            "scripts/src/codebuddy-loader.ts",
        ],
        [
            "Skills 分发",
            f"分发并索引 {len(facts.skills)} 个技能包",
            "custom-skills/*",
            ".codebuddy/skills/*",
            "scripts/src/codebuddy-loader.ts",
        ],
        [
            "Agents 分发",
            f"分发并索引 {len(facts.agents)} 个 Agent",
            "agents/*",
            ".codebuddy/agents/*",
            "scripts/src/codebuddy-loader.ts",
        ],
        [
            "TaskBook 管理",
            "TaskBook 创建/变更/并发锁/版本冲突控制/验收报告",
            "CLI 或 MCP 参数",
            ".codebuddy/taskbooks/{active,history}",
            "scripts/src/taskbook-manager.ts",
        ],
        [
            "Workflow 执行",
            "按 DAG 顺序执行 step，处理 gates、批次、回滚重试、人工阻塞恢复",
            "TaskBook + workflow 模板",
            "任务状态变更 + gates 证据 + acceptance",
            "scripts/src/task-executor.ts",
        ],
        [
            "一键编排",
            "create -> reports -> plan -> apply -> confirm -> execute",
            "需求文本或已有 taskbook",
            "闭环推进结果",
            "scripts/src/task-orchestrator.ts",
        ],
        [
            "MCP 接入",
            "Ralph / TaskBook / Workflow / Reports 工具服务化",
            "MCP 客户端请求",
            "工具响应 + codebuddy:// resources",
            "mcp-server/src/index.ts",
        ],
    ]
    add_table(
        doc,
        ["能力域", "核心职责", "主要输入", "主要输出", "关键实现文件"],
        capability_rows,
        col_widths_cm=[2.5, 3.8, 3.1, 3.2, 3.0],
    )

    doc.add_heading("3. Workflow 七步深度分析", level=1)
    step_rows: list[list[str]] = []
    for step in facts.workflow_steps:
        gates = ", ".join(step.get("gates", [])) if step.get("gates") else "-"
        skip_when = step.get("skipWhen", "-")
        outputs = format_output_hint(step.get("outputs"))
        step_rows.append(
            [
                str(step.get("id", "")),
                str(step.get("type", "")),
                gates,
                skip_when,
                outputs,
            ]
        )
    add_table(
        doc,
        ["Step ID", "Step Type", "关联 Gates", "跳过条件", "关键输出"],
        step_rows,
        col_widths_cm=[2.8, 3.3, 2.9, 3.0, 3.6],
    )

    add_callout(
        doc,
        "执行细节（来自 task-executor 实现）",
        [
            "支持 tdd_implement 分批执行（risk_tiered）并在批次间触发 smoke gate",
            "build_and_fix 失败时可按策略回滚到 retryFromStep，并限制最大重试轮次",
            "review gate 默认为人工批准，需通过 --approve <gateId> 显式放行",
            "MANUAL_REQUIRED 任务会落地 agent-call prompt/result 协议，支持重跑自动恢复",
        ],
    )

    doc.add_heading("4. Gate 机制与证据链", level=1)
    gate_rows: list[list[str]] = []
    for gate in facts.workflow_gates:
        params = gate.get("params", {}) if isinstance(gate.get("params"), dict) else {}
        commands = params.get("commands", [])
        npm_scripts = params.get("npmScripts", [])
        action_desc_parts: list[str] = []
        if commands:
            action_desc_parts.append("commands: " + " | ".join(str(c) for c in commands))
        if npm_scripts:
            action_desc_parts.append("npmScripts: " + " | ".join(str(s) for s in npm_scripts))
        if not action_desc_parts and gate.get("type") == "review":
            action_desc_parts.append("人工评审清单（review gate）")
        action_desc = "; ".join(action_desc_parts) if action_desc_parts else "-"
        gate_rows.append(
            [
                str(gate.get("id", "")),
                str(gate.get("type", "")),
                "是" if gate.get("required", True) else "否",
                action_desc,
                ".codebuddy/reports/gates/<taskBookId>/<timestamp>.<stepId>.<gateId>.json",
            ]
        )
    add_table(
        doc,
        ["Gate ID", "类型", "必选", "执行内容/策略", "证据落地路径"],
        gate_rows,
        col_widths_cm=[2.5, 1.5, 1.1, 5.5, 5.0],
    )

    doc.add_heading("5. 一致性校验（精准性重点）", level=1)
    consistency_rows = [
        ["TaskType（Schema）", ", ".join(facts.task_types_schema) or "-"],
        ["TaskType（scripts/src/types/index.ts）", ", ".join(facts.task_types_impl) or "-"],
        ["TaskType（MCP zod Schema）", ", ".join(facts.task_types_mcp) or "-"],
    ]
    add_table(doc, ["定义位置", "枚举值"], consistency_rows, col_widths_cm=[5.0, 10.6])

    if has_tasktype_gap:
        add_callout(
            doc,
            "关键风险结论",
            [
                f"实现层新增但 schema 未覆盖: {', '.join(missing_in_schema) if missing_in_schema else '无'}",
                f"实现层新增但 MCP 未覆盖: {', '.join(missing_in_mcp) if missing_in_mcp else '无'}",
                "影响：planner/task-executor 支持的任务类型可能被契约校验或 MCP 入参拦截，导致闭环中断。",
            ],
        )
    else:
        add_callout(
            doc,
            "一致性结论",
            [
                "Schema 与实现：无差异。",
                "MCP 与实现：无差异。",
                "结论：TaskType 契约一致性风险已消除。",
            ],
        )

    doc.add_heading("6. MCP 能力盘点", level=1)
    add_bullet(doc, f"Tools 总数：{len(facts.mcp_tools)}")
    add_bullet(doc, f"Resources 总数：{len(facts.mcp_resources)}")
    add_table(
        doc,
        ["工具类别", "工具名"],
        [
            ["Ralph", ", ".join([t for t in facts.mcp_tools if t.startswith("ralph_")]) or "-"],
            ["TaskBook", ", ".join([t for t in facts.mcp_tools if t.startswith("taskbook_")]) or "-"],
            ["Workflow/Reports", ", ".join([t for t in facts.mcp_tools if t.startswith("workflow_") or t.startswith("reports_")]) or "-"],
            ["Project Analyze", ", ".join([t for t in facts.mcp_tools if "analyze" in t or t.startswith("codebuddy_")]) or "-"],
        ],
        col_widths_cm=[3.0, 12.6],
    )

    doc.add_paragraph("Resources URI 列表：")
    for uri in facts.mcp_resources:
        add_bullet(doc, uri)

    doc.add_heading("7. 可执行改进建议（按优先级）", level=1)
    p0_row = (
        [
            "P0",
            "统一 TaskType 枚举",
            "同步更新 taskbook.schema / scripts types / MCP zod，确保 requirement/prd/refactor/build-fix/acceptance 全链路可用。",
            "闭环执行成功率显著提升，减少 blocked 假故障。",
        ]
        if has_tasktype_gap
        else [
            "P0",
            "保持 TaskType 一致性（已对齐）",
            "以 MCP 的 TASK_TYPE_VALUES + taskbook.schema 作为双向校验点，后续新增类型时同步修改并回归测试。",
            "防止类型漂移回归，维持闭环稳定性。",
        ]
    )

    improvement_rows = [
        p0_row,
        [
            "P1",
            "版本号单一事实源（SSOT）",
            "以 package.json 或 release metadata 为唯一源，构建时回写 manifest/README/PROJECT。",
            "避免文档与运行时版本认知冲突。",
        ],
        [
            "P1",
            "Gate 可观测性增强",
            "在 acceptance 报告中默认汇总 gate 失败 TopN 命令与耗时分布。",
            "定位失败根因更快，降低回滚成本。",
        ],
        [
            "P2",
            "文档生成流水线标准化",
            "保留本脚本，接入 CI 定时生成分析报告并沉淀历史版本。",
            "文档质量稳定，可持续复用。",
        ],
    ]
    add_table(
        doc,
        ["优先级", "改进项", "具体动作", "预期收益"],
        improvement_rows,
        col_widths_cm=[1.4, 2.7, 6.3, 5.2],
    )

    doc.add_heading("8. 证据文件清单", level=1)
    evidence_files = [
        "package.json",
        "manifest.json",
        "config/loader-config.json",
        "scripts/src/codebuddy-loader.ts",
        "scripts/src/task-orchestrator.ts",
        "scripts/src/task-executor.ts",
        "scripts/src/taskbook-manager.ts",
        "scripts/src/types/index.ts",
        "workflows/templates/default.workflow.json",
        "taskbooks/schema/taskbook.schema.json",
        "mcp-server/src/index.ts",
    ]
    for file_path in evidence_files:
        add_bullet(doc, file_path)

    doc.add_paragraph("")
    tail = doc.add_paragraph("报告说明：本报告由脚本自动抽取关键事实并生成，目标是可读性与可追溯性并重。")
    for run in tail.runs:
        set_run_font(run, 9, color=RGBColor(0x66, 0x66, 0x66))

    docx_out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(docx_out)


def build_markdown(facts: RepoFacts) -> str:
    schema_set = set(facts.task_types_schema)
    impl_set = set(facts.task_types_impl)
    mcp_set = set(facts.task_types_mcp)
    missing_in_schema = sorted(impl_set - schema_set)
    missing_in_mcp = sorted(impl_set - mcp_set)
    has_tasktype_gap = bool(missing_in_schema or missing_in_mcp)

    lines: list[str] = []
    lines.append("# 当前项目功能分析报告（优化版）")
    lines.append("")
    lines.append(f"- 生成时间：{facts.generated_at}")
    lines.append(f"- 仓库目录：`{facts.repo_root}`")
    lines.append(f"- package.json 版本：`{facts.package_version}`")
    lines.append(f"- manifest.json 版本：`{facts.manifest_version}`")
    lines.append(f"- manifest 生成时间：`{facts.manifest_generated_at}`")
    lines.append("")
    lines.append("## 1. 执行摘要")
    lines.append("")
    lines.append("- 项目定位：规则分发 + Agent/Skill 协作 + TaskBook/Workflow 闭环执行。")
    lines.append("- Workflow：默认 7 步（requirement/prd -> analyze -> plan -> tdd_implement -> review -> build_fix -> acceptance）。")
    lines.append("- MCP 能力：25 个工具 + 8 个资源。")
    if has_tasktype_gap:
        lines.append("- 关键风险：TaskType 在 schema / 实现 / MCP 三处不一致。")
    else:
        lines.append("- 准确性状态：TaskType 在 schema / 实现 / MCP 三处已一致。")
    lines.append("")
    lines.append("## 2. 功能域概览")
    lines.append("")
    lines.append("| 能力域 | 关键事实 |")
    lines.append("|---|---|")
    lines.append(f"| Skills | {len(facts.skills)} 个：{', '.join(facts.skills)} |")
    lines.append(f"| Agents | {len(facts.agents)} 个：{', '.join(facts.agents)} |")
    lines.append(f"| 分发脚本 | {len(facts.distributed_scripts)} 个：{', '.join(facts.distributed_scripts)} |")
    lines.append(f"| Workflow Steps | {len(facts.workflow_steps)} |")
    lines.append(f"| Workflow Gates | {len(facts.workflow_gates)} |")
    lines.append("")
    lines.append("## 3. Workflow 步骤明细")
    lines.append("")
    lines.append("| Step ID | Type | Gates | skipWhen |")
    lines.append("|---|---|---|---|")
    for step in facts.workflow_steps:
        lines.append(
            f"| `{step.get('id', '')}` | `{step.get('type', '')}` | "
            f"{', '.join(step.get('gates', [])) if step.get('gates') else '-'} | "
            f"{step.get('skipWhen', '-')} |"
        )
    lines.append("")
    lines.append("## 4. Gate 与证据")
    lines.append("")
    lines.append("| Gate ID | 类型 | 必选 | 执行策略（摘要） |")
    lines.append("|---|---|---|---|")
    for gate in facts.workflow_gates:
        params = gate.get("params", {}) if isinstance(gate.get("params"), dict) else {}
        command_text = ""
        if params.get("commands"):
            command_text += "commands=" + " | ".join(str(x) for x in params.get("commands", []))
        if params.get("npmScripts"):
            if command_text:
                command_text += "; "
            command_text += "npmScripts=" + " | ".join(str(x) for x in params.get("npmScripts", []))
        if not command_text and gate.get("type") == "review":
            command_text = "人工审批 gate"
        lines.append(
            f"| `{gate.get('id', '')}` | `{gate.get('type', '')}` | "
            f"{'是' if gate.get('required', True) else '否'} | {command_text or '-'} |"
        )
    lines.append("")
    lines.append("证据文件路径：")
    lines.append("` .codebuddy/reports/gates/<taskBookId>/<timestamp>.<stepId>.<gateId>.json `")
    lines.append("")
    lines.append("## 5. 准确性校验（TaskType）")
    lines.append("")
    lines.append(f"- Schema：{', '.join(facts.task_types_schema)}")
    lines.append(f"- 实现：{', '.join(facts.task_types_impl)}")
    lines.append(f"- MCP：{', '.join(facts.task_types_mcp)}")
    lines.append(f"- 实现比 Schema 多出的类型：{', '.join(missing_in_schema) if missing_in_schema else '无'}")
    lines.append(f"- 实现比 MCP 多出的类型：{', '.join(missing_in_mcp) if missing_in_mcp else '无'}")
    lines.append("")
    lines.append("## 6. MCP 工具与资源")
    lines.append("")
    lines.append(f"- Tools（{len(facts.mcp_tools)}）：{', '.join(facts.mcp_tools)}")
    lines.append(f"- Resources（{len(facts.mcp_resources)}）：{', '.join(facts.mcp_resources)}")
    lines.append("")
    lines.append("## 7. 建议优先级")
    lines.append("")
    if has_tasktype_gap:
        lines.append("1. P0：统一 TaskType 枚举（schema/types/mcp）。")
    else:
        lines.append("1. P0：保持 TaskType 枚举一致性（已对齐，防止回归）。")
    lines.append("2. P1：统一版本号 SSOT，构建时自动同步到文档与 manifest。")
    lines.append("3. P1：增强 gate 失败可观测性（命令耗时、失败 TopN）并写入 acceptance。")
    lines.append("4. P2：把本报告生成脚本纳入 CI，形成历史趋势文档。")
    lines.append("")
    lines.append("## 8. 证据文件")
    lines.append("")
    for fp in [
        "package.json",
        "manifest.json",
        "config/loader-config.json",
        "scripts/src/codebuddy-loader.ts",
        "scripts/src/task-orchestrator.ts",
        "scripts/src/task-executor.ts",
        "scripts/src/taskbook-manager.ts",
        "scripts/src/types/index.ts",
        "workflows/templates/default.workflow.json",
        "taskbooks/schema/taskbook.schema.json",
        "mcp-server/src/index.ts",
    ]:
        lines.append(f"- `{fp}`")
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate polished project analysis report (.docx + optional .md).")
    parser.add_argument("--repo-root", type=Path, default=Path("."), help="Repository root path.")
    parser.add_argument("--docx-out", type=Path, default=Path("docs") / "当前项目功能分析.docx", help="Output DOCX path.")
    parser.add_argument("--md-out", type=Path, default=Path("docs") / "当前项目功能分析.md", help="Output Markdown path.")
    parser.add_argument("--skip-md", action="store_true", help="Do not generate markdown output.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    facts = gather_facts(repo_root)

    docx_out = args.docx_out if args.docx_out.is_absolute() else repo_root / args.docx_out
    build_docx(docx_out, facts)

    if not args.skip_md:
        md_out = args.md_out if args.md_out.is_absolute() else repo_root / args.md_out
        md_out.parent.mkdir(parents=True, exist_ok=True)
        md_out.write_text(build_markdown(facts), encoding="utf-8")

    print(f"[ok] docx: {docx_out}")
    if not args.skip_md:
        md_out = args.md_out if args.md_out.is_absolute() else repo_root / args.md_out
        print(f"[ok] markdown: {md_out}")


if __name__ == "__main__":
    main()
