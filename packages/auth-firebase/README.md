# @warpkit/auth-firebase

Firebase Authentication adapter for WarpKit.

## What is this?

This package provides a WarpKit `AuthAdapter` implementation for Firebase Authentication. It handles all the Firebase-specific logic (initialization, token management, sign-in methods) while letting WarpKit manage your app's state transitions.

**Key benefits:**

- **Isolated Firebase knowledge** - All Firebase SDK code lives in this package, not scattered across your app
- **Token management** - Handles both Firebase ID tokens and AppCheck tokens with proper refresh logic
- **State integration** - Bridges Firebase auth events to WarpKit's state machine
- **Consumer controls enrichment** - You fetch user data from your backend; this package just handles auth

**How it works:**

1. User signs in via Firebase (email/password, Google, etc.)
2. Adapter gets ID token + AppCheck token from Firebase
3. Your `getInitialState` callback uses those tokens to fetch user data from your backend
4. You tell WarpKit what state to transition to (authenticated/unauthenticated)

```
┌─────────────────┐     ┌──────────────────┐
│  Firebase Auth  │────▶│  AuthAdapter     │
│  (sign in)      │     │  (get tokens)    │
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌──────────────────┐      ┌─────────────────┐
           │  Your callback   │      │  WarpKit        │
           │  (getInitialState)│─────▶│  (state change) │
           └────────┬─────────┘      └─────────────────┘
                    │ tokens
                    ▼
           ┌──────────────────┐
           │  Your Backend    │
           │  (verify token,  │
           │   return user)   │
           └──────────────────┘
```

## Installation

```bash
npm install @warpkit/auth-firebase firebase
```

## Quick Start

```typescript
import { FirebaseAuthAdapter } from '@warpkit/auth-firebase';
import { DataClient } from '@warpkit/data';
import type { FirebaseUser } from '@warpkit/auth-firebase';

// 1. Create auth adapter first (needed for token injection)
const authAdapter = new FirebaseAuthAdapter(
	{
		apiKey: 'your-api-key',
		authDomain: 'your-project.firebaseapp.com',
		projectId: 'your-project',
		appId: 'your-app-id',
		recaptchaSiteKey: 'your-recaptcha-key',
		useEmulators: import.meta.env.DEV
	},
	{
		getInitialState // defined below
	}
);

// 2. Create DataClient with token injection
const dataClient = new DataClient({
	baseUrl: '/api',
	onRequest: async (request) => {
		const tokens = await authAdapter.getTokens();
		if (tokens.idToken) {
			request.headers.set('Authorization', `Bearer ${tokens.idToken}`);
		}
		if (tokens.appCheckToken) {
			request.headers.set('X-Firebase-AppCheck', tokens.appCheckToken);
		}
		return request;
	},
	keys: {
		user: { key: 'user', url: '/user' }
		// ... other keys
	}
});

// 3. Auth callback uses DataClient to fetch user
async function getInitialState(user: FirebaseUser | null) {
	if (!user) {
		return { state: 'unauthenticated' };
	}

	// Fetch user from your backend - tokens injected automatically
	const { data: userData } = await dataClient.fetch('user');

	// Set up your user store
	setUserStore(userData);

	return {
		state: 'authenticated',
		stateData: { workspace: userData.defaultWorkspace }
	};
}
```

## Configuration Options

### FirebaseAuthConfig

| Option                | Type      | Required | Description                                          |
| --------------------- | --------- | -------- | ---------------------------------------------------- |
| `apiKey`              | `string`  | Yes      | Firebase project API key                             |
| `authDomain`          | `string`  | Yes      | Firebase auth domain                                 |
| `projectId`           | `string`  | Yes      | Firebase project ID                                  |
| `appId`               | `string`  | Yes      | Firebase app ID                                      |
| `storageBucket`       | `string`  | No       | Firebase storage bucket                              |
| `messagingSenderId`   | `string`  | No       | Firebase messaging sender ID                         |
| `measurementId`       | `string`  | No       | Firebase measurement ID for analytics                |
| `recaptchaSiteKey`    | `string`  | No       | ReCAPTCHA site key for AppCheck                      |
| `appCheckDebugToken`  | `string`  | No       | AppCheck debug token for development                 |
| `useEmulators`        | `boolean` | No       | Enable Firebase emulators                            |
| `authEmulatorUrl`     | `string`  | No       | Auth emulator URL (default: `http://127.0.0.1:9099`) |
| `storageEmulatorHost` | `string`  | No       | Storage emulator host (default: `localhost`)         |
| `storageEmulatorPort` | `number`  | No       | Storage emulator port (default: `9199`)              |

## Usage Examples

### Basic Setup with WarpKit

```typescript
import { WarpKit } from '@warpkit/core';
import { FirebaseAuthAdapter } from '@warpkit/auth-firebase';

const authAdapter = new FirebaseAuthAdapter(
	{
		apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
		authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
		projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
		appId: import.meta.env.VITE_FIREBASE_APP_ID,
		recaptchaSiteKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY,
		useEmulators: import.meta.env.DEV
	},
	{
		getInitialState: async (user) => {
			if (!user) return { state: 'unauthenticated' };

			const userData = await api.getUser(user.uid);
			userStore.set(userData);

			return {
				state: 'authenticated',
				stateData: { workspace: userData.defaultWorkspace }
			};
		}
	}
);

// Use with WarpKit
const warpkit = new WarpKit({
	authAdapter,
	routes
	// ... other config
});
```

### Login Component

```svelte
<script lang="ts">
	import { authAdapter } from '$lib/auth';

	let email = '';
	let password = '';
	let error = '';
	let loading = false;

	async function handleEmailLogin() {
		loading = true;
		error = '';

		try {
			const result = await authAdapter.signInWithEmail(email, password);
			console.log('Signed in:', result.user.email);
			// WarpKit will handle the state transition automatically
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleGoogleLogin() {
		loading = true;
		error = '';

		try {
			const result = await authAdapter.signInWithGoogle();
			if (result.isNewUser) {
				console.log('New user created:', result.user.email);
			}
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={(e) => { e.preventDefault(); handleEmailLogin(); }}>
	<input type="email" bind:value={email} placeholder="Email" />
	<input type="password" bind:value={password} placeholder="Password" />
	<button type="submit" disabled={loading}>Sign In</button>
</form>

<button onclick={handleGoogleLogin} disabled={loading}>Sign in with Google</button>

{#if error}
	<p class="error">{error}</p>
{/if}
```

### Using Data in Components

Once set up, use `useData` in components - tokens are injected automatically:

```svelte
<script lang="ts">
	import { useData } from '@warpkit/data';

	// Tokens injected automatically via onRequest
	const monitors = useData('monitors', { url: '/monitors' });
</script>

{#if monitors.isLoading}
	<Spinner />
{:else if monitors.isError}
	<ErrorMessage error={monitors.error} />
{:else}
	{#each monitors.data as monitor}
		<MonitorCard {monitor} />
	{/each}
{/if}
```

### Handling Auth State Changes

The adapter automatically bridges Firebase auth events to WarpKit. You can also provide custom handling:

```typescript
const authAdapter = new FirebaseAuthAdapter(config, {
	getInitialState: async (user) => {
		// ... initial state logic
	},

	// Optional: custom handling for subsequent auth changes
	getStateChange: async (user) => {
		if (!user) {
			// User signed out - clear stores
			userStore.set(null);
			return { state: 'unauthenticated' };
		}

		// User signed in - refresh data
		const userData = await api.getUser(user.uid);
		userStore.set(userData);

		return {
			state: 'authenticated',
			stateData: { workspace: userData.defaultWorkspace }
		};
	}
});
```

### Sign Out

```typescript
async function handleSignOut() {
	await authAdapter.signOut();
	// WarpKit will transition to unauthenticated state
}
```

### Accessing Current User

```typescript
// Get the current Firebase user (synchronous)
const user = authAdapter.getCurrentUser();

if (user) {
	console.log('Logged in as:', user.email);
	console.log('Email verified:', user.emailVerified);
}

// Refresh user data from Firebase
const refreshedUser = await authAdapter.refreshUser();
```

## Types

### FirebaseUser

```typescript
interface FirebaseUser {
	uid: string;
	email: string | null;
	displayName: string | null;
	photoURL: string | null;
	emailVerified: boolean;
}
```

### FirebaseTokens

```typescript
interface FirebaseTokens {
	idToken: string | null;
	appCheckToken: string | null;
}
```

### FirebaseSignInResult

```typescript
interface FirebaseSignInResult {
	user: FirebaseUser;
	isNewUser: boolean;
}
```

## Advanced: Direct Firebase Access

For advanced use cases, you can access Firebase instances directly:

```typescript
import {
	getFirebaseAuth,
	getFirebaseAppCheck,
	getFirebaseStorage,
	getFirebaseApp,
	isFirebaseInitialized
} from '@warpkit/auth-firebase';

// Get Firebase Auth instance for advanced operations
const auth = getFirebaseAuth();

// Check if Firebase has been initialized
if (isFirebaseInitialized()) {
	const storage = getFirebaseStorage();
	// ... use storage
}
```

## Development with Emulators

Enable Firebase emulators for local development:

```typescript
const authAdapter = new FirebaseAuthAdapter(
	{
		apiKey: 'demo-key',
		authDomain: 'demo-project.firebaseapp.com',
		projectId: 'demo-project',
		appId: 'demo-app-id',
		useEmulators: true,
		authEmulatorUrl: 'http://127.0.0.1:9099',
		storageEmulatorHost: 'localhost',
		storageEmulatorPort: 9199
	},
	{ getInitialState: async () => ({ state: 'unauthenticated' }) }
);
```

Start Firebase emulators:

```bash
firebase emulators:start --only auth,storage
```

## Error Handling

Firebase errors are passed through unchanged. Common error codes:

- `auth/user-not-found` - No user with this email (handled automatically in `signInWithEmail`)
- `auth/wrong-password` - Incorrect password
- `auth/email-already-in-use` - Email already registered
- `auth/weak-password` - Password doesn't meet requirements
- `auth/popup-closed-by-user` - User closed the Google sign-in popup
- `auth/multi-factor-auth-required` - MFA verification needed

```typescript
try {
	await authAdapter.signInWithEmail(email, password);
} catch (error) {
	if (error.code === 'auth/wrong-password') {
		showError('Incorrect password');
	} else if (error.code === 'auth/too-many-requests') {
		showError('Too many attempts. Please try again later.');
	} else {
		showError('Sign in failed. Please try again.');
	}
}
```
