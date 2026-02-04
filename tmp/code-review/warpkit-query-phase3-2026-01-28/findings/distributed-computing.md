# Distributed Computing Review Findings

**Reviewer**: distributed-computing
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Domain Assessment

This package (`@warpkit/query`) is a **client-side browser data fetching library**. It is NOT a distributed system component that requires server-side distributed computing patterns.

**Server-side patterns that do NOT apply:**
- Consensus/Quorum - Not applicable (no multi-node coordination)
- Leader Election - Not applicable (no distributed coordination)
- Distributed Locks - Not applicable (no resource locking)
- Sagas - Not applicable (no distributed transactions)
- Fencing Tokens - Not applicable (no leader writes)
- Message Acknowledgment - Not applicable (no queue consumption)

**Client-side patterns that DO apply:**
- Timeout on external calls - REQUIRED for all HTTP requests
- Retry with backoff - Optional (design decision to delegate to consumer)
- Correlation IDs - Optional (can be added via onRequest hook)

---

## Issues Found

No issues found.

---

## Verified Compliant Patterns

### 1. Timeout on External Calls (CRITICAL Pattern)

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:98-135`
**Status**: COMPLIANT

The code correctly implements timeout handling using AbortController:

```typescript
// Line 98-99: Create AbortController with timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), this.timeout);

try {
    let request = new Request(url, { headers, signal: controller.signal });
    // ... onRequest hook
    const response = await fetch(request);
    clearTimeout(timeoutId);  // Line 110: Clear on success
    // ... process response
} finally {
    clearTimeout(timeoutId);  // Line 134: Defensive cleanup in finally
}
```

This follows the documented best practice from `concurrency.md`:
- AbortController created before fetch
- Signal passed to fetch Request
- Timeout set via setTimeout
- Defensive double-cleanup (both in try block and finally block) is correct per concurrency.md

### 2. Configurable Timeout Default

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:52`
**Status**: COMPLIANT

Default timeout of 30000ms (30 seconds) matches the documented HTTP timeout recommendation:
```typescript
this.timeout = config.timeout ?? 30000;
```

### 3. Retry Logic Delegation

**File**: Design decision documented in deferrals.md
**Status**: COMPLIANT (by design)

The package intentionally does NOT implement retry logic. Per `deferrals.md`:
> "Missing retry logic" - Retry is consumer responsibility - Design decision - `04-query-package.md`

This is a valid design decision for a framework library. Consumers can implement retry logic:
- Via the `onRequest` hook for request-level retry
- By wrapping `client.fetch()` calls with retry logic
- By using a higher-level abstraction that adds retry

### 4. Request Interception for Correlation IDs

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:104-107`
**Status**: COMPLIANT

The `onRequest` hook allows consumers to add correlation IDs:
```typescript
if (this.config.onRequest) {
    request = await this.config.onRequest(request);
}
```

Consumers can add `X-Correlation-ID` or `X-Request-ID` headers via this hook.

---

## Good Practices

- Timeout is ALWAYS applied to fetch calls (no path without timeout protection)
- Default timeout (30s) is reasonable for HTTP APIs
- Timeout is configurable per QueryClient instance
- Defensive cleanup pattern (clearTimeout in both try and finally) prevents timer leaks
- Request interception hook enables correlation ID injection without coupling to specific implementation
- Design decision to delegate retry logic to consumers is documented and justified

---

## Notes for Other Reviewers

This package is correctly designed as a focused HTTP client library. The distributed computing patterns it SHOULD implement (timeout) are correctly implemented. The patterns it does NOT implement (retry) are intentionally delegated to consumers, which is a valid framework design pattern.

The briefing documents explicitly mark "Missing retry logic" as a WON'T FIX item with the rationale that retry is consumer responsibility. This matches the framework's design principle of being composable rather than opinionated.
