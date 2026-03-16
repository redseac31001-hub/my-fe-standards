# ARCHITECTURE

> Last updated: 2026-03-07
> Scope: CodeBuddy standards delivery, local knowledge packaging, agent execution

## Related Documents

- Execution roadmap: [ROADMAP.md](./ROADMAP.md)
- Architecture constraints: [docs/reference/architecture-constraints.md](./docs/reference/architecture-constraints.md)

## Purpose

This document defines the target system architecture for this repository.

It answers:

- what the system is made of
- which layer owns which responsibility
- how local and remote delivery should work
- how single-project and workspace installs should differ
- where automatic execution begins and where delivery ends

## Design Goals

- keep rules, skills, and agents file-based and locally readable
- make business-project installation lighter and easier to diagnose
- support remote delivery without rewriting local file references
- support technology-stack-aware composition when remote delivery is enabled
- keep execution concerns separate from delivery concerns
- keep the default install and AI-tool integration path stable while allowing opt-in expansion

## System Layers

### 1. Knowledge Plane

This layer stores the actual knowledge and reusable assets.

Contents:

- `rules/`
- `custom-skills/`
- `agents/`
- `references/`
- `assets/`
- `templates/`
- skill and agent helper scripts

Responsibilities:

- provide human-readable and model-readable source material
- support progressive disclosure
- keep skill and agent references path-based and local-first

Non-goals:

- no remote runtime protocol should replace local file reading here
- no MCP dependency should be required to consume these files

### 2. Delivery Plane

This layer decides what to install into a business project and how to install it.

Core components:

- `codebuddy-loader`
- local distribution logic
- remote manifest resolution
- content-pack resolution
- install state tracking
- incremental sync
- `status` / `doctor`

Responsibilities:

- inspect the target project or workspace
- detect relevant technology-stack labels
- choose the right delivery profile
- fetch or copy the required resources
- write `.codebuddy/*`
- record install state and managed files
- diagnose drift and stale artifacts

Primary outputs:

- `.codebuddy/rules`
- `.codebuddy/skills`
- `.codebuddy/agents`
- `.codebuddy/scripts`
- `.codebuddy/workflows`
- `.codebuddy/taskbooks`
- `.codebuddy/agent-calls`
- `.codebuddy/install.json`

### 3. Execution Plane

This layer uses installed resources to actually run work.

Core components:

- `task-orchestrator`
- `task-executor`
- `agent-runtime`
- `agent-call-manager`
- future `worker-executor`
- future `model-router`

Responsibilities:

- turn a requirement into task execution
- select the right agent or script path
- inject installed rules, skills, and agents into execution context
- manage blocked/resume flows
- write back execution results

Non-goals:

- this layer should not decide how repository content is delivered
- this layer should not own remote packaging strategy

## Layer Boundaries

The most important boundary is:

- Knowledge Plane defines content
- Delivery Plane decides what gets installed
- Execution Plane decides how installed content gets used

This separation must stay intact.

Examples:

- content packs belong to Delivery Plane
- `SKILL.md` structure belongs to Knowledge Plane
- `worker-executor` belongs to Execution Plane

## Delivery Profiles

The loader now has four profiles:

- `core`
- `analysis`
- `orchestrator`
- `full`

### `core`

Minimal validation-oriented runtime.

Includes:

- core rules/skills/agents distribution
- validator scripts only

Use when:

- the business project only needs local guidance and validation

### `analysis`

Default profile for normal business projects.

Includes:

- everything in `core`
- analysis scripts such as structure and module analysis

Use when:

- the project needs local analysis support
- orchestrator/task execution is not required

### `orchestrator`

Lean execution profile.

Includes:

- everything in `analysis`
- task runtime
- workflow/taskbook/agent-call contracts
- deeper analysis helpers used by execution flows

Does not include:

- optional admin/discovery surface that is only needed for the full compatibility set

### `full`

Compatibility and admin superset.

Includes:

- everything in `orchestrator`
- the remaining management/discovery runtime surface

Compatibility rule:

- legacy `--enable-orchestrator` maps to `full`

## Local Delivery Model

Local mode is the primary mode.

Flow:

1. inspect current project or workspace
2. detect stack and profile
3. load repository content from local filesystem
4. install the required subset into `.codebuddy/*`
5. write `.codebuddy/install.json`

Why local-first:

- local file reads are the most natural path for models
- existing relative references remain valid
- no remote service is required for normal use

## Remote Delivery Model

Remote mode should not fetch every file one by one forever.

Target approach:

1. fetch remote `manifest.json`
2. resolve required content packs
3. download packs
4. verify hashes
5. unpack into a local cache/staging area
6. reuse the same local installation pipeline

This means remote mode changes transport, not local consumption.

### Content Pack Model

A content pack is a packaged resource bundle used by the Delivery Plane.

It should contain installable repository content, not opaque service-only logic.

Possible pack categories:

- base pack
- technology-stack packs
- ecosystem packs
- runtime/profile packs

Examples:

- `base-core`
- `stack-vue2`
- `stack-vue3`
- `stack-typescript`
- `ui-antdv`
- `build-vite`
- `runtime-analysis`
- `runtime-orchestrator`
- `runtime-full`

## Technology-Stack-Aware Remote Composition

Dynamic remote composition is supported as a target architecture, but it belongs to the Delivery Plane.

The correct design is:

1. inspect local dependencies
2. compute stack labels
3. resolve packs from manifest metadata
4. download only the required packs
5. deduplicate repeated packs
6. install merged results locally

This should not be implemented as:

- one pack per every possible stack combination
- one remote request per individual content file

## Workspace Strategy

Workspace support must be explicit.

There are two valid install scopes:

- `workspace-union`
- `project-targeted`

### `workspace-union`

Use when:

- one shared `.codebuddy/*` install should serve the whole workspace

Behavior:

- inspect every subproject
- compute the union of stack labels
- download only the unique pack set
- install one shared result

Tradeoff:

- broader install surface
- lower duplication

### `project-targeted`

Use when:

- different subprojects need isolated stack-specific guidance

Behavior:

- resolve packs for one selected subproject
- install a narrower result

Tradeoff:

- narrower context
- may require repeated installs per subproject

### Workspace Rule

Even in workspace mode, repeated shared packs must be downloaded once, not once per project.

The resolver should work on unique labels, not raw project count.

## Install State and Sync Model

`.codebuddy/install.json` is the Delivery Plane source of truth for installed state.

It should track:

- schema version
- loader version
- mode
- profile
- source metadata
- options
- outputs
- managed files
- stable content hash

This file supports:

- status inspection
- drift diagnosis
- stale file cleanup
- incremental sync

## Execution Model

Once installation is complete, the Execution Plane can consume the installed runtime.

Current path:

1. user provides a requirement
2. orchestrator creates or continues a taskbook
3. planner creates tasks
4. executor routes work to scripts or agents
5. blocked work writes agent-call contracts
6. results resume execution

Target end-state:

1. weak model routes and plans
2. strong model executes complex implementation and review work
3. worker executor writes results back automatically

## Why MCP Is Not The Content Plane

MCP remains useful for tool capability exposure.

Examples:

- task orchestration endpoints
- structure analysis tools
- remote agent-call writeback

MCP should not replace:

- local rules
- local skills
- local agents
- local reference files

Reason:

- the knowledge system is file-based by design
- local files keep prompting and path references simple
- content-pack delivery already solves remote transport without changing consumption semantics

## Architecture Principles

1. Local knowledge stays file-based
2. Remote delivery changes transport, not content semantics
3. Delivery and execution evolve independently
4. Profiles reduce runtime footprint before stack-aware composition expands it
5. Workspace installs deduplicate by labels, not by project count
6. Backward-compatible CLI behavior must be preserved when profile semantics evolve
7. New complexity is acceptable only when it reduces user-visible cost or unlocks a concrete capability

## Recommended Implementation Order

### Delivery Plane

1. profile-based delivery
2. install-state tracking
3. incremental sync
4. management commands
5. remote content packs
6. single-project stack-aware pack resolution
7. workspace union and targeted pack resolution

### Execution Plane

1. worker executor contract
2. model router
3. automatic writeback
4. full one-requirement execution loop

## Non-Goals

- do not replace local file delivery with MCP content fetching
- do not collapse skill structure back into monolithic files just to reduce file count
- do not couple content-pack work with execution-plane model routing
- do not prebuild every possible framework combination as a separate static archive

## Short Version

The system should remain:

- file-based in content
- selective in delivery
- layered in execution

Remote evolution should make installation smarter, not make knowledge consumption more complex.
