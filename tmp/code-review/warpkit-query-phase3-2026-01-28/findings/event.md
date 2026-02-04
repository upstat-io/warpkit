# Event Review Findings

**Reviewer**: event
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## No Relevant Files

Target does not contain files in my review domain. No issues to report.

### Analysis

The `@warpkit/query` package provides a data-fetching client, not an event system. While the package does define a minimal `QueryEventEmitter` interface and accepts event emitters for cache invalidation, this is a **consumer-facing interface** rather than an event implementation.

**What was examined:**

1. **QueryEventEmitter interface** (types.ts:224-230) - A minimal interface with only `on(event, handler)` for subscribing to events. This is for consumers to inject their own event system, not an event producer/consumer pattern.

2. **invalidateOn config** (types.ts:48) - An optional `string[]` for specifying event names that trigger cache invalidation. The untyped nature is intentional per Phase 1 #15 ADR for decoupling.

3. **Events injection** (QueryClient.ts:39,51,180-200) - Events are injected via constructor options and can be set via `setEvents()`. This follows DI best practices for testability.

**Why event-driven-architecture.md patterns do not apply:**

| Pattern | Why N/A |
|---------|---------|
| Event structure (correlationId, causationId, version) | Package does not define event types - consumers define their own |
| Idempotency | Package does not process events - only subscribes for invalidation |
| Dead letter queue | No queue/messaging implementation |
| Outbox pattern | No event publishing |
| Event naming (past tense) | No events defined - `invalidateOn` strings are consumer-defined |
| Event versioning | No event schemas defined |
| Saga patterns | No multi-step event flows |

**Test coverage for event-related functionality:**

The `QueryClient.spec.ts` file includes comprehensive tests for event-related features:
- Line 113-119: Tests custom event emitter acceptance
- Line 514-528: Tests `getEvents()` with and without events
- Line 546-557: Tests late event injection via `setEvents()`

---

## Good Practices

- Events are injected via dependency injection rather than accessed globally, enabling easy testing
- The `QueryEventEmitter` interface is minimal and does not couple the package to any specific event system
- The package works without any event emitter configured (null object pattern via default null value)
- Event-related methods (`getEvents`, `setEvents`) have comprehensive test coverage
