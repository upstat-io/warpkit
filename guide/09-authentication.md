# Authentication

Authentication is the first thing that happens in every SPA behind a login wall. Before the router can navigate to a page, before data can be fetched, before any UI renders, the application needs to answer a fundamental question: who is this user, and what state should the app be in?

WarpKit does not implement authentication itself. It does not know about Firebase, Auth0, Supabase, or your custom JWT backend. Instead, it defines an **AuthAdapter interface** that you implement for your specific auth provider. The adapter tells WarpKit three things:

1. What is the initial app state? (Is there an existing session?)
2. When does the auth state change? (Sign-in, sign-out, token expiration)
3. How do I get tokens? (For authenticated API and WebSocket calls)

This design means you can switch auth providers without changing your app code. It also means you have complete control over what happens during authentication -- fetching user data from your backend, setting up stores, checking onboarding status -- all within your adapter.

## The AuthAdapter Interface

The AuthAdapter interface lives in `@warpkit/types`:

```typescript
interface AuthAdapter<TContext, TAppState extends string, TStateData, TTokens> {
  // Called once during WarpKit startup. Check for existing session,
  // fetch user data, return the initial app state.
  initialize?(context: TContext): Promise<AuthInitResult<TAppState, TStateData>>;

  // Get authentication tokens for API calls and WebSocket connections.
  getTokens(): Promise<TTokens>;

  // Subscribe to auth state changes after initialization.
  // Called when the user signs in, signs out, or the token expires.
  onAuthStateChanged(
    callback: (result: AuthInitResult<TAppState, TStateData> | undefined) => void | Promise<void>
  ): () => void;

  // Optional: sign out the current user.
  signOut?(): Promise<void>;
}

interface AuthInitResult<TAppState extends string, TStateData = unknown> {
  state: TAppState;         // Which app state to enter
  stateData?: TStateData;   // Optional data (e.g., project alias for route defaults)
}
```

The generics give you full type safety:

- **`TContext`**: Whatever WarpKit passes to `initialize()` (typically an event emitter).
- **`TAppState`**: Your app state union (`'authenticated' | 'unauthenticated' | 'onboarding'`).
- **`TStateData`**: Data associated with the state (e.g., `{ projectAlias: string }` for dynamic route defaults).
- **`TTokens`**: The shape of your auth tokens (`{ idToken: string | null }` for simple JWT, or `{ idToken: string | null; appCheckToken: string | null }` for Firebase with AppCheck).

## Writing a Custom AuthAdapter

If you are using a custom JWT backend, Auth0, Supabase, or any provider without a built-in WarpKit adapter, you implement the interface yourself. Here is a complete example for a custom JWT-based backend:

```typescript
import type { AuthAdapter, AuthInitResult } from '@warpkit/types';

type AppState = 'authenticated' | 'unauthenticated' | 'onboarding';
type StateData = { orgAlias: string };
type Tokens = { idToken: string | null };

class JwtAuthAdapter implements AuthAdapter<unknown, AppState, StateData, Tokens> {
  private token: string | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private changeCallback: ((result: AuthInitResult<AppState, StateData> | undefined) => void) | null = null;

  async initialize(): Promise<AuthInitResult<AppState, StateData>> {
    // Check for existing session
    const storedToken = localStorage.getItem('auth_token');

    if (!storedToken) {
      return { state: 'unauthenticated' };
    }

    // Validate the token with your backend
    try {
      const response = await fetch('/api/auth/validate', {
        headers: { Authorization: `Bearer ${storedToken}` }
      });

      if (!response.ok) {
        localStorage.removeItem('auth_token');
        return { state: 'unauthenticated' };
      }

      const userData = await response.json();
      this.token = storedToken;
      this.scheduleRefresh();

      // Determine if user needs onboarding
      if (!userData.isOnboarded) {
        return { state: 'onboarding' };
      }

      return {
        state: 'authenticated',
        stateData: { orgAlias: userData.orgAlias }
      };
    } catch {
      localStorage.removeItem('auth_token');
      return { state: 'unauthenticated' };
    }
  }

  async getTokens(): Promise<Tokens> {
    return { idToken: this.token };
  }

  onAuthStateChanged(
    callback: (result: AuthInitResult<AppState, StateData> | undefined) => void
  ): () => void {
    this.changeCallback = callback;

    // Return unsubscribe function
    return () => {
      this.changeCallback = null;
    };
  }

  async signOut(): Promise<void> {
    this.token = null;
    localStorage.removeItem('auth_token');
    if (this.refreshTimer) clearTimeout(this.refreshTimer);

    // Notify WarpKit of state change
    this.changeCallback?.({ state: 'unauthenticated' });
  }

  // Called by your login component after successful sign-in
  async handleSignIn(token: string, userData: { orgAlias: string; isOnboarded: boolean }): Promise<void> {
    this.token = token;
    localStorage.setItem('auth_token', token);
    this.scheduleRefresh();

    const state = userData.isOnboarded ? 'authenticated' : 'onboarding';
    this.changeCallback?.({
      state,
      stateData: { orgAlias: userData.orgAlias }
    });
  }

  private scheduleRefresh(): void {
    // Refresh token 5 minutes before expiry
    this.refreshTimer = setTimeout(async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          headers: { Authorization: `Bearer ${this.token}` }
        });
        const { token } = await response.json();
        this.token = token;
        localStorage.setItem('auth_token', token);
        this.scheduleRefresh();
      } catch {
        // Refresh failed -- sign out
        await this.signOut();
      }
    }, 25 * 60 * 1000); // 25 minutes
  }
}
```

Key points about this implementation:

1. **`initialize()` is called once** during WarpKit startup, before the app renders. It checks for an existing session, validates it, and returns the initial app state. WarpKit waits for this promise to resolve before showing any content.

2. **`onAuthStateChanged()` is called after initialization.** It receives a callback that you invoke whenever the auth state changes (sign-in, sign-out, token expiration). WarpKit uses this to transition between app states.

3. **`getTokens()` is called by other WarpKit systems** (like the WebSocket client or data fetching layer) when they need authentication tokens for requests.

4. **`signOut()` is optional.** If provided, WarpKit can call it programmatically for sign-out flows.

## Firebase AuthAdapter

WarpKit ships a pre-built adapter for Firebase Authentication in the `@warpkit/auth-firebase` package. It handles all Firebase-specific concerns: auth state detection, token retrieval (including AppCheck), sign-in methods, error mapping, and emulator support.

### Basic Setup

```typescript
import { initializeApp } from 'firebase/app';
import { FirebaseAuthAdapter } from '@warpkit/auth-firebase';

const firebaseApp = initializeApp({
  apiKey: 'your-api-key',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  appId: 'your-app-id'
});

const authAdapter = new FirebaseAuthAdapter(firebaseApp, {
  getInitialState: async (user) => {
    if (!user) {
      return { state: 'unauthenticated' };
    }

    // Fetch your app's user data from your backend
    const userData = await fetchUserFromBackend(user.uid);

    if (!userData.isOnboarded) {
      return { state: 'onboarding' };
    }

    // Set up user store, analytics, etc.
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
    // User signed in via another tab or token refreshed
    const userData = await fetchUserFromBackend(user.uid);
    setUserStore(userData);
    return { state: 'authenticated', stateData: { projectAlias: userData.projectAlias } };
  }
});
```

The `getInitialState` callback is called during initialization. Firebase checks for an existing session (from localStorage) and passes the user object if one exists. You use this to fetch your app's user data and determine the initial state.

The `getStateChange` callback is called on subsequent auth state changes (sign-in from another tab, token refresh, sign-out). Return `undefined` to skip the state transition if you want to handle it manually.

### Sign-In Methods

The Firebase adapter provides sign-in methods for use in your login components:

```svelte
<script lang="ts">
  import type { FirebaseAuthAdapter } from '@warpkit/auth-firebase';

  interface Props {
    authAdapter: FirebaseAuthAdapter;
  }

  let { authAdapter }: Props = $props();
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function handleEmailSignIn(email: string, password: string) {
    loading = true;
    error = null;

    try {
      const { user, isNewUser } = await authAdapter.signInWithEmail(email, password);

      if (isNewUser) {
        // New user created -- set up their account in your backend
        await createUserInBackend(user.uid, user.email);
      }
    } catch (e) {
      // Firebase errors are automatically mapped to user-friendly messages
      error = e instanceof Error ? e.message : 'Sign-in failed';
    } finally {
      loading = false;
    }
  }

  async function handleGoogleSignIn() {
    loading = true;
    error = null;

    try {
      const { user, isNewUser } = await authAdapter.signInWithGoogle();

      if (isNewUser) {
        await createUserInBackend(user.uid, user.email);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Sign-in failed';
    } finally {
      loading = false;
    }
  }
</script>
```

Available sign-in methods:

| Method | Description |
|--------|-------------|
| `signInWithEmail(email, password)` | Email/password sign-in. Auto-creates account if user does not exist. |
| `signInWithGoogle()` | Google OAuth popup sign-in. |
| `createUserWithEmail(email, password)` | Explicitly create a new account. |
| `signUpWithEmail(email, password)` | Alias for `createUserWithEmail`. |
| `signOut()` | Sign out the current user. |

All methods return a `FirebaseSignInResult`:

```typescript
interface FirebaseSignInResult {
  user: FirebaseUser;  // { uid, email, displayName, photoURL, emailVerified }
  isNewUser: boolean;  // true if this is the first sign-in for this account
}
```

### Error Handling

Firebase's native error codes are cryptic (`auth/wrong-password`, `auth/too-many-requests`). The adapter maps these to user-friendly messages automatically:

| Firebase Code | User Message |
|--------------|-------------|
| `auth/wrong-password` | Invalid email or password |
| `auth/user-not-found` | Invalid email or password |
| `auth/invalid-credential` | Invalid email or password |
| `auth/invalid-email` | Invalid email address |
| `auth/email-already-in-use` | An account with this email already exists |
| `auth/weak-password` | Password must be at least 6 characters |
| `auth/too-many-requests` | Too many attempts. Please try again later |
| `auth/network-request-failed` | Network error. Check your connection |
| `auth/popup-closed-by-user` | Sign-in cancelled |
| `auth/popup-blocked` | Sign-in popup was blocked. Please allow popups |

Notice that `auth/wrong-password` and `auth/user-not-found` both return "Invalid email or password". This is intentional -- it prevents user enumeration attacks where an attacker could determine whether an email address has an account.

### Token Management

The adapter provides methods for getting authentication tokens:

```typescript
// Get both ID token and AppCheck token
const tokens = await authAdapter.getTokens();
// tokens.idToken: string | null
// tokens.appCheckToken: string | null

// Get ID token only
const idToken = await authAdapter.getIdToken();
```

These are typically used by your API client or data fetching layer to add authorization headers to requests.

### Emulator Support

For local development, connect to the Firebase Auth emulator:

```typescript
const authAdapter = new FirebaseAuthAdapter(firebaseApp, {
  getInitialState: async (user) => { ... },
  authEmulatorUrl: 'http://127.0.0.1:9099'
});
```

The adapter automatically detects if the emulator is already connected and avoids duplicate connections.

## Atomic Sign-In Flow

Some applications need to do backend work between authentication and session persistence. For example, after a user signs in with Firebase, you might need to create a user record in your backend database, set up their default project, or assign them to an organization. If this backend work fails, you do not want the user to have a persisted session pointing to a half-created account.

WarpKit's Firebase adapter supports this with **persistence control**:

```typescript
async function atomicSignIn(email: string, password: string) {
  // Step 1: Switch to in-memory persistence
  // The session will NOT be saved to localStorage yet
  await authAdapter.useMemoryPersistence();

  // Step 2: Sign in (session is in memory only)
  const { user, isNewUser } = await authAdapter.signInWithEmail(email, password);

  // Step 3: Do backend work (create user, set up org, etc.)
  try {
    if (isNewUser) {
      await createUserInBackend(user.uid, user.email);
      await createDefaultProject(user.uid);
    }
    await enrichUserSession(user.uid);
  } catch (error) {
    // Backend work failed -- sign out to discard the in-memory session
    await authAdapter.signOut();
    throw error;
  }

  // Step 4: Commit the session to localStorage
  // Only now is the session persisted and survives page refresh
  await authAdapter.commitSession();
}
```

The three persistence methods:

| Method | Persistence | Use Case |
|--------|-------------|----------|
| `useMemoryPersistence()` | In-memory only (lost on refresh) | Before atomic sign-in |
| `commitSession()` | Promotes to localStorage | After successful enrichment |
| `useLocalPersistence()` | localStorage (default behavior) | Normal operation |

This pattern ensures that if anything fails between sign-in and session setup, the user does not end up in a broken state with a persisted but incomplete session.

## Auth-Protected Routes

WarpKit's state-based routing provides two layers of auth protection.

### Layer 1: State-Based Routing

Routes are defined per state. When the app is in the `unauthenticated` state, authenticated routes simply do not exist:

```typescript
const routes = createStateRoutes<'authenticated' | 'unauthenticated'>({
  unauthenticated: {
    routes: [
      createRoute({ path: '/login', component: () => import('./Login.svelte') }),
      createRoute({ path: '/signup', component: () => import('./Signup.svelte') })
    ],
    default: '/login'
  },
  authenticated: {
    routes: [
      createRoute({ path: '/dashboard', component: () => import('./Dashboard.svelte') }),
      createRoute({ path: '/settings', component: () => import('./Settings.svelte') })
    ],
    default: '/dashboard'
  }
});
```

When the auth adapter returns `{ state: 'authenticated' }`, the router transitions to the authenticated state. The `/login` and `/signup` routes cease to exist. If a user tries to navigate to `/login` while authenticated, the router falls back to the default path for the current state (`/dashboard`).

This is structurally different from guard-based routing. There is no guard to forget on a new route. There is no race condition where a route loads before the guard fires. The routes simply do not match.

### Layer 2: Guards

For fine-grained access control within an app state (admin-only pages, role-based access), use route guards. Guards are described in the routing chapter of this guide.

## Deep Links

When an unauthenticated user visits `/settings/billing`, you want to redirect them to the login page, let them sign in, and then send them to `/settings/billing` -- not the default dashboard. WarpKit supports this with **intended path**:

```typescript
// Before redirecting to login, save where the user wanted to go
const warpkit = useWarpKit();
warpkit.setIntendedPath('/settings/billing');

// After successful sign-in, check for an intended path
const intended = warpkit.getIntendedPath();
if (intended) {
  warpkit.navigate(intended);
} else {
  warpkit.navigate('/dashboard');
}
```

The intended path is stored in memory and cleared after it is consumed. This pattern works with any auth provider -- you just need to call `setIntendedPath()` before the redirect and `getIntendedPath()` after sign-in.

## Auth Events

WarpKit's event system includes built-in auth events. Use them for cross-component communication that should happen on sign-in or sign-out:

```svelte
<script>
  import { useEvent } from '@upstat/warpkit';

  // Initialize analytics after sign-in
  useEvent('auth:signed-in', ({ userId }) => {
    analytics.identify(userId);
    trackEvent('session_started');
  });

  // Clean up after sign-out
  useEvent('auth:signed-out', () => {
    analytics.reset();
    clearLocalCaches();
  });

  // Refresh tokens when needed
  useEvent('auth:token-refreshed', () => {
    // Token was refreshed -- no action usually needed
    // WarpKit handles passing new tokens to the data layer
  });
</script>
```

The built-in auth events:

| Event | Payload | Fired When |
|-------|---------|------------|
| `auth:signed-in` | `{ userId: string }` | User successfully signs in |
| `auth:signed-out` | `void` | User signs out |
| `auth:token-refreshed` | `void` | Auth token is refreshed |

You can also define custom events via module augmentation:

```typescript
// In your app's type declarations
declare module '@upstat/warpkit' {
  interface WarpKitEventRegistry {
    'auth:mfa-required': { resolver: unknown };
    'auth:email-verified': { userId: string };
  }
}
```

## Compared to Other Frameworks

### NextAuth / Auth.js

NextAuth is designed for server-side session management. Sessions are stored in cookies, validated on the server, and available in server-side rendering. This is the right approach for SSR applications. WarpKit's auth adapter is entirely client-side -- there are no server sessions. The adapter checks localStorage or the auth provider's SDK for existing sessions and manages them in the browser.

### Auth0 SDK

Auth0's client SDKs (`@auth0/auth0-spa-js`) provide a client-side auth solution with built-in token management, silent refresh, and universal login. You could wrap Auth0's SDK in a WarpKit AuthAdapter to get the benefits of both: Auth0's auth infrastructure and WarpKit's state-based routing. The adapter pattern means you are not locked to Auth0 -- you can switch to Firebase, Supabase, or a custom solution later.

### Custom Auth HOCs (React Pattern)

In React applications, authentication is often implemented with higher-order components or context providers that wrap the app. Each route checks the auth context and redirects if needed. This is ad-hoc -- every developer implements it differently, and it is easy to forget a guard on a new route. WarpKit's state-based routing eliminates this class of bug entirely. Routes belong to states, and states are determined by the auth adapter.

### Supabase Auth

Supabase provides a client-side auth SDK similar to Firebase. You could write a `SupabaseAuthAdapter` following the same pattern as the Firebase adapter. The `initialize()` method would check `supabase.auth.getSession()`, `onAuthStateChanged()` would wrap `supabase.auth.onAuthStateChange()`, and `getTokens()` would return the access token. The adapter pattern makes this straightforward.
