# Java Framework Review

Load this after `java-service.md` when the project uses a Java server framework.

## Spring Boot

- Keep `@RestController`, `@Service`, and repository boundaries clear; avoid service methods that are just wrappers around repository calls plus side effects.
- Review `@Transactional` scope carefully; broad transactions often hide coupling and lazy-load surprises.
- DTO validation should be explicit and stable; do not rely on persistence exceptions as validation.
- Use `@ControllerAdvice` or equivalent mapping for domain errors; avoid leaking framework defaults.
- Beware hidden behavior from auto-configuration when it changes contract or startup wiring.

## Quarkus / Micronaut / Jakarta REST

- Keep injection and bean scope explicit; avoid static helper shortcuts that bypass DI.
- Check how validation, serialization, and exception mapping are wired; consistency matters more than framework preference.
- Review startup-time configuration assumptions and feature flags carefully.
- Keep persistence ownership explicit when request handlers call repositories directly.
- Avoid framework annotations becoming the main place where business rules live.

## Framework-Specific Smells

- Transactional scope broader than the real unit of work.
- Domain contracts coupled to JPA entities or framework response types.
- Heavy use of reflection-style magic or annotation chains with unclear execution order.
