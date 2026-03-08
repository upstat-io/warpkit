# The WarpKit Guide

> A comprehensive guide to building single-page applications with WarpKit — the Svelte 5 SPA framework with state-based routing, type-safe data fetching, schema-driven forms, and real-time WebSocket support.

## Who This Guide Is For

This guide is for frontend developers who want to build robust, production-ready single-page applications with Svelte 5. Whether you're starting a new project or evaluating WarpKit for an existing one, this guide will take you from zero to deep understanding.

**Prerequisites:**
- Familiarity with Svelte (ideally Svelte 5 and runes)
- Basic TypeScript knowledge
- Understanding of SPAs (single-page applications) vs. multi-page apps

## Table of Contents

### Getting Started
1. [**Introduction & Philosophy**](./01-introduction.md) — What WarpKit is, why it exists, and the design principles behind it
2. [**Quick Start**](./02-quick-start.md) — Get a WarpKit app running in 5 minutes

### Core Concepts
3. [**State-Based Routing**](./03-state-based-routing.md) — The core innovation: routes organized by application state
4. [**The Navigation Pipeline**](./04-navigation-pipeline.md) — How every navigation flows through 10 predictable phases
5. [**The Provider System**](./05-provider-system.md) — Pluggable abstractions for browser APIs

### Building Features
6. [**Data Fetching & Caching**](./06-data-fetching.md) — Config-driven data layer with E-Tag caching
7. [**Forms & Validation**](./07-forms.md) — Schema-driven forms with deep proxy binding
8. [**WebSockets & Real-Time**](./08-websockets.md) — Type-safe real-time communication
9. [**Authentication**](./09-authentication.md) — Pluggable auth adapter pattern

### Advanced Topics
10. [**Testing**](./10-testing.md) — Mock providers, assertion helpers, and testing strategies
11. [**Architecture & Design Decisions**](./11-architecture.md) — Why WarpKit is built the way it is

## Package Overview

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

## License

WarpKit is open source software.
