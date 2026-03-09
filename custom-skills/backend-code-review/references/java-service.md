# Java Service Review

Use this as the baseline for backend services in Java.

Pair it with [java-frameworks.md](java-frameworks.md) when the project uses Spring Boot, Quarkus, Micronaut, or Jakarta REST.

## Focus Areas

- Keep controller, service, and repository responsibilities separate.
- Validate DTOs explicitly and keep entity mutation controlled and reviewable.
- Keep transaction scope tight; check lazy-loading and persistence side effects at boundaries.
- Avoid hidden cross-service coupling through static helpers, global mappers, or util classes.
- Surface domain errors through stable exception mapping instead of raw framework exceptions.

## Common Smells

- Fat controller with orchestration and persistence logic mixed together.
- Transaction declared on overly broad methods or whole classes without justification.
- Entity exposed directly as API contract.
- Repository query logic duplicated across services.
- Validation scattered across annotations, manual `if` branches, and repository constraints.
