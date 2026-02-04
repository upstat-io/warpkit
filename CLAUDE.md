# WarpKit Code Rules

**CRITICAL: Use only Opus 4.5 model.**

## Overview

WarpKit is an open-source SPA framework for Svelte 5 that provides state-based routing, data fetching, forms, and real-time capabilities. Install `@warpkit/core` and optional packages to build type-safe SPAs with minimal boilerplate.

### Key Features

- **State-Based Routing** - Routes organized by application state (authenticated/unauthenticated) with automatic redirects
- **Auth-Agnostic** - Bring your own auth provider (Firebase, Auth0, custom) via adapter pattern
- **Modular Packages** - Use only what you need: data fetching, forms, caching, WebSocket
- **Svelte 5 Native** - Built entirely on runes ($state, $derived, $effect)
- **Type-Safe** - Generic types throughout; consumers provide their own User/Data types
- **StandardSchema Validation** - Works with Zod, TypeBox, Valibot

### Packages

| Package | Description |
|---------|-------------|
| `@warpkit/core` | Router, navigation, state machine, components |
| `@warpkit/data` | Data fetching with caching and mutations |
| `@warpkit/cache` | Memory, localStorage, and E-Tag cache providers |
| `@warpkit/forms` | Schema-driven form state with deep proxy binding |
| `@warpkit/validation` | StandardSchema integration utilities |
| `@warpkit/websocket` | Type-safe WebSocket client with auto-reconnect |
| `@warpkit/auth-firebase` | Firebase Authentication adapter |

**GitHub**: https://github.com/upstat-io/warpkit

## Quick Commands

- `bun install` - Install dependencies
- `bun run test` - Run unit tests (Vitest)
- `bun run test:browser` - Run browser tests (Playwright)
- `bun run check` - TypeScript check
- `bun run lint` - Run linter

## Repository Structure

- `src/` - Core framework code (@warpkit/core)
- `src/core/` - Router, navigation, state machine
- `src/components/` - Link, NavLink, RouterView, WarpKitProvider
- `src/auth/` - Auth adapter interface
- `src/errors/` - Error handling, ErrorOverlay
- `src/events/` - Event system
- `src/providers/` - Browser, storage, confirm providers
- `src/testing/` - Test utilities
- `packages/` - Sub-packages (@warpkit/*)
- `packages/auth-firebase/` - Firebase auth adapter
- `packages/cache/` - Caching (memory, storage, E-Tag)
- `packages/data/` - Data fetching hooks
- `packages/forms/` - Form state management
- `packages/types/` - Shared types
- `packages/validation/` - Validation utilities
- `packages/websocket/` - WebSocket client
- `__browser_tests__/` - Browser-based component tests
- `docs/` - Documentation
- `testing/` - Shared test utilities

## Tech Stack

- **Runtime**: Bun
- **Framework**: Svelte 5 (runes)
- **State Management**: Custom FSM (StateMachine.ts) + Auth Adapter Pattern
- **Testing**: Vitest (unit), Playwright (browser)
- **Validation**: Standard Schema compatible (Zod, TypeBox)

## CRITICAL Rules

1. **NO @upstat/* dependencies** - This is a standalone OSS framework
2. **Generic types only** - Consumer provides User type, auth adapter, etc.
3. **Svelte 5 runes** - Use $state, $derived, $effect (no stores)
4. **Browser tests for components** - jsdom doesn't work with Svelte 5's mount()
5. **Fix ALL errors IMMEDIATELY** - No pre-existing errors excuse

## Dependency Rule (ABSOLUTE)

This framework must have ZERO dependencies on @upstat/* packages. It must remain:
- Auth-provider agnostic (consumer provides adapter)
- User-type agnostic (consumer provides generic type)
- Backend agnostic (works with any API)

## Svelte 5 Patterns

### Runes
```typescript
let count = $state(0);
let doubled = $derived(count * 2);
$effect(() => { console.log(count); });
```

### File Naming
- Files using runes: `*.svelte.ts` (e.g., `PageState.svelte.ts`)
- Test files: `*.svelte.test.ts`

### Component Props
```svelte
<script lang="ts">
  let { href, children }: { href: string; children: Snippet } = $props();
</script>
```

## State Management

WarpKit uses a custom finite state machine (`src/core/StateMachine.ts`) with the Auth Adapter pattern:

```typescript
// StateMachine manages app states (e.g., 'unauthenticated', 'authenticated')
const machine = new StateMachine<AppState>('unauthenticated');

// Subscribe to state changes
const unsubscribe = machine.subscribe((state) => {
  console.log('New state:', state.current);
});

// Transition states
machine.setState('authenticated');
```

### Auth Adapter Pattern
```typescript
// Consumer provides their own auth implementation
const authAdapter: AuthAdapter<MyUser> = {
  initialize: () => Promise.resolve({ authenticated: false }),
  onAuthStateChanged: (callback) => { /* ... */ },
  signOut: () => Promise.resolve(),
  // ...
};
```

## Testing Rules

### Browser Tests Required
```typescript
// *.svelte.test.ts
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';

test('component renders', async () => {
  render(MyComponent, { props: { value: 'test' } });
  await expect.element(page.getByText('test')).toBeVisible();
});
```

### Input Updates
```typescript
const input = page.getByRole('textbox');
await input.fill('new value');
// Or for reactive updates:
input.element().value = 'new value';
input.element().dispatchEvent(new InputEvent('input', { bubbles: true }));
```

## Quick Reference

- Main export: `src/index.ts`
- Router: `src/core/WarpKit.svelte.ts`
- State machine: `src/core/StateMachine.ts`
- Navigation: `src/core/Navigator.ts`

## Before Committing

1. `bun run check` - No type errors
2. `bun run test` - All unit tests pass
3. `bun run test:browser` - All browser tests pass
4. `bun run lint` - No lint errors
