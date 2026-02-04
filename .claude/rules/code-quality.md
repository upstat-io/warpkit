# Code Quality Rules

## NO @upstat/* Dependencies (ABSOLUTE)

This is a standalone OSS framework. **ZERO** dependencies on @upstat/* allowed.

Check before committing:
```bash
grep -r "@upstat/" src/ packages/
# Must return nothing
```

## Generic Types Only

Consumer provides specifics, framework stays generic:

```typescript
// CORRECT - Generic
interface AppContext<TUserData = unknown> {
  user: WarpKitUser | null;
  userData: TUserData | null;
}

// WRONG - Hardcoded consumer type
interface AppContext {
  user: WarpKitUser | null;
  userData: UpstatUser | null;  // NO!
}
```

## Type Assertions Banned

No `as` casts:

```typescript
// WRONG
const user = data as User;
const element = ref as HTMLInputElement;

// CORRECT
if (isUser(data)) { /* use data */ }
if (ref instanceof HTMLInputElement) { /* use ref */ }
```

## Functions

- Max 20 lines ideal
- Single responsibility
- No boolean flag parameters (split function instead)
- Don't mutate inputs

```typescript
// WRONG
function process(data: Data, shouldValidate: boolean) { }

// CORRECT
function process(data: Data) { }
function processWithValidation(data: Data) { }
```

## Exports

- All public API in `src/index.ts`
- No barrel files (import from source)
- Explicit exports only

```typescript
// src/index.ts
export { WarpKitProvider } from './components/WarpKitProvider.svelte';
export { Link } from './components/Link.svelte';
export { useData } from './hooks.ts';
// etc.
```

## Error Handling

- Never swallow errors silently
- Provide context in error messages
- Use typed errors when possible

```typescript
// WRONG
try { await fetch() } catch { /* ignore */ }

// CORRECT
try {
  await fetch();
} catch (error) {
  throw new NavigationError('Failed to prefetch route', { cause: error });
}
```

## Comments

Good:
- Intent explanation ("Why", not "What")
- Warning about consequences
- Public API documentation

Bad:
- Redundant (code says the same thing)
- Commented-out code (delete it)
- TODO without ticket/issue reference

## Naming

- Components: PascalCase (`RouterView.svelte`)
- Hooks: camelCase starting with `use` (`useData`, `useForm`)
- Types: PascalCase (`NavigationState`, `RouteConfig`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- Files with runes: `*.svelte.ts`

## Before Committing

1. No type errors: `bun run check`
2. No lint errors: `bun run lint`
3. All tests pass: `bun run test && bun run test:browser`
4. No console.log statements
5. No @upstat/* imports
