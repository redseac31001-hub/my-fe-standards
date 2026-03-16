# Rust Backend Guidelines

> Layer: Business
> Context: Rust backend services (Axum / Actix Web / Rocket / Tonic)
> Tags: #Rust #Backend #ServiceDesign
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

Rust 后端重点是类型化错误、状态管理、异步运行时正确性和序列化边界。优先保证：`Result` 路径清晰、共享状态显式、阻塞任务隔离、DTO 与 domain 模型边界明确。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 错误建模 | 使用 typed error / `Result`，禁止 `unwrap()` 穿越请求边界 |
| 状态管理 | 通过 `State` / extractor / context 注入依赖，禁止全局可变状态 |
| 异步运行时 | 阻塞任务移到 `spawn_blocking` 或独立 worker，禁止卡住 runtime |
| 序列化 | 对外接口使用独立 request/response DTO，禁止直接暴露内部结构 |
| 可观测性 | 使用 `tracing` 打点，关键路径保留 span 与错误上下文 |

### 框架补充

- `Axum/Actix Web/Rocket`：handler 保持轻量，service 层持有业务规则
- `Tonic`：明确 proto contract，service 实现层不要泄漏 transport 细节

### 禁止写法

- 在 handler 中连续 `unwrap()` / `expect()`
- 共享可变全局状态且无同步策略
- 在 async handler 中做阻塞文件 I/O 或 CPU 重计算
- 把内部 domain struct 直接当成公网 API 响应

<!-- @level:full -->
## 1. The Rule

### 错误与返回值
*   **必须** 使用可枚举、可映射的错误类型，并在 transport 层统一翻译。
*   **禁止** 让 `unwrap()` / `expect()` 出现在请求链路的正常路径上。
*   **推荐** 为外部错误保留上下文，但对外暴露稳定错误码。

### 依赖与状态
*   **必须** 将数据库、客户端、配置放入显式 `AppState` / context。
*   **禁止** 依赖隐式全局状态传递业务上下文。
*   **推荐** 通过 trait + adapter 抽象外部依赖，便于集成测试。

### 异步与性能
*   **禁止** 在 async handler 中执行阻塞操作。
*   **推荐** 对 CPU/阻塞工作使用 `spawn_blocking`、消息队列或离线任务。
*   **必须** 对超时、取消和背压策略给出明确设计。

### 契约与序列化
*   **必须** 用独立 DTO 作为请求/响应模型，并对 serde 行为保持显式。
*   **推荐** 将 domain model 与 transport model 分离，避免协议变动污染核心逻辑。
*   **必须** 使用 `tracing` span 记录请求标识、关键参数和失败原因。

## 2. Common Patterns

### 推荐结构

```text
handler
  -> service
    -> repository / gateway
      -> db / external api
```

### 自检清单

- 请求链路是否存在 `unwrap()` / `expect()`
- AppState 是否显式、线程安全、职责清晰
- 阻塞逻辑是否已移出 async runtime
- DTO 与 domain model 是否解耦
- tracing 是否覆盖关键链路

## 3. Output Expectations

- 输出方案时，优先给出 handler/service/state/error 四层边界
- 审查问题时，优先指出 panic 风险、状态共享问题、阻塞点
- 给测试建议时，覆盖 handler contract、service logic、integration flow
