# @warpkit/types

Shared TypeScript types for WarpKit packages.

## Installation

```bash
npm install @warpkit/types
```

## Types

### AuthAdapter

Interface for authentication adapters.

```typescript
import type { AuthAdapter, AuthInitResult } from '@warpkit/types';

const adapter: AuthAdapter<AppState, StateData> = {
  initialize: async () => {
    // Return initial auth state
    return { state: 'unauthenticated' };
  },

  onAuthStateChanged: (callback) => {
    // Subscribe to auth changes
    return unsubscribe;
  },

  signOut: async () => {
    // Sign out user
  }
};
```

### AuthInitResult

Result from auth adapter initialization.

```typescript
interface AuthInitResult<TAppState, TStateData> {
  state: TAppState;
  stateData?: TStateData;
}
```

## Usage

These types are re-exported from `@upstat/warpkit` for convenience:

```typescript
import type { AuthAdapter } from '@upstat/warpkit';
```
