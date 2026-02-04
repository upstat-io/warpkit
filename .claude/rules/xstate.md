# XState v5 Rules

## Stub Actor Pattern

Define stubs for type safety, inject real implementations at runtime:

```typescript
import { setup, fromCallback } from 'xstate';

// Stub - provides type, does nothing
const authActorStub = fromCallback<{ type: 'AUTH_CHANGE'; user: User | null }>(
  () => () => {}
);

// Machine definition with stub
const appMachine = setup({
  actors: {
    listenToAuth: authActorStub
  }
}).createMachine({
  // ...
});

// At runtime, provide real implementation
const realAuthActor = fromCallback(({ sendBack }) => {
  return onAuthStateChanged(auth, (user) => {
    sendBack({ type: 'AUTH_CHANGE', user });
  });
});

const actor = createActor(
  appMachine.provide({
    actors: { listenToAuth: realAuthActor }
  })
);
```

## Actor Placement

**listenToAuth at ROOT level** - Auth listener must be at machine root, not nested in states:

```typescript
// CORRECT
createMachine({
  invoke: {
    src: 'listenToAuth',  // At root - always active
    id: 'authListener'
  },
  initial: 'initializing',
  states: { /* ... */ }
});

// WRONG - loses listener on state transitions
createMachine({
  initial: 'authenticated',
  states: {
    authenticated: {
      invoke: { src: 'listenToAuth' }  // Lost when leaving state!
    }
  }
});
```

## State Design

### Signing Out State

Prevent race conditions with explicit signingOut state:

```typescript
states: {
  authenticated: {
    on: {
      SIGN_OUT: { target: 'signingOut' }
    }
  },
  signingOut: {
    invoke: {
      src: 'signOut',
      onDone: { target: 'unauthenticated' },
      onError: { target: 'authenticated' }
    }
  },
  unauthenticated: {}
}
```

### Context Updates

Use `assign` for context updates:

```typescript
import { assign } from 'xstate';

// In machine config
actions: {
  setUser: assign({
    user: ({ event }) => event.user
  }),
  clearUser: assign({
    user: () => null
  })
}
```

## Guards

```typescript
const machine = setup({
  guards: {
    isAuthenticated: ({ context }) => context.user !== null,
    hasPermission: ({ context }, params: { permission: string }) =>
      context.user?.permissions.includes(params.permission) ?? false
  }
}).createMachine({
  // ...
  on: {
    NAVIGATE: {
      guard: 'isAuthenticated',
      target: 'navigating'
    }
  }
});
```

## Invoke Patterns

### Promise Actor

```typescript
const fetchUser = fromPromise(async ({ input }: { input: { uid: string } }) => {
  const response = await fetch(`/api/users/${input.uid}`);
  return response.json();
});

// In machine
invoke: {
  src: 'fetchUser',
  input: ({ context }) => ({ uid: context.uid }),
  onDone: {
    actions: assign({ user: ({ event }) => event.output })
  },
  onError: {
    target: 'error'
  }
}
```

### Callback Actor

```typescript
const listenToWebSocket = fromCallback(({ sendBack, input }) => {
  const ws = new WebSocket(input.url);

  ws.onmessage = (event) => {
    sendBack({ type: 'MESSAGE', data: JSON.parse(event.data) });
  };

  return () => ws.close();  // Cleanup
});
```

## Testing XState

```typescript
import { createActor } from 'xstate';

test('transitions correctly', async () => {
  const actor = createActor(machine);
  actor.start();

  actor.send({ type: 'LOGIN', user: mockUser });

  await vi.waitFor(() => {
    expect(actor.getSnapshot().value).toBe('authenticated');
  });

  actor.stop();
});
```

## Common Patterns

### Navigation ID for Cancellation

```typescript
context: {
  navigationId: 0
},
actions: {
  incrementNavigationId: assign({
    navigationId: ({ context }) => context.navigationId + 1
  })
},
guards: {
  isCurrentNavigation: ({ context, event }) =>
    event.navigationId === context.navigationId
}
```

### Error Recovery

```typescript
states: {
  error: {
    on: {
      RETRY: { target: 'loading' },
      DISMISS: { target: 'idle' }
    },
    after: {
      5000: { target: 'idle' }  // Auto-dismiss after 5s
    }
  }
}
```
