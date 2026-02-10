# The Navigation Pipeline

Every navigation in WarpKit --- whether the user clicks a link, calls `navigate()`, hits the back button, or transitions between app states --- flows through the same pipeline. This is not an implementation detail you can ignore. Understanding the pipeline helps you predict exactly what will happen, in what order, and where things can go wrong.

Other frameworks render first and ask questions later. React Router matches a route and immediately renders the component, leaving data fetching and error handling to the component itself. SvelteKit runs load functions, but the relationship between loading, rendering, and navigation is spread across files and conventions.

WarpKit's pipeline ensures that everything is resolved *before* the page changes. No component renders until its code is loaded. No URL updates until all checks pass. No flicker, no race conditions, no partial states.

---

## The 9 Phases

| Phase | Name | Purpose | Can Cancel? |
|-------|------|---------|-------------|
| 1 | Initiate | Generate navigation ID, capture state ID, set `isNavigating` | No |
| 2 | Match Route | Find matching route, handle redirects and state mismatches | Yes (error) |
| 3 | Check Blockers | Run navigation blockers (unsaved changes dialogs) | Yes (blocked) |
| 4 | Before Navigate | Run `beforeNavigate` hooks (can abort or redirect) | Yes (abort/redirect) |
| 5 | Deactivate Current | Save scroll position for the current page | No |
| 6 | Load & Activate | Load component and layout via lazy import, update PageState | Yes (load error) |
| 7 | On Navigate | Run `onNavigate` hooks (View Transitions) | Yes (cancelled) |
| 8 | Commit | Update browser history (push or replace) and handle scroll | No |
| 9 | After Navigate | Clear `isNavigating`, run `afterNavigate` hooks (fire-and-forget) | No |

Let's walk through each phase in detail.

### Phase 1: Initiate

The pipeline starts by generating a unique navigation ID (a simple incrementing counter) and capturing the current state ID. These two values form the **dual cancellation token**: at every async boundary in the pipeline, WarpKit checks whether either value has changed. If a new navigation started or the app state changed, the current navigation is stale and should be abandoned.

```typescript
const navigationId = ++this.navigationCounter;
this.currentNavigationId = navigationId;
const capturedStateId = this.stateMachine.getStateId();

const isCancelled = (): boolean =>
  navigationId !== this.currentNavigationId
  || capturedStateId !== this.stateMachine.getStateId();
```

This phase also sets `page.isNavigating = true`, which components can use to show loading indicators.

**Why dual cancellation?** A single navigation ID catches rapid navigations (user clicks three links quickly). But it doesn't catch state changes. If the user signs out while a navigation is loading, the state ID changes even though no new `navigate()` call was made. Checking both ensures stale navigations from a previous app state never complete.

### Phase 2: Match Route

The router attempts to match the requested pathname against routes in the current state. This phase has four possible outcomes:

1. **Redirect** --- The path matches a redirect entry. The pipeline restarts with the redirect target. A counter prevents infinite redirect loops (max 10 hops).

2. **Route match** --- The path matches a route pattern. Parameters are extracted from the URL and decoded. The pipeline continues.

3. **State mismatch** --- The path doesn't match any route in the current state, but it matches a route in a *different* state. WarpKit redirects to the current state's default path instead of showing a 404. If there's no default path, a `STATE_MISMATCH` error is produced.

4. **Not found** --- The path doesn't match any route in any state. A `NOT_FOUND` error is produced.

This is the only phase that deals with URL-to-route resolution. By the time Phase 3 runs, we know exactly which route will render.

**Matching strategy:** Static routes are checked first using an O(1) hash map lookup. If no static route matches, parameterized routes are tested in specificity order (highest score first). This means the common case --- navigating to a known static path --- is as fast as a single map lookup.

### Phase 3: Check Blockers

Navigation blockers are checked next. These are functions registered by components to prevent navigation when the user has unsaved changes.

If any blocker returns `true` (block silently) or a string (show confirmation dialog), and the user declines, navigation stops here. The `isNavigating` flag is reset to `false`, and for `pop` navigations (back/forward), the browser URL is restored to its previous value.

**Why blockers run before hooks:** Blockers represent user intent ("I don't want to leave"). This should be checked before any application logic runs. If a `beforeNavigate` hook makes an API call or triggers side effects, you want to avoid that work if the user is going to cancel.

### Phase 4: Before Navigate

All registered `beforeNavigate` hooks run **in parallel**. Each hook receives a `NavigationContext` with `from` and `to` locations, the navigation type, and the direction.

```typescript
warpkit.beforeNavigate(async (context) => {
  console.log(`Navigating from ${context.from?.pathname} to ${context.to.pathname}`);

  // Return void/true to allow
  // Return false to abort
  // Return a string to redirect
  if (shouldRedirect(context)) {
    return '/somewhere-else';
  }
});
```

Hooks run in parallel for performance --- you don't want three independent checks to run sequentially. Conflict resolution follows a simple rule: **abort wins**. If any hook returns `false`, navigation aborts regardless of what other hooks return. If no hook aborts but one returns a redirect string, the redirect is followed.

If a hook throws an error, it's treated as an abort. The error is logged but doesn't crash the app.

### Phase 5: Deactivate Current

Before loading the new page, WarpKit saves the scroll position of the current page. The position is stored in the storage provider, keyed by the current history entry's navigation ID.

This phase is intentionally positioned after blockers and hooks. If navigation was going to be blocked or redirected, there's no need to save scroll position.

### Phase 6: Load & Activate

This is where the new route's component (and layout, if applicable) are loaded via their lazy import functions. This is the main async operation in the pipeline and where network-dependent failures occur.

```typescript
// The lazy import runs here
const module = await route.component();
const component = module.default;
```

If the import fails (network error, missing chunk after a deployment), a `LOAD_FAILED` error is produced. This error is retryable --- calling `warpkit.retry()` re-runs the navigation.

The layout is resolved by the `LayoutManager`, which checks: does the route have its own layout? If not, does the state have one? The layout manager caches loaded layouts by their ID, so navigating between routes that share a layout doesn't trigger a re-import or remount.

After loading, `PageState` is updated with the new location data (path, params, route, app state). This triggers Svelte 5 reactivity, but the component hasn't rendered yet --- that happens when `RouterView` sees the new `loadedComponent`.

### Phase 7: On Navigate

The `onNavigate` hooks run **sequentially** (unlike `beforeNavigate` which runs in parallel). These hooks are designed for the View Transitions API, where you need to call `document.startViewTransition()` and await the transition:

```typescript
warpkit.onNavigate(async (context) => {
  if (document.startViewTransition) {
    await document.startViewTransition(() => {
      // The DOM update happens here
    }).ready;
  }
});
```

Sequential execution is required because View Transitions need to wrap the DOM update, and only one transition can run at a time.

### Phase 8: Commit

The browser's URL and history are updated. For `push` navigations, a new history entry is created. For `replace` navigations, the current entry is overwritten. For `pop` navigations (back/forward), the browser already updated the URL, so this phase is a no-op for the URL.

Scroll handling runs here:
- **Forward navigation:** scroll to top
- **Back/forward navigation:** restore saved scroll position
- **Hash navigation:** scroll to the element with the matching ID
- **Explicit scroll position:** scroll to the specified coordinates
- **`'preserve'`:** don't change scroll at all

### Phase 9: After Navigate

The final phase clears `isNavigating`, runs `afterNavigate` hooks (fire-and-forget, not awaited), and notifies any `onNavigationComplete` listeners.

`afterNavigate` hooks are for side effects that don't affect the navigation: analytics tracking, logging, resetting UI state.

```typescript
warpkit.afterNavigate((context) => {
  analytics.pageView(context.to.pathname);
  document.title = context.to.route.meta.title ?? 'My App';
});
```

These hooks run in parallel and errors are logged but never thrown. Nothing in this phase can cancel or affect the navigation --- it's already complete.

---

## Navigation Cancellation

Any phase with an async boundary checks the cancellation token before continuing. When a new navigation starts, the previous navigation's ID becomes stale, and subsequent `isCancelled()` checks return `true`.

```typescript
// User clicks rapidly:
warpkit.navigate('/page-1');  // Starts pipeline, gets ID 1
warpkit.navigate('/page-2');  // Starts pipeline, gets ID 2 (ID 1 is now stale)
warpkit.navigate('/page-3');  // Starts pipeline, gets ID 3 (IDs 1 and 2 are stale)
// Only /page-3 completes
```

Cancelled navigations produce a `CANCELLED` error, but this is non-visual --- it's normal flow control, not something the user should see. The `RouterView` error snippet only renders for visual errors.

Cancellation is particularly important during the Load phase (Phase 6). If a slow component import is in progress when the user navigates elsewhere, the stale navigation detects cancellation after the import resolves and silently discards the result instead of rendering an outdated page.

---

## Navigation Types

Every navigation has a type that describes why it happened:

| Type | Trigger | Default Direction |
|------|---------|-------------------|
| `push` | `navigate()`, `Link` click | `forward` |
| `pop` | Back/forward button, `back()`, `forward()` | `back` or `forward` |
| `state-change` | `setAppState()`, auth adapter | `forward` |

All three types flow through the same 9-phase pipeline. The type affects behavior in specific phases:

- **Phase 3 (Blockers):** For `pop` navigations, if the blocker rejects, the browser URL is restored (undoing the back/forward).
- **Phase 8 (Commit):** `push` creates a new history entry, `pop` skips URL update (browser already did it), `state-change` creates a new entry.

### Direction Detection

WarpKit tracks a `direction` for each navigation: `'forward'`, `'back'`, or `'replace'`. This is primarily useful for View Transitions, where you might want different animations for forward vs. backward navigation:

```typescript
warpkit.onNavigate(async (context) => {
  const animation = context.direction === 'back' ? 'slide-right' : 'slide-left';
  // Use animation with View Transitions API
});
```

Direction is derived from the navigation type and options:
- `push` without replace = `'forward'`
- `push` with replace = `'replace'`
- `pop` back = `'back'`
- `pop` forward = `'forward'`
- `state-change` = `'forward'`

For `pop` navigations, direction is determined by the browser provider comparing history positions.

---

## Lifecycle Hooks Summary

WarpKit provides three navigation hooks, each with different execution semantics:

| Hook | Phase | Execution | Can Cancel? | Use Case |
|------|-------|-----------|-------------|----------|
| `beforeNavigate` | 4 | Parallel | Yes (abort/redirect) | Auth guards, permission checks |
| `onNavigate` | 7 | Sequential | No | View Transitions |
| `afterNavigate` | 9 | Fire-and-forget | No | Analytics, title updates |

All hooks receive a `NavigationContext`:

```typescript
interface NavigationContext {
  from: ResolvedLocation | null;  // null on initial navigation
  to: ResolvedLocation;
  type: 'push' | 'pop' | 'state-change';
  direction: 'forward' | 'back' | 'replace';
  navigationId: number;
}
```

Register hooks through the WarpKit instance. Each returns an unsubscribe function:

```typescript
const unsubscribe = warpkit.beforeNavigate((ctx) => { /* ... */ });

// Later, clean up:
unsubscribe();
```

---

## Error Recovery

When the pipeline fails, the error is captured in `page.error` and displayed by `RouterView`'s error snippet. The most common recoverable error is `LOAD_FAILED`, which happens when a lazy import fails due to network issues or stale deployment chunks.

```typescript
// Retry the failed navigation
await warpkit.retry();
```

`retry()` re-navigates to the current path with `replace` semantics. It goes through the full pipeline again, including a fresh import attempt. This is the recommended recovery path for `LOAD_FAILED` errors.

For `RENDER_ERROR` (the component loaded but threw during rendering), the error is caught by a `svelte:boundary` inside `RouterView`. The error snippet receives the error and a `retry` function that remounts the component:

```svelte
<RouterView>
  {#snippet error({ error, retry })}
    <div>
      <p>Something went wrong: {error?.message}</p>
      <button onclick={retry}>Retry</button>
    </div>
  {/snippet}
</RouterView>
```

---

## Why a Pipeline?

The pipeline architecture is a deliberate choice. Here's what it gets you compared to the alternatives:

**Predictable order.** Developers can reason about what happens when. Blockers always run before hooks. Components always load before rendering. Scroll restoration always happens after the URL updates. There are no "it depends" answers.

**Single render.** The page changes exactly once, after everything is ready. There's no intermediate state where the old component is still showing but the new URL is in the address bar, or where the new component renders with stale data because loading hasn't finished.

**Centralized error handling.** Errors from any phase produce the same `NavigationError` type. Whether the route doesn't match, the component fails to load, or a hook rejects, error handling follows the same pattern.

**Clean cancellation.** Rapid navigations don't cause memory leaks, double renders, or stale state. The dual cancellation token ensures at-most-one navigation completes per user intent.

The cost is complexity in the implementation, but that complexity is hidden behind a simple API: call `navigate()` or `setAppState()`, and the pipeline handles everything.

---

## Next Steps

The navigation pipeline depends on several pluggable abstractions for browser interaction, storage, and confirmation dialogs. The next chapter, [The Provider System](./05-provider-system.md), explains how these providers work and how to replace them for testing or custom behavior.
