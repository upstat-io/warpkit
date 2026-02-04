# Troubleshooting

Common issues and solutions for WarpKit applications.

## Routing Issues

### Navigation doesn't work

**Symptom**: Clicking links or calling `navigate()` does nothing.

**Solutions**:
1. Ensure WarpKit is started:
   ```typescript
   await warpkit.start();
   ```

2. Check if routes are defined for current state:
   ```typescript
   // Route '/settings' must exist in 'authenticated' state
   authenticated: {
     routes: [
       createRoute({ path: '/settings', ... })
     ]
   }
   ```

3. Use `useWarpKit()` inside `WarpKitProvider`:
   ```svelte
   <WarpKitProvider {warpkit}>
     <MyComponent /> <!-- useWarpKit() works here -->
   </WarpKitProvider>
   ```

### Routes redirect unexpectedly

**Symptom**: Navigation redirects to default path instead of target.

**Causes**:
- Target route doesn't exist in current state
- Route guard is redirecting
- Path typo (case-sensitive)

**Debug**:
```typescript
const warpkit = useWarpKit();
console.log('Current state:', warpkit.getState());
console.log('Target path:', '/settings');
// Check if route exists in current state's routes
```

### Parameters not updating

**Symptom**: Route params don't update when navigating between same route with different params.

**Solution**: Use reactive access to params:
```svelte
<script>
  const page = usePage();
  // Reactive - updates when params change
  const userId = $derived(page.params.id);
</script>
```

---

## State Issues

### State doesn't change

**Symptom**: `setState()` is called but app doesn't transition.

**Solutions**:
1. Ensure state is valid:
   ```typescript
   type AppState = 'authenticated' | 'unauthenticated';
   warpkit.setState('authenticated'); // Must match type
   ```

2. Check for errors in console - state transition may fail silently

### Lost state on refresh

**Symptom**: Application state resets on page refresh.

**Solution**: Use auth adapter to restore state from session:
```typescript
const authAdapter = {
  initialize: async () => {
    const session = localStorage.getItem('session');
    if (session) {
      return { state: 'authenticated' };
    }
    return { state: 'unauthenticated' };
  }
};

await warpkit.start({ authAdapter });
```

---

## Svelte 5 Reactivity Issues

### $state not updating in UI

**Symptom**: State changes but UI doesn't update.

**Cause**: Destructuring breaks reactivity in Svelte 5.

**Wrong**:
```typescript
// ❌ Breaks reactivity
const { data, isLoading } = useData('users', { ... });
```

**Correct**:
```typescript
// ✅ Access through object
const users = useData('users', { ... });
// Use users.data, users.isLoading
```

### useForm data not binding

**Symptom**: `bind:value` doesn't update form data.

**Solution**: Use `form.data` directly (it's a proxy):
```svelte
<input bind:value={form.data.email} />
```

### Hook called outside component

**Error**: `useWarpKit` must be called during component initialization.

**Cause**: Hook called inside function or after component init.

**Solution**: Call hooks at script level:
```svelte
<script>
  // ✅ Correct - at script level
  const warpkit = useWarpKit();

  function handleClick() {
    // ❌ Wrong - not during init
    // const warpkit = useWarpKit();

    // ✅ Use the already-created reference
    warpkit.navigate('/dashboard');
  }
</script>
```

---

## Data Fetching Issues

### Data not loading

**Symptom**: `useData` never returns data, stays loading forever.

**Solutions**:
1. Check if `enabled` is true:
   ```typescript
   const data = useData('users', {
     url: '/users',
     enabled: () => !!userId // Must return true
   });
   ```

2. Check network tab for actual request
3. Check console for errors

### Cache not invalidating

**Symptom**: Old data shown after mutation.

**Solutions**:
1. Invalidate after mutation:
   ```typescript
   await client.mutate('/users', { method: 'POST', body: { ... } });
   await client.invalidate('users');
   ```

2. Use event-based invalidation:
   ```typescript
   const users = useData('users', {
     url: '/users',
     invalidateOn: ['user:created']
   });

   // After mutation
   warpkit.events.emit('user:created', { ... });
   ```

### E-Tag not working

**Symptom**: Always getting full response, not 304.

**Causes**:
- Server not returning E-Tag header
- Server not respecting If-None-Match

**Debug**:
```typescript
// Check response headers
const response = await fetch('/api/users');
console.log('ETag:', response.headers.get('etag'));
```

---

## Form Issues

### Validation not running

**Symptom**: Errors don't appear after input.

**Solutions**:
1. Check validation mode:
   ```typescript
   const form = useForm({
     mode: 'blur', // Validates on blur, not change
     onSubmit: async (values) => { ... }
   });
   ```

2. Call `touch()` for blur validation:
   ```svelte
   <input
     bind:value={form.data.email}
     onblur={() => form.touch('email')}
   />
   ```

### Array errors not reindexing

**Symptom**: After removing array item, errors point to wrong index.

**Solution**: Use form's array methods:
```typescript
// ✅ Correct - uses form.remove
form.remove('items', index);

// ❌ Wrong - manual splice doesn't reindex errors
form.data.items.splice(index, 1);
```

### Submit not working

**Symptom**: Form submit does nothing.

**Solutions**:
1. Check for validation errors:
   ```typescript
   console.log('Errors:', form.errors);
   console.log('Is valid:', form.isValid);
   ```

2. Ensure `onSubmit` returns promise:
   ```typescript
   const form = useForm({
     onSubmit: async (values) => { // Must be async
       await api.submit(values);
     }
   });
   ```

---

## WebSocket Issues

### Connection keeps failing

**Symptom**: Connection never establishes or keeps reconnecting.

**Solutions**:
1. Check URL is correct (wss:// for HTTPS, ws:// for HTTP)
2. Check server is running and accepting connections
3. Check for CORS issues

### Messages not received

**Symptom**: Server sends messages but client doesn't receive them.

**Solutions**:
1. Check message format matches envelope:
   ```json
   { "name": "event.name", "data": { ... }, "timestamp": 123 }
   ```

2. Ensure handler is registered before connection:
   ```typescript
   // ✅ Register handler first
   client.on(MyMessage, handleMessage);
   client.connect(); // Then connect
   ```

### Rooms not working

**Symptom**: Not receiving room messages.

**Solutions**:
1. Join room after connection:
   ```typescript
   client.on(Connected, () => {
     client.joinRoom('my-room');
   });
   ```

2. Check server is actually joining client to room

---

## Firebase Auth Issues

### Token is null

**Symptom**: `getIdToken()` returns null.

**Solution**: Ensure user is signed in:
```typescript
const user = authAdapter.getCurrentUser();
if (user) {
  const token = await authAdapter.getIdToken();
}
```

### Session not persisting

**Symptom**: User has to log in again after refresh.

**Solution**: Don't use memory persistence unless intentional:
```typescript
// For normal sign-in, don't call useMemoryPersistence()
await authAdapter.signInWithEmail(email, password);

// For atomic sign-in with enrichment:
await authAdapter.useMemoryPersistence();
await authAdapter.signInWithEmail(email, password);
await enrichUser();
await authAdapter.commitSession(); // Persist session
```

---

## Testing Issues

### Tests hang

**Symptom**: Tests never complete.

**Solutions**:
1. Await all async operations:
   ```typescript
   const warpkit = await createMockWarpKit({ ... });
   await warpkit.navigate('/path');
   ```

2. Use `waitForNavigation`:
   ```typescript
   await waitForNavigation(warpkit);
   ```

### Component doesn't render

**Symptom**: Rendered component is empty in tests.

**Solutions**:
1. Use browser tests for Svelte 5 (jsdom doesn't support `mount()`):
   ```typescript
   // *.browser.spec.ts
   import { render } from 'vitest-browser-svelte';
   ```

2. Wrap with WarpKit context:
   ```typescript
   const { warpkit } = await renderWithWarpKit(MyComponent, { ... });
   ```

---

## Build/TypeScript Issues

### Type errors with DataRegistry

**Error**: Type 'X' is not assignable to DataKey.

**Solution**: Augment the module correctly:
```typescript
declare module '@warpkit/data' {
  interface DataRegistry {
    'users': { data: User[] };
  }
}
```

### Import errors

**Error**: Cannot find module '@warpkit/core'.

**Solutions**:
1. Check package is installed: `npm ls @warpkit/core`
2. Check tsconfig includes node_modules types
3. Restart TypeScript server

---

## Performance Issues

### Slow initial load

**Causes**:
- Too many routes loaded eagerly
- Large components not code-split

**Solutions**:
1. Use lazy loading:
   ```typescript
   component: () => import('./HeavyComponent.svelte')
   ```

2. Reduce initial bundle size

### Memory leaks

**Causes**:
- Event subscriptions not cleaned up
- WarpKit not destroyed

**Solutions**:
1. Clean up on destroy:
   ```typescript
   $effect(() => {
     warpkit.start();
     return () => warpkit.destroy();
   });
   ```

2. Use `useEvent` instead of manual subscription (auto-cleanup)

---

## Getting Help

1. Check the [API Reference](./api-reference.md)
2. Search existing GitHub issues
3. Open a new issue with reproduction steps
