# Backend Service Guidelines

> Layer: Business
> Context: Shared backend service rules across HTTP / RPC services
> Tags: #Backend #ServiceDesign #API
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

后端服务规则的目标是稳定接口契约、清晰边界、可观测、可回滚。优先保证：请求校验、错误契约统一、业务逻辑与传输/存储解耦、关键链路有日志与指标。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 请求入口 | 先校验再执行业务逻辑，禁止让无效输入进入 service |
| 业务边界 | controller/handler 只做协议适配，业务规则进入 service/use-case |
| 数据访问 | repository/DAO 负责持久化细节，禁止在 handler 中拼 SQL/ORM 查询 |
| 错误处理 | 使用统一错误模型和统一响应映射，禁止直接暴露底层异常 |
| 可观测性 | 关键请求必须有 request id、结构化日志、延迟/失败指标 |

### 禁止写法

- 在 handler/controller 中堆业务逻辑
- 返回未版本化、未约束的动态 JSON 结构
- 直接把数据库实体作为 API 返回模型
- 吞掉异常，仅记录字符串日志

<!-- @level:full -->
## 1. The Rule

### 入口边界
*   **必须** 在请求入口完成参数校验、认证上下文提取和幂等信息准备。
*   **禁止** 让 controller / handler 直接承担复杂业务编排。
*   **推荐** 将业务操作组织为 use-case / service 方法，并保持输入输出明确。

### 契约稳定性
*   **必须** 为对外接口定义稳定 DTO / schema；字段重命名或语义变化必须显式版本化。
*   **禁止** 直接返回 ORM Entity、数据库行对象或框架内部类型。
*   **推荐** 为错误响应定义统一 code / message / details 结构。

### 可靠性与可观测性
*   **必须** 为每个请求链路关联 request id / trace id。
*   **必须** 对失败、超时、重试、外部依赖调用保留结构化日志。
*   **推荐** 对写操作设计幂等键、去重策略或事务边界。

### 数据与事务
*   **必须** 在 service 层定义事务边界，而不是散落在多个入口函数中。
*   **禁止** 在一个请求中混合多个无法回滚的外部副作用而没有补偿策略。
*   **推荐** 将查询优化、批处理、分页策略收敛到 repository 层。

## 2. Common Patterns

### 推荐分层

```text
handler/controller
  -> service / use-case
    -> repository / gateway
      -> database / external api
```

### 错误映射

```text
domain error
  -> application error
    -> transport response
```

### 自检清单

- 入口是否先校验后执行业务
- DTO 是否与存储模型解耦
- 错误响应是否可被客户端稳定消费
- 日志是否带 request id / trace id
- 写操作是否定义幂等或事务策略

## 3. Output Expectations

- 输出接口方案时，先给 handler/service/repository 分层建议
- 审查问题时，优先指出契约泄漏、边界混乱、异常处理缺失
- 涉及链路问题时，补充日志、指标、trace 的最小方案
