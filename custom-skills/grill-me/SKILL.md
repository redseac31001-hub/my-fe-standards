---
name: grill-me
description: "Trigger when the user wants to stress-test a plan, design, architecture decision, PRD, proposal, or implementation approach through relentless one-question-at-a-time interrogation. Use when the user says \"grill me\", asks to be challenged, asks for a design critique, or wants decisions walked down until shared understanding."
metadata:
  triggers:
    - "grill me"
    - "stress-test plan"
    - "challenge my plan"
    - "质询方案"
    - "追问设计"
    - "拷问我"
    - "帮我挑战这个方案"
  roles:
    - architect
    - product
    - tech-lead
    - fullstack
  scenarios:
    - planning
    - design-review
    - decision-analysis
    - requirements-discovery
---

# Grill Me

Interrogate the user's plan or design until decisions, assumptions, dependencies, and tradeoffs are explicit.

## Workflow

1. Restate the target plan or design briefly only if needed to anchor the conversation.
2. Identify the next highest-leverage unresolved decision. Prefer blockers, irreversible choices, coupling points, data contracts, operational risk, and validation strategy.
3. Ask exactly one question at a time.
4. For each question, include the recommended answer and the reason it is the default recommendation.
5. When the answer depends on repository facts, explore the codebase instead of asking the user.
6. After each user answer, update the working model and choose the next branch in the decision tree.
7. Continue until the plan has no material unresolved assumptions or the user asks to stop.

## Question Style

- Keep questions concrete, answerable, and mutually exclusive when possible.
- Challenge vague nouns by asking for observable behavior, owner, input/output, acceptance criteria, or rollback path.
- Surface hidden tradeoffs explicitly; do not accept "it depends" without naming the dependency.
- Do not batch multiple unrelated questions.

## Output

Use this shape for each turn:

```text
Question: <one focused question>

Recommended answer: <default answer>

Why: <brief reasoning>
```
