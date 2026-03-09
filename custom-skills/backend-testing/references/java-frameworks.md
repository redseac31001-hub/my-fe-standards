# Java Framework Testing

Load this after `java-testing.md` when framework slices or runtime wiring matter.

## Spring Boot

- Use slice tests such as controller or repository slices before full `@SpringBootTest`.
- Keep `MockMvc`, repository, and service tests separated by responsibility.
- Be explicit about transaction rollback and database fixture ownership.
- Override messaging, HTTP, and clock dependencies instead of booting the real world.

## Quarkus / Micronaut / Jakarta REST

- Prefer the narrowest framework harness that still proves the contract.
- Keep request validation and exception mapping visible in transport-level tests.
- Be explicit about config overrides, persistence setup, and test profile usage.
- Avoid tests that rely on implicit framework startup order.

## Framework-Specific Smells

- Full container or full app startup for pure domain tests.
- Persistence assertions that depend on hidden transaction behavior.
- Contract tests coupled to framework default serialization quirks.
