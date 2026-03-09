# Node Framework Review

Load this after `node-service.md` when framework-specific transport behavior matters.

## NestJS

- Controllers should adapt transport only; orchestration belongs in providers or use-case services.
- DTO validation should be centralized through pipes or a consistent schema layer, not duplicated per method.
- Guards, interceptors, and filters should stay composable and easy to reason about.
- Watch module boundaries and exported providers; avoid circular module graphs and global modules by default.
- Exception filters should preserve stable error semantics and logs.

## Express / Fastify / Koa / Hono

- Validate and normalize request input once in middleware, schema hooks, or route adapters.
- Keep middleware or plugin order explicit; review hidden dependencies on mutation of `req`, `res`, or `ctx`.
- Centralize async error mapping and timeout behavior.
- Keep route registration thin; business logic should not depend on framework request objects.
- Review plugin or decorator scope carefully to avoid surprising shared state.

## Framework-Specific Smells

- Business rules hidden in decorators, hooks, middleware, or interceptors.
- Transport context passed deep into repositories or domain services.
- Framework exception shape leaking directly to external contracts.
