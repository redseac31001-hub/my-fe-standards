# Node Backend Testing

Use this as the baseline for backend tests in Node / TypeScript.

Pair it with [node-frameworks.md](node-frameworks.md) when framework harnesses or transport adapters matter.

## Focus Areas

- Test service logic without real network access.
- Mock repositories and upstream clients at stable boundaries.
- For HTTP handlers, assert status code, body shape, and error mapping.
- Keep integration tests focused on one boundary at a time.
- Make timeout, retry, and cancellation behavior observable in tests when the code owns them.
