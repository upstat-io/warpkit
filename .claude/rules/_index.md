# WarpKit Rules Index

## Rule Files

| File | Description |
|------|-------------|
| `code-quality.md` | Generic types, no @upstat deps, exports, naming |
| `svelte5.md` | Runes, props, snippets, file naming |
| `testing.md` | Browser tests, mocking, XState actor testing |
| `xstate.md` | Stub actors, state design, invoke patterns |

## Quick Reference

### Absolute Rules
1. **NO @upstat/* dependencies** - Zero tolerance
2. **Generic types only** - Consumer provides specifics
3. **Browser tests for components** - jsdom doesn't work with Svelte 5
4. **Fix ALL errors immediately** - No exceptions

### Svelte 5
- Use runes: `$state`, `$derived`, `$effect`
- File naming: `*.svelte.ts` for rune files
- Props: `let { prop } = $props()`
- Events: `onclick` not `on:click`

### XState v5
- Stub actor pattern for dependency injection
- `listenToAuth` at ROOT level
- `signingOut` state prevents race conditions
- Always `actor.stop()` in cleanup

### Testing
- Browser tests: `vitest-browser-svelte` + Playwright
- Use `flushSync()` for synchronous assertions
- `vi.waitFor()` for async state changes
- Mock stores with `vi.hoisted()`
