# Java Backend Testing

Use this as the baseline for backend tests in Java.

Pair it with [java-frameworks.md](java-frameworks.md) when framework-managed slices or bootstrapping matter.

## Focus Areas

- Unit-test service logic separately from controller wiring.
- Use slice tests when controller validation or repository mapping matters.
- Keep integration tests explicit about database and transaction expectations.
- Assert both happy path and exception mapping path.
- Make fixture setup deterministic; avoid shared mutable global test state.
