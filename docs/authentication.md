# Authentication

WarpKit uses an adapter pattern for authentication, allowing you to integrate any auth provider.

## AuthAdapter Interface

Your auth adapter must implement this interface:

```typescript
interface AuthAdapter<TAppState extends string, TStateData = unknown> {
  // Called once during WarpKit.start()
  initialize(context: AuthAdapterContext): Promise<AuthInitResult<TAppState, TStateData>>;

  // Called after initialize() for subsequent auth changes
  onAuthStateChanged(
    callback: (result: AuthInitResult<TAppState, TStateData> | undefined) => void | Promise<void>
  ): () => void;

  // Optional: programmatic sign out
  signOut?(): Promise<void>;
}

interface AuthInitResult<TAppState, TStateData> {
  state: TAppState;           // Initial app state
  stateData?: TStateData;     // Optional state data
}

interface AuthAdapterContext {
  events: EventEmitter;       // WarpKit's event emitter
}
```

## Custom AuthAdapter Example

```typescript
class MyAuthAdapter implements AuthAdapter<'authenticated' | 'unauthenticated', { projectAlias: string }> {
  async initialize(context: AuthAdapterContext) {
    // Check for existing session
    const session = localStorage.getItem('session');

    if (!session) {
      return { state: 'unauthenticated' };
    }

    // Validate and fetch user data
    try {
      const userData = await fetchUserData(session);
      setUserStore(userData);

      return {
        state: 'authenticated',
        stateData: { projectAlias: userData.projectAlias }
      };
    } catch {
      // Session invalid
      localStorage.removeItem('session');
      return { state: 'unauthenticated' };
    }
  }

  onAuthStateChanged(callback) {
    // Subscribe to auth changes
    const unsubscribe = authService.onStateChange(async (user) => {
      if (!user) {
        await callback({ state: 'unauthenticated' });
        return;
      }

      const userData = await fetchUserData(user.id);
      setUserStore(userData);

      await callback({
        state: 'authenticated',
        stateData: { projectAlias: userData.projectAlias }
      });
    });

    return unsubscribe;
  }

  async signOut() {
    await authService.signOut();
    clearUserStore();
  }
}
```

## Using with WarpKit

```typescript
const warpkit = createWarpKit({
  routes,
  initialState: 'unauthenticated'
});

const authAdapter = new MyAuthAdapter();

// Start with auth adapter
await warpkit.start({
  authAdapter
});
```

## Firebase Authentication

WarpKit provides a ready-to-use Firebase adapter.

### Setup

```typescript
import { initializeApp } from 'firebase/app';
import { FirebaseAuthAdapter } from '@warpkit/auth-firebase';

// 1. Create Firebase app
const firebaseApp = initializeApp({
  apiKey: 'your-api-key',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  appId: 'your-app-id'
});

// 2. Create auth adapter
const authAdapter = new FirebaseAuthAdapter(firebaseApp, {
  getInitialState: async (user) => {
    if (!user) {
      return { state: 'unauthenticated' };
    }

    // Fetch your app's user data
    const userData = await fetchUserFromBackend(user.uid);
    setUserStore(userData);

    return {
      state: 'authenticated',
      stateData: { projectAlias: userData.projectAlias }
    };
  },
  getStateChange: async (user) => {
    if (!user) {
      clearUserStore();
      return { state: 'unauthenticated' };
    }

    const userData = await fetchUserFromBackend(user.uid);
    setUserStore(userData);

    return {
      state: 'authenticated',
      stateData: { projectAlias: userData.projectAlias }
    };
  }
});
```

### Sign-In Methods

```typescript
// Email/password
const { user, isNewUser } = await authAdapter.signInWithEmail(email, password);

// Google OAuth
const { user, isNewUser } = await authAdapter.signInWithGoogle();

// Create new user
const { user } = await authAdapter.createUserWithEmail(email, password);
```

### Token Management

```typescript
// Get both ID token and AppCheck token
const { idToken, appCheckToken } = await authAdapter.getTokens();

// Get ID token only
const idToken = await authAdapter.getIdToken();
```

### Atomic Sign-In with Enrichment

For atomic sign-in flows (sign in, enrich user, then persist):

```typescript
// 1. Use memory persistence (session not saved yet)
await authAdapter.useMemoryPersistence();

// 2. Sign in
const { user, isNewUser } = await authAdapter.signInWithEmail(email, password);

// 3. Enrich user in your backend
try {
  await enrichUserInBackend(user.uid);

  // 4. Commit session to localStorage
  await authAdapter.commitSession();
} catch (error) {
  // Enrichment failed - session is NOT persisted
  await authAdapter.signOut();
  throw error;
}
```

### Firebase Error Handling

```typescript
import { FirebaseAuthError, getErrorMessage } from '@warpkit/auth-firebase';

try {
  await authAdapter.signInWithEmail(email, password);
} catch (error) {
  if (error instanceof FirebaseAuthError) {
    // User-friendly error message
    const message = getErrorMessage(error);
    showError(message);
  }
}
```

### Auth Emulator

```typescript
const authAdapter = new FirebaseAuthAdapter(firebaseApp, {
  getInitialState: async (user) => { ... },
  authEmulatorUrl: 'http://127.0.0.1:9099'  // Connect to emulator
});
```

## Auth-Protected Routes

### With Guards

```typescript
const authGuard = {
  name: 'auth',
  check: async (context) => {
    const user = getCurrentUser();
    if (!user) {
      return { redirect: '/login' };
    }
    return { allow: true };
  }
};

createRoute({
  path: '/settings',
  component: () => import('./Settings.svelte'),
  meta: {
    guards: [authGuard]
  }
});
```

### With State-Based Routing

Routes in `authenticated` state are only accessible when in that state:

```typescript
const routes = createStateRoutes<'authenticated' | 'unauthenticated'>({
  authenticated: {
    routes: [
      // These routes are only accessible in authenticated state
      createRoute({ path: '/dashboard', ... }),
      createRoute({ path: '/settings', ... })
    ],
    default: '/dashboard'
  },
  unauthenticated: {
    routes: [
      createRoute({ path: '/login', ... })
    ],
    default: '/login'
  }
});
```

## Auth Events

Emit events for other parts of your app:

```typescript
// In auth adapter
async initialize(context: AuthAdapterContext) {
  const user = await checkSession();

  if (user) {
    context.events.emit('auth:signed-in', { userId: user.id });
    return { state: 'authenticated' };
  }

  return { state: 'unauthenticated' };
}
```

Subscribe in components:

```typescript
import { useEvent } from '@warpkit/core';

useEvent('auth:signed-in', ({ userId }) => {
  console.log('User signed in:', userId);
});

useEvent('auth:signed-out', () => {
  console.log('User signed out');
});
```

## Best Practices

1. **Fetch user data in adapter** - Initialize stores before app renders
2. **Use state data for routing** - Pass project/workspace info for dynamic defaults
3. **Handle token refresh** - Firebase handles this automatically
4. **Atomic sign-in** - Use memory persistence for sign-in + enrichment flows
5. **Error handling** - Map provider errors to user-friendly messages
6. **Clean up on sign-out** - Clear stores, caches, and subscriptions
