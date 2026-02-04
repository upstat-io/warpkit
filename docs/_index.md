# WarpKit User Guide

> **A Svelte 5 SPA framework with state-based routing, type-safe data fetching, form management, and real-time capabilities.**

**Status**: Active
**Last Updated**: 2026-01-30
**Target Audience**: Frontend developers building Svelte 5 SPAs

---

## Overview

WarpKit is a modular framework for building single-page applications with Svelte 5. It provides:

- **State-based routing** - Routes organized by application state (authenticated/unauthenticated)
- **Type-safe data layer** - Config-driven data fetching with E-Tag caching
- **Schema-driven forms** - Deep proxy forms with StandardSchema validation
- **Real-time updates** - WebSocket client with automatic reconnection
- **Auth adapter pattern** - Pluggable authentication (Firebase, custom)

WarpKit is designed to be **auth-provider agnostic** and **fully generic** - consumers provide their User type and auth implementation.

## Section Index

| Section | Description |
|---------|-------------|
| [Getting Started](./getting-started.md) | Installation, first app, project setup |
| [Core Concepts](./core-concepts.md) | State machine, navigation pipeline, providers |
| [Routing](./routing.md) | Routes, navigation, guards, layouts |
| [Data Fetching](./data-fetching.md) | DataClient, useData, caching, mutations |
| [Forms](./forms.md) | useForm, validation, array fields |
| [WebSockets](./websockets.md) | SocketClient, rooms, reconnection |
| [Authentication](./authentication.md) | AuthAdapter interface, Firebase adapter |
| [Testing](./testing.md) | Mock WarpKit, test utilities, assertions |
| [API Reference](./api-reference.md) | Complete API documentation |
| [Configuration](./configuration.md) | All configuration options |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Quick Reference

### Packages

| Package | Purpose |
|---------|---------|
| `@warpkit/core` | Router, state machine, events, components |
| `@warpkit/data` | Data fetching, caching, mutations |
| `@warpkit/cache` | MemoryCache, StorageCache, ETagCacheProvider |
| `@warpkit/forms` | Schema-driven form state management |
| `@warpkit/validation` | StandardSchema validation utilities |
| `@warpkit/websocket` | WebSocket client with reconnection |
| `@warpkit/auth-firebase` | Firebase authentication adapter |
| `@warpkit/types` | Shared TypeScript types |

### Key Components

- `WarpKitProvider` - Context provider for WarpKit instance
- `RouterView` - Renders matched route component
- `Link` - Declarative navigation component

### Key Hooks

- `useWarpKit()` - Access WarpKit instance and page state
- `useData(key, config)` - Data fetching with caching
- `useMutation(config)` - Execute mutations
- `useForm(options)` - Form state management
- `useEvent(event, handler)` - Event subscriptions with cleanup

### Critical Rules

1. **Call hooks at component script level** - Not inside functions or conditionals
2. **State-based routing** - Routes are organized by app state, not just URL paths
3. **Never destructure $state** - Use getters to maintain Svelte 5 reactivity
4. **Providers are pluggable** - Browser, storage, and confirm dialogs can be replaced

## Package Structure

```
@warpkit/core          # App state, routing, events, components
@warpkit/data          # Data fetching, caching, E-Tag support
@warpkit/cache         # Cache implementations (Memory, Storage, E-Tag)
@warpkit/forms         # Form state, validation, array operations
@warpkit/validation    # StandardSchema support (Zod, TypeBox)
@warpkit/websocket     # WebSocket client with reconnection
@warpkit/auth-firebase # Firebase Auth adapter
@warpkit/types         # Shared TypeScript types
```

## Related Documentation

- [Svelte 5 Documentation](https://svelte.dev/docs) - Runes, reactivity, components
- [Finite State Machines](https://en.wikipedia.org/wiki/Finite-state_machine) - State machine concepts
- [StandardSchema](https://github.com/standard-schema/standard-schema) - Library-agnostic validation
