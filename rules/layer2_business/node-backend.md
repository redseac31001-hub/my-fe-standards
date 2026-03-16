# Node Backend Guidelines

> Layer: Business
> Context: Node.js / TypeScript backend services (NestJS / Express / Fastify / Koa / Hono)
> Tags: #NodeJS #TypeScript #Backend
> Priority: High

<!-- @level:summary -->
## Summary (摘要)

Node 后端重点是异步边界、输入校验、统一错误处理和非阻塞运行时约束。优先保证：请求 schema 校验、异步错误可追踪、阻塞操作隔离、资源关闭路径完整。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| 输入校验 | 使用 DTO/schema（如 class-validator / zod / ajv），禁止裸用 `req.body` |
| 错误处理 | 异常统一映射到中间件 / filter，禁止到处 `res.status(...).json(...)` |
| 异步模型 | 所有 I/O 路径必须 `await` 或显式返回 Promise，禁止悬空异步 |
| 性能 | 禁止在请求线程执行大 JSON 序列化、CPU 密集计算、同步文件 I/O |
| 生命周期 | 启停时显式关闭 DB、队列、HTTP server，保证 graceful shutdown |

### 框架补充

- `NestJS`：controller/provider/module 边界清晰，业务逻辑放 provider/service
- `Express/Fastify/Koa/Hono`：路由层轻量化，统一 schema 与 error middleware

### 禁止写法

- handler 中直接访问 ORM + 拼响应 + 写鉴权逻辑
- 使用 `any` 接请求载荷并向下游透传
- 用同步 API 读文件、压缩、加密
- 捕获异常后只 `console.log` 不返回标准错误

<!-- @level:full -->
## 1. The Rule

### 请求入口
*   **必须** 为 params/query/body 定义 DTO 或 schema，并在入口层完成校验。
*   **禁止** 将 `req.body` / `ctx.request.body` 作为 domain input 直接透传。
*   **推荐** 将 transport DTO 映射到业务命令对象。

### 异步与错误
*   **必须** 统一处理异步异常，确保 rejected promise 不会静默丢失。
*   **必须** 在统一异常中间件 / filter 中映射错误码和响应结构。
*   **禁止** 在不同路由中重复实现错误翻译逻辑。

### 运行时约束
*   **禁止** 在请求链路中执行同步文件 I/O、同步压缩、重型计算。
*   **推荐** 将 CPU 密集型任务交给 job queue、worker thread 或离线任务。
*   **必须** 对外部调用设置超时、重试和取消策略。

### 框架分层
*   **NestJS**：`controller -> service -> repository`，守卫/拦截器负责横切关注点。
*   **Express/Fastify/Koa/Hono**：route 只做协议适配，service 管业务，repository/gateway 管依赖访问。
*   **推荐** 结构化日志输出 `requestId`、`userId`、`route`、`latencyMs`。

## 2. Common Patterns

### 推荐处理流

```text
route/controller
  -> validation pipe / schema
    -> service
      -> repository / client
        -> error mapper
```

### 自检清单

- 是否存在悬空 Promise 或未处理的 rejected promise
- 是否使用统一校验模型，而非散落的手写判断
- 是否把 CPU 密集型工作从请求链路移出
- 是否实现 graceful shutdown
- 是否对外部依赖加超时和错误分级

## 3. Output Expectations

- 生成方案时，优先输出 DTO / service / repository 分层
- 审查问题时，优先指出阻塞点、异常扩散、schema 缺失
- 给测试建议时，覆盖 route contract、service logic、integration happy/error path
