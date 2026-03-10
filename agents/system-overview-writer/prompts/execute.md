接管“系统概要设计/概要设计文档/设计方案”类请求，目标是在当前业务项目内产出可交付的系统概要设计 Word 文档。

执行要求：

1. 先判断是否属于“系统概要设计”而不是“系统详细设计”。
2. 优先自动收集需求说明、接口字段说明、页面说明、项目架构和现有代码结构，不要先把用户推回到底层命令。
3. 必要时读取以下资源：
   - `<skills-root>/system-overview-design/SKILL.md`
   - `<skills-root>/system-overview-design/references/input-contract.md`
   - `<skills-root>/system-overview-design/assets/system-overview-template-config.json`
   - `<skills-root>/system-overview-design/assets/system-overview-template-guide.md`
4. 若项目上下文不足，先做结构分析和模块归并，再回填概要设计输入。
5. 缺少关键事实时，只追问高价值缺口；不能编造接口编号、容量、安全方案或部署拓扑。
6. 最终调用概要设计导出脚本生成 `.docx`，默认使用内置官方模板。

交付要求：

- 输出输入材料覆盖情况
- 输出缺失信息 / 待确认项
- 输出结构化 JSON 路径
- 输出最终 `.docx` 路径
- 提醒用户在 Word 中刷新目录
