# Java Backend Guidelines

> Layer: Business
> Context: Java backend services (Spring Boot / Quarkus / Micronaut / Jakarta REST)

<!-- @level:summary -->
## Summary (摘要)

Java 后端重点是分层边界、事务一致性、DTO 与实体分离、统一异常处理。优先保证：Controller 轻量、Service 持业务规则、Repository 持久化职责清晰、事务边界可解释。

<!-- @level:quick -->
## Quick Reference (快速参考)

### 核心规则

| 场景 | 规则 |
|------|------|
| API 分层 | Controller 只做协议适配，业务逻辑进入 Service |
| 数据模型 | DTO / VO / Entity 分离，禁止直接返回 JPA Entity |
| 事务 | 在 Service 层定义事务边界，禁止在 Controller 上堆事务 |
| 校验 | 使用 Bean Validation / framework validation，禁止零散 if-else 校验 |
| 异常 | 使用统一 `@ControllerAdvice` / mapper，禁止泄漏堆栈和底层异常文案 |

### 框架补充

- `Spring Boot`：善用 validation、transaction、controller advice
- `Quarkus/Micronaut/Jakarta REST`：同样保持 transport / service / persistence 边界

### 禁止写法

- Controller 中直接写 repository 查询和实体拼装
- JPA Entity 直接序列化给外部接口
- 一个事务中混入网络调用且没有补偿策略
- 用宽泛 `catch (Exception)` 吞掉领域语义

<!-- @level:full -->
## 1. The Rule

### 分层责任
*   **必须** 将 controller/resource 层限制为参数绑定、认证上下文、响应映射。
*   **必须** 将业务决策、流程编排、事务控制放在 service/application 层。
*   **推荐** repository 仅暴露聚合级别的数据访问方法，而不是泄漏 ORM 细节。

### 模型边界
*   **必须** 将 Entity 与 API DTO 分离。
*   **禁止** 让懒加载实体在序列化阶段触发不可控查询。
*   **推荐** 使用 assembler / mapper 显式完成模型转换。

### 事务与持久化
*   **必须** 明确事务边界，并说明是本地事务还是最终一致性。
*   **禁止** 在长事务中执行慢外部调用。
*   **推荐** 对 JPA 查询关注 N+1、分页、批量写入策略。

### 异常与可观测性
*   **必须** 使用统一异常映射器返回稳定错误结构。
*   **推荐** 记录业务主键、请求标识、耗时和下游依赖状态。
*   **禁止** 将堆栈、SQL 文本、框架内部异常直接暴露给客户端。

## 2. Common Patterns

### 推荐分层

```text
controller/resource
  -> service
    -> repository
      -> entity manager / jdbc / external client
```

### 自检清单

- Controller 是否保持轻量
- DTO / Entity 是否已经解耦
- 事务是否只覆盖必要数据变更
- 是否存在 N+1 或隐式懒加载问题
- 是否实现统一异常映射

## 3. Output Expectations

- 输出设计时，优先说明 controller/service/repository/transaction 边界
- 审查问题时，优先指出实体泄漏、事务过宽、异常不统一
- 给测试建议时，覆盖 validation、service transaction、repository integration
