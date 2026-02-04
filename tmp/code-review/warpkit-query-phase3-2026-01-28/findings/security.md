# Security Review Findings

**Reviewer**: security
**Review ID**: warpkit-query-phase3-2026-01-28
**Target**: frameworks/warpkit/packages/query/src/

---

## Executive Summary

The `@warpkit/query` package demonstrates strong security practices overall. The code properly handles URL encoding, uses AbortController for fetch timeouts, delegates authentication to consumers via hooks, and avoids common security anti-patterns. No critical or high severity security issues were identified.

---

## Issues Found

### #1. Cache Key Does Not URL-Encode Parameter Values

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:250`
**Severity**: LOW
**Rule**: Input Validation - consistency between URL encoding and cache key encoding (security.md)
**Status**: OPEN

**Issue**:
The `buildCacheKey` method includes parameter values directly without URL encoding, while `resolveUrl` properly URL-encodes the same values. This inconsistency could lead to cache key collision or ambiguity when parameter values contain special characters like `&` or `=`.

```typescript
// Line 250-251 in buildCacheKey:
.map((k) => `${k}=${params[k]}`)  // params[k] is NOT encoded
.join('&');

// Line 233 in resolveUrl:
url = url.replace(match, encodeURIComponent(value));  // value IS encoded
```

For example, a parameter `{ id: 'a=b&c=d' }` would create a cache key `monitors/:id?id=a=b&c=d` which is ambiguous when parsed.

**Fix**:
Encode parameter values in the cache key to maintain consistency:

```typescript
const sortedParams = Object.keys(params)
  .sort()
  .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
  .join('&');
```

---

### #2. URL Function Callback Receives User-Controlled Params Without Encoding

**File**: `/home/eric/upstat/frameworks/warpkit/packages/query/src/QueryClient.ts:221`
**Severity**: LOW
**Rule**: Input Validation - URL encoding for dynamic routes (security.md)
**Status**: OPEN

**Issue**:
When a URL is defined as a function (rather than a string template), the function receives raw, unencoded parameter values. If the function author constructs a URL using template literals without encoding, URL injection could occur.

```typescript
// Line 220-221:
if (typeof urlTemplate === 'function') {
  return (this.config.baseUrl ?? '') + urlTemplate(params ?? {});
}
```

The documentation and tests show this pattern:
```typescript
url: (params) => `/custom/${params.type}/${params.id}`  // No encoding
```

This shifts the security responsibility to the consumer, who may forget to encode.

**Fix**:
Document that URL functions must encode dynamic values, or provide a helper:

```typescript
// Option 1: Document clearly in JSDoc for QueryKeyConfig.url
/**
 * URL or function that builds URL from params.
 * When using a function, ensure dynamic segments are URL-encoded:
 * `url: (p) => `/monitors/${encodeURIComponent(p.id)}`
 */

// Option 2: Provide encoded params to the function
if (typeof urlTemplate === 'function') {
  const encodedParams = Object.fromEntries(
    Object.entries(params ?? {}).map(([k, v]) => [k, encodeURIComponent(v)])
  );
  return (this.config.baseUrl ?? '') + urlTemplate(encodedParams);
}
```

---

## Good Practices

- **URL Encoding**: String-based URL templates properly use `encodeURIComponent()` for parameter values (line 233)
- **Fetch Timeout**: All fetch calls use AbortController with configurable timeout (default 30s), preventing indefinite hangs (lines 98-99, 110, 134)
- **Authentication Delegation**: Auth is handled via `onRequest` hook, allowing consumers to inject tokens without hardcoding secrets in the library (lines 104-107)
- **No Hardcoded Secrets**: No API keys, passwords, or tokens are hardcoded anywhere in the codebase
- **Error Message Safety**: Error messages include HTTP status but do not leak sensitive server details (line 118)
- **Type Safety**: The module augmentation pattern ensures type-safe query keys, reducing the risk of typos leading to unexpected API calls
- **Defensive Cleanup**: `clearTimeout` is called in both the try block and finally block, ensuring cleanup even on errors (lines 110, 134)
- **No eval/new Function**: No dynamic code execution patterns that could lead to code injection
- **No SQL**: This is a client-side data fetching library with no direct database access
- **No innerHTML/XSS vectors**: The code does not manipulate DOM or generate HTML

---

## OWASP Top 10 Assessment

| Category | Status | Notes |
|----------|--------|-------|
| A01 Broken Access Control | N/A | Auth delegated to consumer via onRequest hook |
| A02 Cryptographic Failures | N/A | No crypto operations in this package |
| A03 Injection | PASS | URL params properly encoded, no SQL/command execution |
| A04 Insecure Design | PASS | Timeout defaults, fail-fast on errors, DI for testability |
| A05 Security Misconfiguration | N/A | No server configuration in client library |
| A06 Vulnerable Components | N/A | No external dependencies beyond Svelte |
| A07 Auth Failures | N/A | Auth handled by consumer |
| A08 Data Integrity | PASS | E-Tag validation for cache coherence |
| A09 Logging Failures | N/A | No logging in this library |
| A10 SSRF | N/A | URLs are configured by application, not user input |

---

## Security-Relevant Test Coverage

The test file `QueryClient.spec.ts` includes security-relevant tests:

- **Line 182-195**: Tests that URL parameter values are properly URL-encoded (`special/value` becomes `special%2Fvalue`)
- **Line 160-165**: Tests that missing parameters throw errors (prevents partial URL construction)
- **Line 137-143**: Tests that unknown query keys throw errors (prevents arbitrary endpoint access)
- **Line 238-247**: Tests that non-OK HTTP responses throw errors (fail-fast behavior)
- **Line 407-456**: Tests timeout behavior (prevents indefinite hangs)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 |

The `@warpkit/query` package follows security best practices. The two LOW severity issues identified are edge cases related to encoding consistency that are unlikely to be exploited in practice but represent opportunities for improvement.
