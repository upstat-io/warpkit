---
name: impl-hygiene-review
description: Review implementation hygiene at package boundaries. NOT architecture or code style — purely plumbing quality.
allowed-tools: Read, Grep, Glob, Task, Bash, EnterPlanMode
---

# Implementation Hygiene Review

Review implementation hygiene against `.claude/rules/impl-hygiene.md` and generate a plan to fix violations.

**Implementation hygiene is NOT architecture** (design decisions are made) **and NOT code style** (naming, comments, formatting). It's the plumbing layer — package boundaries, error flow, provider abstraction, reactivity correctness, build output.

## Target

`$ARGUMENTS` specifies the boundary or scope to review. There are two modes:

### Path Mode (explicit package/module targets)
- `/impl-hygiene-review src/core` — review core navigation and state machine boundaries
- `/impl-hygiene-review packages/data` — review data package error flow and exports
- `/impl-hygiene-review src/core packages/errors` — review core→errors boundary
- `/impl-hygiene-review packages/websocket packages/errors` — review websocket→errors boundary
- `/impl-hygiene-review src/errors` — review error overlay and global handlers

### Commit Mode (use a commit as a scope selector)
- `/impl-hygiene-review last commit` — review files touched by the most recent commit
- `/impl-hygiene-review last 3 commits` — review files touched by the last N commits
- `/impl-hygiene-review <commit-hash>` — review files touched by a specific commit

**CRITICAL: Commits are scope selectors, NOT content filters.** The commit determines WHICH files and areas to review. Once the files are identified, review them completely — report ALL hygiene findings in those files, regardless of whether the finding is "related to" or "caused by" the commit. The commit is a lens to focus on a region of the codebase, nothing more. Do NOT annotate findings with whether they relate to the commit. Do NOT deprioritize or exclude findings because they predate the commit.

**Commit scoping procedure:**
1. Use `git diff --name-only HEAD~N..HEAD` (or appropriate range) to get the list of changed `.ts`/`.svelte.ts`/`.svelte` files
2. Expand to include the full package or module those files belong to
3. Proceed with the standard review process using those as the target

If no argument: default to `last commit` mode (review files touched by the most recent commit).

## Execution

### Step 1: Load Rules

Read `.claude/rules/impl-hygiene.md` to have the full rule set in context.

### Step 2: Map the Boundary

Identify the layer boundary being reviewed:
1. What types cross the boundary? (ErrorReport, ErrorChannelSource, provider interfaces, route configs)
2. What classes/functions form the interface? (reportError, onErrorReport, createRoute, WarpKit, DataClient)
3. What data flows across? (errors, events, state transitions, navigation context)

For each package/module in the target, read the main entry point and key interface files to understand the public API surface.

### Step 3: Trace Data Flow

Follow the data through the relevant paths:
1. **Read the entry point** — What does the package export? What does it accept?
2. **Read the internal implementation** — How does it process data, handle errors, manage state?
3. **Read the consumers** — How is this package used by core or other packages?
4. **Check shared types** — Are types from `@warpkit/errors` and `@warpkit/types` used correctly?

### Step 4: Audit Each Rule Category

**Package Boundary Discipline:**
- [ ] No imports from core (`src/`) in packages (`packages/`)?
- [ ] No unauthorized cross-package imports?
- [ ] Dependency direction correct (never upward)?
- [ ] Each package stays in its domain?

**Error Flow Discipline:**
- [ ] No empty `catch {}` blocks?
- [ ] `reportError()` used with correct source for the package?
- [ ] `showUI: false` overrides justified (component has visible error UI)?
- [ ] `handledLocally: true` only when component renders the error?
- [ ] `console.error`/`console.warn` fires for all caught errors?
- [ ] `void asyncFn()` calls have `.catch()` handlers?
- [ ] Error context includes operation name and identifiers?

**Provider Abstraction:**
- [ ] No direct `window`/`history`/`location`/`localStorage` calls outside provider implementations?
- [ ] Provider interfaces used for testability?

**Svelte 5 Reactivity:**
- [ ] No destructured reactive objects?
- [ ] Runes only in `.svelte` and `.svelte.ts` files?
- [ ] `$effect` cleanup for subscriptions/listeners/timers?
- [ ] `.svelte.ts` extension used for reactive modules?

**Data Flow:**
- [ ] Error channel as the only cross-package error bridge?
- [ ] Event handlers wrapped in try/catch?
- [ ] Props down, callbacks up in components?
- [ ] Explicit TypeScript types at public interfaces?

**Public API Surface (OSS-critical):**
- [ ] No `any` types at exported function signatures or return types?
- [ ] No internal/implementation types leaking through public return types or parameters?
- [ ] Package entry points (`index.ts`) only re-export the intended public API?
- [ ] Generics at public boundaries have meaningful constraints (not unconstrained `T` where a bound is known)?
- [ ] No implementation-specific types in public interfaces (internal cache keys, internal state shapes, private enums)?
- [ ] Exported interfaces/types are intentional — every export is a semver contract?

**Backward Compatibility (commit mode — diff the public API before/after):**
- [ ] No exported function signatures changed incompatibly (narrowed params, widened required params, changed return types)?
- [ ] No exported types/interfaces with removed or renamed properties?
- [ ] No previously-exported symbols removed or moved without a re-export alias?
- [ ] No type parameter constraints tightened on exported generics?
- [ ] No optional parameters made required on exported functions?
- [ ] No union types narrowed on exported return types (removing a variant consumers may handle)?

In commit mode, for each package entry point in scope, use `git show HEAD~N:<file>` to read the prior version and compare the exported API surface against the current version. Flag any change that would break a consumer on upgrade.

**Build & Ship Discipline:**
- [ ] Package has build step producing `dist/`?
- [ ] No relative paths to other packages?
- [ ] Type declarations (`.d.ts`) included?
- [ ] No hardcoded versions in templates?

**Navigation Pipeline (if reviewing core):**
- [ ] 9-phase pipeline respected, no phase skipping?
- [ ] Hook errors don't cascade (individual try/catch)?
- [ ] Navigation errors surface via `reportError()` with `showUI: true`?
- [ ] `beforeNavigate` abort semantics correct?

**Route Config Validation (if reviewing route definitions):**
- [ ] Bad config throws at definition time, not navigation time?
- [ ] Component is lazy import function?
- [ ] Layout has `{ id, load }` shape?
- [ ] Default paths match actual routes?

**Gap Detection:**
- [ ] Features exposed at one layer also implemented in the layers they depend on?
- [ ] No silent workarounds for missing capabilities?
- [ ] Full request path works end-to-end for each feature?

### Step 5: Compile Findings

Organize findings by boundary/interface, categorized as:

- **LEAK** — Boundary violation: package importing from core, direct browser API in core logic, runes in `.ts` file
- **DRIFT** — Inconsistency: same pattern done differently across similar packages, error reporting with different conventions
- **GAP** — Feature supported in one layer but blocked or missing in another, breaking end-to-end functionality
- **WASTE** — Unnecessary complexity: over-abstraction, redundant transformation, unused exports
- **SWALLOW** — Silent error suppression: empty catch, `showUI: false` without visible error UI, missing `.catch()` on fire-and-forget
- **EXPOSURE** — Public API leak: implementation details in exported types, untyped/`any` exports, accidental re-exports, unconstrained generics. In an OSS project every export is a semver contract — consumers will depend on whatever shape ships, and removing it is a breaking change.
- **BREAKING** — Backward-incompatible change to an already-public API: removed export, changed function signature, narrowed return type, removed interface property, tightened generic constraint. Highest severity — this will break consumers on upgrade.
- **NOTE** — Observation, not actionable (acceptable tradeoff, documented exception)

### Step 6: Generate Plan

Use **EnterPlanMode** to create a fix plan. The plan should:

1. List every finding with `file:line` references
2. Group by boundary (e.g., "package→core", "core→providers", "package→errors")
3. Estimate scope: "N boundaries, ~M findings"
4. Order: swallows first (silent errors), then leaks (boundary violations), then gaps (end-to-end breaks), then exposure (API leaking), then waste (cleanup)

### Plan Format

```
## Implementation Hygiene Review: {target}

**Scope:** N boundaries reviewed, ~M findings (X breaking, Y exposure, Z swallow, W leak, ...)

### {Boundary: Layer A → Layer B}

**Interface types:** {list types crossing this boundary}
**Entry points:** {list key classes/functions}

1. **[SWALLOW]** `file:line` — {description}
2. **[LEAK]** `file:line` — {description}
3. **[GAP]** `file:line` — {description}
4. **[DRIFT]** `file:line` — {description}
5. **[EXPOSURE]** `file:line` — {description}
...

### {Next Boundary}
...

### Execution Order

1. Public API fixes: breaking changes first (restore compat or document as intentional major bump), then exposure (accidental exports, untyped boundaries, `any` leaks)
2. Silent error fixes (empty catches, missing .catch(), showUI:false without UI)
3. Boundary violation fixes (may require moving logic between packages)
4. Gap fixes (unblock end-to-end feature paths)
5. Error flow fixes (correct sources, add context)
6. Reactivity fixes (destructuring, wrong file extensions)
7. Build/ship fixes
8. Run `bun run typecheck` to verify no type regressions
9. Run `bun test` and `bun run test:packages` to verify no behavior changes
```

## Important Rules

1. **No architecture changes** — Don't propose new packages, new layers, or restructured project graph
2. **No code style fixes** — Don't flag naming, comments, or file organization
3. **Trace, don't grep** — Follow actual data flow through the code, don't just search for patterns
4. **Read both sides** — Always read both the producer and consumer of a boundary
5. **Understand before flagging** — Some apparent violations are intentional (e.g., cache warnings using `showUI: false` because cache failures are non-fatal)
6. **Be specific** — Every finding must have `file:line`, the boundary it violates, and a concrete fix
