# 输入契约

`render_overview_doc.py` 消费一个 JSON 文件。推荐从 `assets/system-overview-input.template.json` 复制后填写。

## 顶层字段

### `cover`

封面和封面元信息表所需字段：

- `document_title`
- `document_code`
- `template_version_label`
- `company_name`
- `document_date`
- `initial_version`
- `confidentiality_level`
- `document_version`
- `author`
- `author_date`
- `reviewer`
- `review_date`

### `version_control`

版本控制表。数组元素结构：

```json
{
  "version": "0.1",
  "date": "2026-03-10",
  "participants": "张三/李四",
  "change_summary": "制订初稿"
}
```

### `sections`

正文内容，按模板章节分组。

## 章节字段映射

### `sections.background_and_objectives`

- `background`: `string[]`
- `design_constraints`: `string[]`
- `design_goals.configurability`: `string[]`
- `design_goals.performance`: `string[]`
- `design_goals.scalability`: `string[]`
- `design_goals.availability`: `string[]`
- `design_goals.security`: `string[]`
- `design_goals.observability`: `string[]`
- `design_goals.maintainability`: `string[]`

### `sections.application_architecture`

- `use_case_design.user_list`: `[{ role, description }]`
- `use_case_design.use_case_diagram`: `string[]`
- `use_case_design.use_case_list`: `[{ use_case, actor, precondition, result }]`
- `domain_model_design.domain_model_diagram`: `string[]`
- `domain_model_design.domain_objects`: `[{ object, description, key_fields }]`
- `system_context.context_diagram`: `string[]`
- `system_context.context_description`: `string[]`
- `system_context.interfaces`: `[{ seq, interface_id, apikit_id, name, external_access, protocol, description, caller, callee }]`
- `decomposition_design.functional_architecture`: `string[]`
- `decomposition_design.subsystems`: `[{ subsystem, responsibility, capabilities, dependencies }]`
- `decomposition_design.core_sequences`: `[{ sequence, description }]`
- `data_storage_design.business_data_storage`: `[{ domain, storage, description }]`
- `data_storage_design.multimodal_storage`: `[{ type, storage, description }]`
- `data_storage_design.big_data_storage_notes`: `string[]`

### `sections.technical_architecture`

- `non_functional_design.tech_stack`: `[{ layer, selection, version, description }]`
- `non_functional_design.performance_capacity`: `string[]`
- `non_functional_design.scalability`: `string[]`
- `non_functional_design.availability`: `string[]`
- `non_functional_design.security`: `string[]`
- `non_functional_design.observability`: `string[]`
- `non_functional_design.maintainability`: `string[]`
- `deployment_design.deployment_architecture`: `string[]`
- `deployment_design.deployment_description`: `string[]`

### `sections.resource_evaluation`

- `resource_inventory`: `[{ resource_type, spec, estimated_peak, notes }]`
- `evaluation_notes`: `string[]`

### `sections.transition_plan`

- `background_reason`: `string[]`
- `interim_plan`: `string[]`
- `target_solution`: `string[]`
- `differences_and_impact`: `string[]`
- `cutover_plan`: `string[]`

## 映射建议

- 需求说明：优先填 `background`、`design_goals`、`use_case_list`
- 接口字段说明：优先填 `system_context.interfaces`
- 页面说明：优先填 `use_case_design`、`decomposition_design.core_sequences`
- 项目架构/代码结构：优先填 `decomposition_design.subsystems`、`tech_stack`、`deployment_design`

## 生成约束

- 列表项应写成可直接入文档的完整句子，不要只写关键词。
- 表格字段不足时允许留空字符串，但不要伪造接口编号、容量或 SLA。
- 图类字段先写“图应包含什么”，后续再由人工补图。
