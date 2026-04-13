# GLM4.7 业务项目演示 Runbook

> 目标：在真实前端业务项目内，使用 VSCode + CodeBuddy + GLM-4.7，稳定演示 `my-fe-standards` 对业务项目的直接赋能。
> 适用对象：内部团队演示、试点汇报、产品能力展示。

## 1. 先对齐目标

这次演示要证明的不是“规则装进去了”，而是下面四件事：

1. GLM-4.7 在业务项目里能更稳定地理解前端上下文。
2. 模型不是只会聊天，而是会主动读取并使用 Agent / Skill。
3. 对话结果能体现出架构规范、排障方法、审查标准、重构套路这些平台能力。
4. 至少有一个场景能让团队直观看到“接入前后差异”。

## 2. 当前方案是否完全符合目标

结论：**部分符合，但还不完全够做“平台全能力演示版”。**

当前 `demo` profile 已经满足：

1. `project-rules.md` 足够轻，适合 GLM-4.7。
2. 有欢迎 Banner、统一路由表、快速上手提示。
3. 会按项目技术栈裁剪 Agent / Skill。
4. 很适合演示“对话触发 Agent / Skill”的能力。
5. 对话式任务请求和 `/task` 可以被讲成两种产品入口，但目标是收敛到同一条底层闭环链。

当前 `demo` profile 还不满足：

1. 不分发完整 orchestrator runtime。
2. 不分发 Workflow / TaskBook / AgentCall 契约。
3. 因此不适合把 `/task -> 任务拆解 -> 执行闭环` 作为主秀场。

所以如果你的目标是：

1. 演示“模型对话变聪明了，能稳定触发 Agent / Skill”：
   当前 `demo` profile 可以直接用。
2. 演示“平台闭环能力，包括 /task、TaskBook、Workflow、验收报告”：
   当前 `demo` profile 不够，应该改用 `full --rule-level quick`，或者新增一个更适合演示的 `presentation` profile。

## 3. 推荐的演示版本策略

### 方案 A：这周就要演示

使用：

```bash
codebuddy-install --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/demo/glm-optimize --full
```

理由：

1. 保留完整平台能力。
2. 规则体积比默认 full 小很多，GLM-4.7 还能承受。
3. `/task`、TaskBook、Workflow、报告链路都能展示。
4. Agent / Skill 触发能力也都还在。

这版是**最适合立刻给团队做演示**的。

演示时建议明确讲一句：

- 用户可以直接说“帮我实现登录”“规划这次重构”
- 也可以显式输入 `/task ...`
- 这两种入口在产品层不同，但底层都应收敛到 `task-intake-routing -> TaskBook -> planner -> validator -> executor`

#### 业务项目安装命令

演示型业务项目建议直接安装完整运行时，不要先走轻量 `analysis` 档位。

推荐命令：

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/demo/glm-optimize/scripts/dist/codebuddy-install.js | node - --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/demo/glm-optimize --full
```

Windows PowerShell：

```powershell
iwr https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/demo/glm-optimize/scripts/dist/codebuddy-install.js -OutFile codebuddy-install.js
node codebuddy-install.js --remote https://raw.githubusercontent.com/redseac31001-hub/my-fe-standards/demo/glm-optimize --full
```

说明：

1. `codebuddy-install.js` 会自动下载 `codebuddy-loader.bundle.js`
2. 默认已补齐 `--rule-level quick --pack-only`
3. `--full` 会安装完整闭环运行时，包含：
   - `task-orchestrator.js`
   - `task-executor.js`
   - `taskbook-manager.js`
   - `agent-call-manager.js`
   - Workflow / TaskBook / Agent Call 契约

安装完成后，先检查：

```bash
node .codebuddy/scripts/codebuddy-loader.js status
node .codebuddy/scripts/codebuddy-loader.js doctor --json
```

预期结果：

1. `.codebuddy/` 已生成
2. `status` 中的 `Profile` 为 `full`
3. `doctor` 没有阻塞性失败
4. `.codebuddy/scripts/` 下可看到 `task-orchestrator.js`、`task-executor.js`、`taskbook-manager.js`

如果你是在 `my-fe-standards` 仓库内做本地影子业务项目验证，可使用：

```bash
node scripts/dist/codebuddy-loader.js --profile full --rule-level quick
```

### 方案 B：下一轮专门做“演示版产品面”

新增一个 `presentation` profile，目标是：

1. prompt 输出沿用当前 `demo` 的轻量结构。
2. 运行时分发保留最关键的闭环能力：
   - `task-orchestrator.js`
   - `task-executor.js`
   - `taskbook-manager.js`
   - `code-reviewer` / `bug-investigator` / `planner` / `tdd-driver` / `build-fix` / `structure-analyzer`
   - Workflow / TaskBook / Commands
3. 仍然做 Agent / Skill 数量裁剪。

这会比 `full --rule-level quick` 更像一个真正的“演示产品档位”。

## 4. 演示建议总原则

GLM-4.7 的演示要遵守 5 条规则：

1. 一次只演示一个能力点，不要把多个目标混在一句话里。
2. 提示词要短、明确、关键词强，避免开放式大作文。
3. 场景要前端化，优先选组件、页面、接口接入、白屏、代码审查。
4. 每个场景都要有“看得见的产物”，例如报告、计划、代码 diff、规则读取路径。
5. 先演示“快反馈”，再演示“闭环能力”。

## 5. 推荐的 15 分钟演示流程

### Phase 0：开场（1 分钟）

展示 3 个画面：

1. VSCode 左侧 Explorer 中的 `.codebuddy/`
2. `project-rules.md` 顶部 Banner
3. 业务项目真实页面或组件目录

你要说的话：

> 这不是一个单纯提示词文件，而是一套安装进业务项目的 AI 能力层。模型会在当前项目里读规则、读 Skill、读 Agent，并按触发场景切换工作方式。

### Phase 1：快速证明“会触发能力” （3 分钟）

场景 1：代码审查

固定输入：

```text
审查这个登录表单组件，重点看类型安全、状态流和可维护性。
```

预期表现：

1. 命中 `code-reviewer`
2. 模型主动读取 `AGENT.md`
3. 输出结构化审查结论，而不是泛泛建议

你要展示的证据：

1. 对话里出现“先读取 code-reviewer / AGENT.md”
2. 审查结果按问题等级分组
3. 建议和当前前端规范一致

场景 2：Bug 排查

固定输入：

```text
登录页偶发白屏，控制台有 undefined 错误，帮我排查根因，不要先改代码。
```

预期表现：

1. 命中 `bug-investigator`
2. 模型先做分层排查，不直接乱修
3. 输出“现象 -> 猜测 -> 验证路径”

你要强调：

> 这里平台提供的不是答案模板，而是一套排障方法学。

### Phase 2：证明“前端开发质量提升” （4 分钟）

场景 3：组件重构

固定输入：

```text
这个组件太大了，帮我做一个安全重构方案，优先拆分职责，不要改变现有行为。
```

预期表现：

1. 命中 `component-refactoring` Skill
2. 模型给出拆分边界、子组件划分、状态归属建议
3. 输出比普通模型更“工程化”

展示方式：

1. 左侧开原始组件
2. 右侧展示模型方案
3. 强调“不是让 AI 瞎改，而是让它按平台沉淀的方法改”

场景 4：结构分析

固定输入：

```text
分析一下这个前端项目的结构问题，告诉我最值得先处理的两个点。
```

预期表现：

1. 命中 `structure-analyzer`
2. 模型给出目录/模块层面的建议
3. 可联动 `.codebuddy/reports/`

如果你走 CLI 辅助演示，可补：

```bash
node .codebuddy/scripts/structure-analyzer.js .
node .codebuddy/scripts/report-manager.js status
```

### Phase 3：证明“平台闭环能力” （5 分钟）

这一段**只建议在 `full --rule-level quick` 或未来 `presentation` profile 下演示**。

场景 5：/task 闭环

固定输入：

```text
/task 把登录页 mock 接口替换成真实 API，补齐错误提示和 loading 状态。
```

预期表现：

1. 识别为前端小到中型真实需求
2. 生成计划或 TaskBook
3. 出现执行阶段、审查阶段、验收阶段信号

你要展示的不是全自动跑完，而是：

1. 平台能把模糊需求变成可执行任务
2. 平台能保留过程产物
3. 平台有“计划 -> 执行 -> 验证”的结构

如果现场不稳，降级展示：

```bash
node .codebuddy/scripts/task-orchestrator.js "把登录页 mock 接口替换成真实 API，补齐错误提示和 loading 状态"
node .codebuddy/scripts/taskbook-manager.js show <taskBookId>
```

### Phase 4：收口总结（2 分钟）

你最后要落在 3 句话：

1. 这套能力装进业务项目后，GLM-4.7 不再只靠临场发挥。
2. Agent / Skill / Rule / Workflow 让它更像“有方法、有边界”的工程助手。
3. 对团队的价值不是替代开发，而是提升分析、审查、排障、实施的一致性。

## 6. 固定演示对话脚本

推荐按下面顺序，不要临场自由发挥。

### 脚本 1：代码审查

```text
审查这个登录表单组件，重点看类型安全、状态流和可维护性。
```

### 脚本 2：Bug 排查

```text
登录页偶发白屏，控制台有 undefined 错误，帮我排查根因，不要先改代码。
```

### 脚本 3：组件重构

```text
这个组件太大了，帮我做一个安全重构方案，优先拆分职责，不要改变现有行为。
```

### 脚本 4：结构分析

```text
分析一下这个项目结构，告诉我最值得先处理的两个问题。
```

### 脚本 5：闭环任务

```text
/task 把登录页 mock 接口替换成真实 API，补齐 loading、错误提示和重试逻辑。
```

## 7. 演示交互流程优化建议

### 7.1 模型提示词写法统一

统一遵守：

1. 动词放前面
2. 目标单一
3. 限定边界
4. 限定输出形式

推荐写法：

```text
审查这个组件，重点看 A/B/C。
```

不推荐写法：

```text
你顺便帮我看看这个组件有没有问题，如果能改的话也一起改一下，然后最好再分析一下项目结构。
```

### 7.2 演示时的节奏控制

每轮对话都只做 3 步：

1. 提问
2. 让模型触发能力
3. 停下来解释触发结果

不要连续追问 5 轮，否则团队看不清是平台起作用，还是模型自由发挥。

### 7.3 明确展示“读取了什么”

每个场景都要提醒观众关注：

1. 读了哪个 `AGENT.md`
2. 读了哪个 `SKILL.md`
3. 是否参考了 `.codebuddy/rules_cache/`

这是证明“平台赋能”的关键证据。

## 8. 视觉效果与演示舞台建议

### 8.1 VSCode 布局

推荐固定成 4 区：

1. 左侧 Explorer：展开 `.codebuddy/`
2. 中间主编辑区：业务代码
3. 右侧编辑区：`project-rules.md` / Agent / Skill / 报告
4. 下方终端：执行 `status / doctor / report-manager`

### 8.2 演示前预打开的文件

建议预先打开：

1. `.codebuddy/rules/project-rules.md`
2. 一个业务组件文件
3. `.codebuddy/agent-snapshots/.../code-reviewer/AGENT.md` 或当前 agent 根目录
4. `.codebuddy/scripts/README.md`

### 8.3 要让观众看到的“视觉锚点”

优先展示：

1. 欢迎 Banner
2. 能力路由表
3. `.codebuddy/` 目录树
4. TaskBook / 报告 / 审查结果
5. 代码 diff 或结构化输出

### 8.4 页面级视觉效果

如果业务项目有可运行页面，建议准备一个很明显的 demo 页面：

1. 一个“登录页”或“用户列表页”
2. 有已知可讲述的问题：
   - loading 处理粗糙
   - 错误提示不一致
   - 组件过大
   - mock API 尚未替换

这样每个演示动作都能回到一个肉眼可见的页面上。

## 9. 推荐的业务项目准备方式

演示项目最好满足：

1. Vue 3 + TypeScript + Ant Design Vue 或 React + TypeScript
2. 至少一个真实页面和 2-3 个相关组件
3. 有一个预埋 bug
4. 有一个预埋“待重构大组件”
5. 有一个 mock -> real API 的待完成点

不建议拿：

1. 空项目
2. 过于复杂且首次讲不清的项目
3. 没有明显问题、没有可见页面反馈的项目

## 10. 演示前检查清单

### 必须确认

1. `status` 正常
2. `doctor` 无阻塞项
3. `.codebuddy/rules/project-rules.md` 已生成
4. 关键 Agent / Skill 实际存在
5. 业务项目能正常启动
6. 演示页面已准备好

### 演示前命令

```bash
node .codebuddy/scripts/codebuddy-loader.js status
node .codebuddy/scripts/codebuddy-loader.js doctor --json
node .codebuddy/scripts/report-manager.js status
```

如果演示闭环能力，再补：

```bash
node .codebuddy/scripts/task-orchestrator.js --help
node .codebuddy/scripts/taskbook-manager.js --help
```

## 11. 最终建议

如果你现在就要出一版“能装进业务项目、能立刻演示”的版本，建议：

1. **本周演示版**：使用 `full --rule-level quick`
2. **演示主题**：前端代码审查 + Bug 排查 + 组件重构 + /task 闭环
3. **演示话术**：全部使用固定短句，不做开放式对话
4. **下一轮产品化优化**：新增 `presentation` profile，兼顾轻量 prompt 和闭环 runtime

一句话总结：

> 当前 `demo` profile 适合演示“弱模型也能更聪明地用 Agent / Skill”；如果你还要演示“平台闭环能力”，现阶段最稳的选择是 `full --rule-level quick`。
