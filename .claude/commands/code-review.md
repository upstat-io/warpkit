---
name: code-review
description: Analyze WarpKit for OSS compliance, Svelte 5/XState patterns, and best practices
allowed-tools: Read, Grep, Glob, Task, Bash
---

# WarpKit Code Review

Analyze the WarpKit framework for OSS compliance, documented patterns, and industry best practices.

## Execution Strategy

### Phase 0: Automated Tooling (run first)

Run these **5 tools in parallel** using Bash. Send a **single message with 5 Bash tool calls**.

**IMPORTANT**: Each command must end with `|| true` to prevent one failure from cascading:

| Tool | Command | What it Detects |
|------|---------|-----------------|
| **typecheck** | `bun run check 2>&1 \|\| true` | TypeScript errors |
| **lint** | `bun run lint 2>&1 \|\| true` | ESLint violations |
| **test** | `bun run test --run 2>&1 \|\| true` | Unit test failures |
| **upstat-deps** | `grep -rn "@upstat/" src/ packages/ --include="*.ts" --include="*.svelte" 2>&1 \|\| true` | Forbidden @upstat/* imports |
| **loc** | `find src/ packages/ -name "*.ts" -o -name "*.svelte" \| xargs wc -l \| tail -20 2>&1 \|\| true` | Lines of code metrics |

**After tools complete**, summarize automated findings:
- **Type Safety**: Any TypeScript errors from `bun run check`
- **Lint**: Any ESLint warnings/errors
- **Tests**: Any failing tests
- **OSS Compliance**: Any @upstat/* imports (CRITICAL if found)
- **Metrics**: Total LOC, largest files

### Phase 1: Manual Analysis (after Phase 0)

Use the **Task tool** to launch **10 parallel Explore agents** (one per category below). Send a **single message with 10 Task tool calls** to maximize parallelism.

Each agent prompt should:
1. Specify the category name and detection patterns from that section
2. Search `src/` and `packages/` for violations matching those patterns
3. Return findings with: severity, location (`file:line`), issue, fix suggestion

**Example Task call:**
```
Task(
  subagent_type: "Explore",
  description: "Review: OSS Independence",
  prompt: "Search src/ and packages/ for OSS Independence violations: [paste detection patterns]. Return findings as: SEVERITY | file:line | issue | fix"
)
```

### Phase 2: Synthesis (after both phases)

Aggregate and synthesize all findings:
1. Group findings by severity (CRITICAL > HIGH > MEDIUM)
2. Cross-reference automated and manual findings
3. Identify patterns (same issue in multiple places)
4. Prioritize by impact on OSS usability
5. Present actionable summary to user

## Severity Guide

- **CRITICAL**: Must fix immediately - blocks OSS release (security, @upstat deps, hardcoded consumer types)
- **HIGH**: Should fix before merge - affects external consumers (missing generics, wrong patterns)
- **MEDIUM**: Fix when touching code - style and minor improvements

---

## 1. OSS Independence (ABSOLUTE PRIORITY)

> Framework must work for ANY consumer, not just Upstat

### Detection Patterns

**CRITICAL**
- `@upstat/*` import anywhere in `src/` or `packages/`
- Hardcoded consumer types: `UpstatUser`, `UpstatConfig`, etc.
- Direct Firebase imports in core (should be in adapter only)
- Hardcoded API URLs or environment-specific config
- Consumer-specific business logic in framework code

**HIGH**
- Missing generic type parameter where consumer needs flexibility
- Type that assumes specific user shape: `user.upstatId`, `user.subscription`
- Import from consumer codebase (`import from '../../app/'`)
- Default values that only make sense for one consumer

**MEDIUM**
- Comment referencing Upstat-specific behavior
- Example code using Upstat-specific types
- Documentation assuming specific auth provider

### Principles

- **Generic types**: `TUser`, `TUserData`, not concrete types
- **Adapter pattern**: Auth, storage, API via injectable adapters
- **Zero consumer coupling**: Framework knows nothing about consumer's domain
- **Bring-your-own**: User provides everything consumer-specific

### Checklist

- [ ] Zero `@upstat/*` imports
- [ ] All user-facing types are generic (`<TUser>`, `<TData>`)
- [ ] Auth via adapter interface, not direct provider imports
- [ ] No hardcoded URLs or environment config
- [ ] Examples use generic placeholder types

---

## 2. Svelte 5 Patterns

> Runes, proper file naming, modern syntax

### Detection Patterns

**CRITICAL**
- Svelte stores (`writable`, `readable`, `derived` from 'svelte/store')
- Old event syntax: `on:click` instead of `onclick`
- Old slot syntax: `<slot>` instead of `{@render children()}`
- `export let` for props instead of `$props()`

**HIGH**
- Destructuring reactive objects (breaks reactivity):
  ```typescript
  const { count } = $state({ count: 0 }); // WRONG
  ```
- File using runes not named `*.svelte.ts`
- Missing `Snippet` type for children props
- `$effect` without cleanup return for subscriptions

**MEDIUM**
- `$effect` where `$derived` would work (over-effectful)
- Unnecessary `flushSync` calls
- Missing type annotation on `$state`
- `$state` for values that should be `$derived`

### Principles

- **Runes only**: `$state`, `$derived`, `$effect` - no stores
- **File naming**: `*.svelte.ts` for files using runes outside components
- **Props**: `let { prop } = $props()` with types
- **Snippets**: Replace slots with `Snippet` types and `{@render}`

### Checklist

- [ ] No `writable`/`readable`/`derived` store imports
- [ ] All rune files named `*.svelte.ts`
- [ ] Props via `$props()` with types
- [ ] Events use `onclick` not `on:click`
- [ ] Children via `Snippet` and `{@render}`

---

## 3. XState v5 Patterns

> Stub actors, proper state design, actor placement

### Detection Patterns

**CRITICAL**
- Auth listener in nested state (should be at ROOT level)
- Missing `signingOut` state (race condition risk)
- `Arc<Mutex<T>>` / shared mutable state in machine context
- Side effects in guards or actions (should be in actors)

**HIGH**
- Real implementation in machine definition (should use stub + provide)
- Missing stub actor for dependency injection
- `fromPromise` without error handling (`onError`)
- Actor cleanup not returning unsubscribe function

**MEDIUM**
- Missing `assign` for context updates (direct mutation)
- Guard logic that could be simplified
- Overly complex state hierarchy
- Missing type parameters on actors

### Principles

- **Stub actor pattern**: Define stub for types, inject real at runtime
- **Root-level listeners**: Auth/global listeners at machine root, not in states
- **Explicit signing out**: Prevent race conditions with dedicated state
- **Pure machines**: No side effects in machine definition

### Checklist

- [ ] Auth listener invoked at root level
- [ ] `signingOut` state exists for sign-out flow
- [ ] Stub actors for all injectable dependencies
- [ ] All `fromPromise` actors have `onError` handlers
- [ ] Callback actors return cleanup functions

---

## 4. TypeScript Quality

> Strict types, no `as` casts, proper generics

### Detection Patterns

**CRITICAL**
- `as` type assertions: `value as Type`
- `any` type (explicit or implicit)
- `@ts-ignore` or `@ts-expect-error` without explanation
- Missing return type on exported function

**HIGH**
- `as unknown as Type` (double cast = red flag)
- Type alias instead of interface for object shapes
- Missing generic constraints: `<T>` should be `<T extends BaseType>`
- Overly broad types: `object`, `Function`, `{}`

**MEDIUM**
- Implicit `any` in callback parameters
- Missing readonly on immutable properties
- Union type where discriminated union would be clearer
- Missing JSDoc on public API

### Principles

- **No casts**: Use type guards and narrowing, not `as`
- **Explicit types**: Return types on exports, parameter types always
- **Generic constraints**: Bound generics appropriately
- **Discriminated unions**: For state-like types, use tagged unions

### Checklist

- [ ] Zero `as` casts (use type guards)
- [ ] Zero explicit `any` types
- [ ] All exported functions have return types
- [ ] Generics have appropriate constraints
- [ ] `@ts-ignore` has explanatory comment

---

## 5. Testing Quality

> Browser tests for components, proper patterns

### Detection Patterns

**CRITICAL**
- Component test using jsdom / `@testing-library/svelte` (won't work with Svelte 5)
- Missing test for public API function
- Test file for component not named `*.svelte.test.ts`
- Flaky test (timing, shared state)

**HIGH**
- Missing `await expect.element()` for async assertions
- Direct DOM manipulation instead of `page.getBy*` locators
- Missing cleanup (`actor.stop()`, effect cleanup)
- Test mocks 5+ dependencies (SRP violation)

**MEDIUM**
- Test naming doesn't describe behavior
- Missing edge case tests (empty, error, boundary)
- `vi.hoisted` mock not properly structured
- Missing AAA structure (Arrange-Act-Assert)

### Principles

- **Browser tests**: Use `vitest-browser-svelte` + Playwright for components
- **Locators**: Use `page.getBy*` methods, not direct DOM queries
- **Async**: Always `await` element assertions
- **Cleanup**: Stop actors, clean up effects in `afterEach`

### Checklist

- [ ] Components tested with `vitest-browser-svelte`
- [ ] Test files named `*.svelte.test.ts`
- [ ] Async assertions use `await expect.element()`
- [ ] Actors stopped in cleanup
- [ ] No jsdom for Svelte 5 components

---

## 6. Package Architecture

> Package boundaries, exports, dependencies

### Detection Patterns

**CRITICAL**
- Circular dependency between packages
- Package importing from another package's internals (`packages/data/src/internal/`)
- Missing export in package's `index.ts` for public type
- External dependency that should be peer dependency

**HIGH**
- Package doing too many things (SRP at package level)
- Leaking internal types in public API
- Missing type exports (consumers can't type their code)
- Inconsistent export patterns across packages

**MEDIUM**
- Barrel file re-exporting everything (prefer explicit exports)
- Package without clear single responsibility
- Missing package README or documentation
- Inconsistent naming across packages

### Principles

- **Clear boundaries**: Each package has one job
- **Public surface**: Export only what consumers need
- **Peer deps**: Framework dependencies (Svelte) as peer deps
- **No internals**: Never import from another package's `src/` directly

### Checklist

- [ ] Each package has single responsibility
- [ ] Public API explicitly exported from `index.ts`
- [ ] No circular dependencies between packages
- [ ] Framework deps (Svelte, XState) as peer deps
- [ ] Internal types not exported

---

## 7. API Design

> Public interface, configuration, documentation

### Detection Patterns

**CRITICAL**
- Function with 5+ parameters (should use config object)
- Public API without documentation
- Breaking API change without deprecation path
- `unwrap()` / forced unwrap on user input

**HIGH**
- Boolean parameter (flag argument) - split into two functions
- Missing `Default` implementation for config types
- Inconsistent parameter ordering across similar functions
- Return type that forces consumer to handle internal details

**MEDIUM**
- Missing example in documentation
- Inconsistent naming patterns
- Optional parameter that's almost always needed
- Return `Array` where iterator/callback would work

### Principles

- **Config objects**: 3+ params -> single options object
- **Documented**: All public exports have JSDoc
- **Consistent**: Same patterns across all packages
- **Consumer-first**: API designed for consumer ergonomics

### Checklist

- [ ] No functions with 5+ parameters
- [ ] No boolean flag parameters
- [ ] Public API has JSDoc documentation
- [ ] Config types implement sensible defaults
- [ ] Consistent naming across packages

---

## 8. Performance & Reactivity

> Efficient reactivity, avoiding unnecessary work

### Detection Patterns

**CRITICAL**
- `$effect` that triggers on every render (missing dependencies)
- Infinite loop from `$effect` updating its own dependency
- O(n^2) in hot path (list rendering, state updates)
- Sync heavy computation blocking UI

**HIGH**
- Creating new objects/arrays in render (breaks reference equality)
- Missing `untrack` for intentionally non-reactive reads
- `$effect` where `$derived` would work
- Excessive component re-renders from parent state

**MEDIUM**
- Missing `#[key]` in `{#each}` blocks
- Derived value recalculated unnecessarily
- Large object in `$state` where fine-grained state better
- Missing debounce on high-frequency updates

### Principles

- **Derived over effect**: Prefer `$derived` when possible
- **Fine-grained**: Small reactive pieces over large objects
- **Keys**: Always use keys in `{#each}` for lists
- **Untrack**: Use for intentionally non-reactive reads

### Checklist

- [ ] `$derived` used where possible (not `$effect`)
- [ ] `{#each}` blocks have keys
- [ ] No infinite effect loops
- [ ] Heavy computations async or memoized
- [ ] Fine-grained reactivity (not monolithic state)

---

## 9. Code Style

> DRY, naming, function size, organization

### Detection Patterns

**CRITICAL**
- Duplicated logic across files (DRY violation)
- God file: 500+ lines doing multiple unrelated things
- Hidden side effect: function does more than name suggests
- Console.log left in production code

**HIGH**
- Function > 50 lines (target < 30)
- Commented-out code checked in
- Import from sibling's internals
- Inconsistent naming (camelCase vs snake_case)

**MEDIUM**
- Magic numbers without named constant
- Comment explains "what" instead of "why"
- Dead code (unused exports, unreachable branches)
- Missing module-level documentation

### Principles

- **Single responsibility**: One reason to change per file/function
- **Small functions**: < 30 lines ideal, < 50 max
- **Meaningful names**: Self-documenting code
- **Why, not what**: Comments explain reasoning

### Checklist

- [ ] Functions < 50 lines
- [ ] Files have single clear purpose
- [ ] No commented-out code
- [ ] No console.log in production
- [ ] Consistent naming conventions

---

## 10. StandardSchema Integration

> Validation patterns, schema compatibility

### Detection Patterns

**CRITICAL**
- Direct Zod import in core (should use StandardSchema interface)
- Schema type that doesn't implement StandardSchema
- Validation that bypasses schema system

**HIGH**
- Missing async validation support
- Schema error not mapped to form field
- Type inference not working from schema
- Hard dependency on specific validator (Zod, TypeBox)

**MEDIUM**
- Schema defined inline instead of reusable constant
- Missing schema for user input
- Validation logic duplicated (in schema AND in code)
- Error messages not user-friendly

### Principles

- **StandardSchema**: Support any compliant validator
- **Type inference**: Types derived from schemas
- **Single source**: Validation logic in schema only
- **User-friendly**: Error messages for humans

### Checklist

- [ ] Core uses StandardSchema interface, not Zod directly
- [ ] Types inferred from schemas where possible
- [ ] Validation errors mapped to fields
- [ ] Works with Zod, TypeBox, Valibot

---

## Output Format

For each finding:
1. **Severity**: CRITICAL / HIGH / MEDIUM
2. **Category**: Which section above
3. **Location**: `file:line` or file path
4. **Issue**: What's wrong (one line)
5. **Fix**: How to resolve (one line)

Group by severity, then by category. Identify patterns (same issue in multiple places).

### Summary Template

```
## Code Review Summary

### Critical Issues (must fix)
[List CRITICAL findings]

### High Priority (should fix)
[List HIGH findings]

### Medium Priority (fix when touching)
[List MEDIUM findings]

### Patterns Identified
[Issues appearing in multiple places]

### Automated Tool Results
- TypeScript: [pass/fail with count]
- Lint: [pass/fail with count]
- Tests: [pass/fail with count]
- OSS Compliance: [pass/FAIL if @upstat found]
```

## References

- WarpKit rules: `.claude/rules/`
- Svelte 5 docs: https://svelte.dev/docs
- XState v5 docs: https://stately.ai/docs
