# WarpKit Guide - AI Navigation Index

> Quick reference for AI assistants navigating this documentation.

## Keywords & Topics

| Keyword | Section | Description |
|---------|---------|-------------|
| install, setup, init | [getting-started.md](./getting-started.md) | Installation and project setup |
| route, navigate, push, replace | [routing.md](./routing.md) | Routes and navigation |
| state, machine, transition | [core-concepts.md](./core-concepts.md) | State machine concepts |
| guard, protect, auth check | [routing.md](./routing.md) | Route guards |
| layout, nested | [routing.md](./routing.md) | Layout components |
| fetch, data, query, cache | [data-fetching.md](./data-fetching.md) | Data fetching |
| etag, stale, refresh | [data-fetching.md](./data-fetching.md) | Caching strategies |
| mutation, post, put, delete | [data-fetching.md](./data-fetching.md) | Mutations |
| form, input, validation | [forms.md](./forms.md) | Form management |
| array, push, remove, swap | [forms.md](./forms.md) | Array field operations |
| schema, zod, typebox | [forms.md](./forms.md) | Schema validation |
| websocket, socket, realtime | [websockets.md](./websockets.md) | WebSocket client |
| room, join, subscribe | [websockets.md](./websockets.md) | Room subscriptions |
| reconnect, backoff | [websockets.md](./websockets.md) | Connection management |
| auth, login, firebase | [authentication.md](./authentication.md) | Authentication |
| token, session | [authentication.md](./authentication.md) | Token management |
| test, mock, assert | [testing.md](./testing.md) | Testing utilities |
| provider, browser, storage | [core-concepts.md](./core-concepts.md) | Provider system |
| event, emit, subscribe | [core-concepts.md](./core-concepts.md) | Event system |
| error, debug, fix | [troubleshooting.md](./troubleshooting.md) | Common issues |
| config, option, setting | [configuration.md](./configuration.md) | Configuration |
| api, method, class, hook | [api-reference.md](./api-reference.md) | API reference |

## Common Questions -> Sections

| Question | Section |
|----------|---------|
| "How do I get started?" | [getting-started.md](./getting-started.md) |
| "How does routing work?" | [routing.md](./routing.md) |
| "How do I fetch data?" | [data-fetching.md](./data-fetching.md) |
| "How do I handle forms?" | [forms.md](./forms.md) |
| "How do I add real-time updates?" | [websockets.md](./websockets.md) |
| "How do I add authentication?" | [authentication.md](./authentication.md) |
| "How do I test my app?" | [testing.md](./testing.md) |
| "What's the API for X?" | [api-reference.md](./api-reference.md) |
| "Why isn't X working?" | [troubleshooting.md](./troubleshooting.md) |
| "What are the configuration options?" | [configuration.md](./configuration.md) |

## Section Summaries

### getting-started.md
Installation, project structure, creating routes, first navigation, verifying setup works.

### core-concepts.md
State machine architecture, navigation pipeline (10 phases), provider system (browser, storage, confirm), event emitter, WarpKit context.

### routing.md
createRoute(), createStateRoutes(), navigation methods (navigate, push, replace), route parameters, catch-all routes, guards, layouts, redirects, scroll restoration.

### data-fetching.md
DataClient configuration, useData() hook, useMutation() hook, E-Tag caching, cache invalidation, optimistic updates, error handling.

### forms.md
useForm() hook, deep proxy for bind:value, schema validation (Zod/TypeBox), validation modes, array field operations (push/remove/move/swap), field-centric access.

### websockets.md
SocketClient, type-safe message definitions, room subscriptions, automatic reconnection with backoff, browser offline/online handling, heartbeat keep-alive.

### authentication.md
AuthAdapter interface, Firebase adapter implementation, token management, sign-in methods, session persistence.

### testing.md
createMockWarpKit(), mock providers, renderWithWarpKit(), assertion helpers, event spies.

### api-reference.md
Complete API for all packages: types, classes, hooks, components.

### configuration.md
All configuration options for WarpKit, DataClient, forms, WebSocket client.

### troubleshooting.md
Common errors, debugging tips, migration guides.

## Import Patterns

```typescript
// Core
import { createWarpKit, createRoute, createStateRoutes } from '@warpkit/core';
import { useWarpKit, usePage } from '@warpkit/core';
import { Link, RouterView, WarpKitProvider } from '@warpkit/core';
import { useEvent } from '@warpkit/core';

// Data
import { DataClient, DataClientProvider, useData, useMutation } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';

// Forms
import { useForm } from '@warpkit/forms';

// Validation
import { validate, ValidationError } from '@warpkit/validation';

// WebSocket
import { SocketClient, Connected, JoinRoom } from '@warpkit/websocket';

// Firebase Auth
import { FirebaseAuthAdapter } from '@warpkit/auth-firebase';

// Testing
import { createMockWarpKit, renderWithWarpKit, expectNavigation } from '@warpkit/core/testing';
```
