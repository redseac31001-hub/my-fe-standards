---
name: i18n-a11y
description: 国际化与可访问性技能，涵盖 vue-i18n 配置、WCAG 合规性检测和无障碍最佳实践。触发条件：国际化、i18n、多语言、可访问性、a11y、WCAG、无障碍。
metadata:
  triggers:
    - "国际化/i18n/无障碍/a11y/ARIA"
  frameworks:
    - react
    - vue
    - vue2
    - vue3
  roles:
    - frontend
    - fullstack
    - qa
  scenarios:
    - i18n
    - a11y
    - localization
---

# i18n & Accessibility Skill

国际化与可访问性技能，使用“按问题路由”的方式加载最少上下文。

## Routing

- **语言包、文案提取、复数和格式化**：读取 [references/i18n-workflow.md](references/i18n-workflow.md)
- **WCAG、ARIA、键盘导航、焦点管理**：读取 [references/a11y-workflow.md](references/a11y-workflow.md)

如果需求同时涉及翻译和可访问性，按顺序读取两个参考文件。

## Workflow

1. 先判断问题主要是翻译流程、locale 配置，还是交互可访问性。
2. 仅加载对应参考；如果是完整功能上线检查，再组合两份参考。
3. 先修语义和结构，再补 ARIA 和自动化规则，不要反过来。
4. 最后用真实键盘流程和至少一个自动化工具复验。

## Output

- 当前问题分层
- 需要修改的组件/配置文件
- 验证方式（自动化 + 手工）
- 剩余风险
