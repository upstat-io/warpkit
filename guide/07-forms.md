# Forms & Validation

Every non-trivial application has forms. Login forms, settings forms, multi-step wizards, dynamic lists of line items. And every application eventually discovers that forms are the most deceptively complex UI pattern in web development.

The difficulty is not rendering an `<input>`. The difficulty is everything around it: keeping form state in sync with inputs, validating data at the right time, managing nested objects and dynamic arrays, tracking which fields the user has touched, preventing double-submits, showing errors without being annoying, and clearing errors the moment the user fixes the problem.

Most form libraries solve this by creating an imperative API. You call `setFieldValue('user.address.street', 'Main St')` to update a nested field. You call `setFieldTouched('email', true)` to mark a field as touched. You register fields with refs. You build path strings by hand.

WarpKit takes a fundamentally different approach.

## The Core Insight: Deep Proxy + Svelte 5 Binding

Svelte 5's `bind:value` directive creates a two-way binding between an input element and a JavaScript variable. When the user types into the input, Svelte sets the variable. When the variable changes, Svelte updates the input. This is the foundation of reactive forms in Svelte.

The problem is that `bind:value` expects a mutable property on an object. If your form data is a plain object, Svelte can bind to it -- but your form engine has no way to know that a field changed. It cannot trigger validation, update dirty tracking, or mark the field as touched.

WarpKit solves this with a **deep JavaScript Proxy**. When you create a form with `useForm()`, WarpKit wraps your form data in a Proxy. This Proxy intercepts every property access and every property assignment, at any depth of nesting. When Svelte's `bind:value` writes to `form.data.user.address.street`, the Proxy's `set` trap fires with the full path `user.address.street` and the new value. The form engine then updates its internal state, marks the field dirty, and triggers validation if configured.

This means you never need to call `form.setFieldValue()` for bound inputs. You just use `bind:value` and everything works. The Proxy and Svelte 5's reactivity system cooperate naturally.

Here is what it looks like in practice:

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';

  const form = useForm({
    initialValues: {
      user: {
        name: '',
        address: {
          street: '',
          city: '',
          zip: ''
        }
      }
    },
    onSubmit: async (values) => {
      await saveAddress(values);
    }
  });
</script>

<form onsubmit={form.submit}>
  <input bind:value={form.data.user.name} />
  <input bind:value={form.data.user.address.street} />
  <input bind:value={form.data.user.address.city} />
  <input bind:value={form.data.user.address.zip} />
  <button type="submit">Save</button>
</form>
```

No path strings. No `register()` calls. No `setFieldValue()`. You bind to nested properties directly, and the form engine tracks everything behind the scenes.

### How the Proxy Works Under the Hood

When you access `form.data`, you get the top-level Proxy. Every property access on that Proxy returns a new Proxy wrapping the nested object:

1. `form.data` returns a Proxy wrapping `{ user: { name: '', address: { ... } } }`
2. `form.data.user` returns a Proxy wrapping `{ name: '', address: { ... } }`
3. `form.data.user.address` returns a Proxy wrapping `{ street: '', city: '', zip: '' }`
4. `form.data.user.address.street` returns the string `''` (primitives are not proxied)

When `bind:value` sets `form.data.user.address.street = 'Main St'`, the Proxy's `set` trap fires. The trap knows the full dot-notation path (`user.address.street`) because each nested Proxy tracks its parent path. The form engine's `onSet` callback receives this path and the new value, and uses it to:

- Update dirty tracking (compare to initial value at that path)
- Mark the field as touched (if using `'touched'` validation mode)
- Trigger validation (if the current mode says to validate on change)
- Run warning validators (always run, regardless of mode)

This is fundamentally different from how other frameworks handle forms:

- **React Hook Form** uses `register()` to attach refs to inputs and reads values via the DOM. The form engine does not know about changes until the registered input fires an event.
- **Formik** provides an imperative `setFieldValue()` API. You cannot simply assign to a property; you must call a function.
- **Svelte Superforms** is built specifically for SvelteKit's form actions and server-side validation. It does not work as a standalone client-side form engine.

WarpKit's deep Proxy is the most natural approach for Svelte 5 because it works directly with `bind:value` -- the idiom that Svelte developers already know.

## Basic Usage

The simplest possible form needs three things: initial values, a submit handler, and a template.

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';

  const form = useForm({
    initialValues: {
      email: '',
      password: ''
    },
    onSubmit: async (values) => {
      await login(values.email, values.password);
    }
  });
</script>

<form onsubmit={form.submit}>
  <div>
    <label for="email">Email</label>
    <input id="email" type="email" bind:value={form.data.email} />
  </div>
  <div>
    <label for="password">Password</label>
    <input id="password" type="password" bind:value={form.data.password} />
  </div>
  <button type="submit" disabled={form.isSubmitting}>
    {form.isSubmitting ? 'Signing in...' : 'Sign In'}
  </button>
</form>
```

The `form.submit` method can be passed directly as the `onsubmit` handler. It calls `event.preventDefault()` automatically, runs validation (if a schema is provided), and calls your `onSubmit` callback if validation passes. While `onSubmit` is executing, `form.isSubmitting` is `true`, which you can use to disable the submit button and show a loading state.

If `onSubmit` throws an error, the error is captured in `form.submitError` so you can display it:

```svelte
{#if form.submitError}
  <div class="error">{form.submitError.message}</div>
{/if}
```

## Schema Validation

WarpKit validates forms using the [StandardSchema](https://github.com/standard-schema/standard-schema) specification. StandardSchema is a universal interface for JavaScript validation libraries. Any library that implements StandardSchema can be used with WarpKit forms. This means you are never locked into a specific validation library.

The two most popular StandardSchema-compatible libraries are **TypeBox** and **Zod**.

### TypeBox

TypeBox is a JSON Schema type builder that produces both TypeScript types and runtime validation schemas. It is fast, lightweight, and produces schemas that double as JSON Schema.

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const schema = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
    age: Type.Number({ minimum: 18 })
  });

  const form = useForm({
    initialValues: { email: '', password: '', age: 0 },
    schema,
    onSubmit: async (values) => {
      // values is typed: { email: string; password: string; age: number }
      await register(values);
    }
  });
</script>
```

TypeBox also supports default values, which WarpKit can extract automatically:

```typescript
const schema = Type.Object({
  name: Type.String({ default: '' }),
  count: Type.Number({ default: 0 }),
  enabled: Type.Boolean({ default: true })
});

// Defaults come from the schema -- no initialValues needed
const form = useForm({
  initialValues: {},
  schema,
  onSubmit: async (values) => { ... }
});
// form.data.name === ''
// form.data.count === 0
// form.data.enabled === true
```

If you provide both `initialValues` and schema defaults, your initial values take precedence. The schema defaults fill in any gaps.

> **Note:** Automatic default extraction only works with TypeBox schemas. Other StandardSchema libraries (Zod, Valibot) store defaults differently and are not supported for auto-extraction. For those libraries, always provide explicit `initialValues`.

### Zod

Zod is a TypeScript-first schema validation library with a chainable API:

```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.number().min(18, 'You must be at least 18')
});

const form = useForm({
  initialValues: { email: '', password: '', age: 0 },
  schema,
  onSubmit: async (values) => { ... }
});
```

Because WarpKit uses StandardSchema, you could also use Valibot, ArkType, or any other conforming library. The form engine does not know or care which validation library produced the schema. It only interacts with the `~standard` protocol that StandardSchema defines.

## Validation Modes

Validation timing is one of the most important UX decisions in form design. Validate too early and you annoy the user with errors before they finish typing. Validate too late and they do not discover problems until they submit. WarpKit provides five validation modes to let you choose the right behavior for your use case.

### mode (When to Start Validating)

| Mode | Validates On | Best For |
|------|-------------|----------|
| `'blur'` (default) | Field loses focus | Most forms -- least disruptive |
| `'change'` | Every keystroke/change | Real-time feedback (search filters, live previews) |
| `'submit'` | Form submission only | Simple forms, multi-step wizards |
| `'touched'` | After first touch, then on change | Progressive disclosure |

**`'blur'`** is the default because it strikes the best balance for most forms. The user can type without being interrupted by errors. When they tab to the next field (triggering blur), the field they left is validated. If there is an error, they see it. If they go back and fix it, the error clears immediately (thanks to `revalidateMode`).

**`'change'`** validates on every keystroke. This is appropriate for search inputs, filter forms, or any case where you want instant feedback. For most text forms, it is too aggressive -- showing "email is invalid" while the user is still typing their email address is a poor experience.

**`'submit'`** only validates when the user clicks Submit. All errors appear at once. This works well for short forms or wizard steps where you want the user to fill everything out before seeing validation feedback.

**`'touched'`** is a progressive approach: fields are not validated until the user has interacted with them (touched = focused and then blurred). After a field has been touched, it validates on every subsequent change. This prevents errors from appearing on fields the user has not reached yet.

### revalidateMode (When to Clear Errors)

After a field has shown an error, when should it revalidate?

| Revalidate Mode | Revalidates On | Effect |
|----------------|---------------|--------|
| `'change'` (default) | Every keystroke | Errors clear immediately as the user types the fix |
| `'blur'` | Field loses focus | Errors persist until user leaves the field |

**`'change'`** is the default revalidation mode because it creates the best user experience. Imagine this flow:

1. User types an invalid email and tabs to the next field (blur triggers validation)
2. Error appears: "Please enter a valid email"
3. User goes back and starts fixing the email
4. As they type, the error clears the moment the email becomes valid

With `revalidateMode: 'blur'`, the error would persist while the user is fixing it, which feels sluggish.

**The recommended combination is `mode: 'blur'` + `revalidateMode: 'change'`** -- which is the default. Show errors when the user leaves a field, clear them immediately as the user fixes the problem.

```typescript
const form = useForm({
  initialValues: { email: '', name: '' },
  schema,
  mode: 'blur',           // default -- validate on blur
  revalidateMode: 'change', // default -- clear errors on keystroke
  onSubmit: async (values) => { ... }
});
```

### Triggering Touch Manually

For the validation modes that depend on touch state (`'blur'` and `'touched'`), you need to tell the form when a field is touched. Use the `form.touch()` method in the `onblur` handler:

```svelte
<input
  bind:value={form.data.email}
  onblur={() => form.touch('email')}
/>
{#if form.errors.email}
  <span class="error">{form.errors.email}</span>
{/if}
```

This pattern -- bind the value, touch on blur, show errors conditionally -- is the standard way to build form fields in WarpKit.

## Form State

The object returned by `useForm()` provides reactive getters for all form state. Because these are getters backed by Svelte 5 `$state` and `$derived` runes, they update automatically in your template.

### Data and Errors

| Property | Type | Description |
|----------|------|-------------|
| `data` | `T` (proxied) | Current form values. Supports `bind:value` on nested paths. |
| `errors` | `Record<string, string>` | Map of field paths to error messages. |
| `warnings` | `Record<string, string>` | Map of field paths to warning messages. |
| `touched` | `Record<string, boolean>` | Map of field paths to whether they have been focused and blurred. |
| `dirty` | `Record<string, boolean>` | Map of field paths to whether they differ from initial values. |

### Status Flags

| Property | Type | Description |
|----------|------|-------------|
| `isValid` | `boolean` | `true` if there are no validation errors. |
| `isDirty` | `boolean` | `true` if any field differs from its initial value. |
| `isSubmitting` | `boolean` | `true` while the `onSubmit` callback is executing. |
| `isValidating` | `boolean` | `true` while validation is running. |
| `isSubmitted` | `boolean` | `true` after the form has been submitted at least once. |
| `submitError` | `Error \| null` | The error thrown by `onSubmit`, or `null`. |
| `submitCount` | `number` | How many times `submit()` has been called. |

### Example: Full Form with State Display

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const schema = Type.Object({
    name: Type.String({ minLength: 1 }),
    email: Type.String({ format: 'email' })
  });

  const form = useForm({
    initialValues: { name: '', email: '' },
    schema,
    onSubmit: async (values) => {
      await saveProfile(values);
    }
  });
</script>

<form onsubmit={form.submit}>
  <div>
    <input bind:value={form.data.name} onblur={() => form.touch('name')} />
    {#if form.errors.name}
      <span class="error">{form.errors.name}</span>
    {/if}
  </div>

  <div>
    <input bind:value={form.data.email} onblur={() => form.touch('email')} />
    {#if form.errors.email}
      <span class="error">{form.errors.email}</span>
    {/if}
  </div>

  {#if form.submitError}
    <div class="error">{form.submitError.message}</div>
  {/if}

  <button type="submit" disabled={form.isSubmitting || !form.isValid}>
    {form.isSubmitting ? 'Saving...' : 'Save Profile'}
  </button>

  <button type="button" onclick={() => form.reset()} disabled={!form.isDirty}>
    Reset
  </button>
</form>
```

## Array Fields

Dynamic lists -- line items on an invoice, tags on a blog post, addresses in a contact form -- are one of the hardest parts of form management. You need to add items, remove items, reorder items, and validate each one. When you remove an item from the middle of the list, the error keys for all subsequent items need to shift down by one.

WarpKit handles all of this automatically.

### Basic Array Usage

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';

  const form = useForm({
    initialValues: {
      items: [{ name: '', quantity: 1 }]
    },
    onSubmit: async (values) => {
      await saveOrder(values.items);
    }
  });
</script>

{#each form.data.items as item, index}
  <div class="item-row">
    <input
      bind:value={form.data.items[index].name}
      placeholder="Item name"
    />
    <input
      type="number"
      bind:value={form.data.items[index].quantity}
    />
    <button type="button" onclick={() => form.remove('items', index)}>
      Remove
    </button>
  </div>
{/each}

<button type="button" onclick={() => form.push('items', { name: '', quantity: 1 })}>
  Add Item
</button>
```

Notice that you bind to `form.data.items[index].name`, not to the local `item` variable from the `#each` block. This is important. The `item` variable is a snapshot from the iteration; binding to it would not route through the Proxy. Always bind through `form.data` to ensure the form engine tracks changes.

### Array Operations

WarpKit provides five operations for manipulating array fields:

| Method | Signature | Description |
|--------|-----------|-------------|
| `push` | `push(field: string, value: unknown)` | Append a value to the end of the array. |
| `remove` | `remove(field: string, index: number)` | Remove the item at the given index. |
| `insert` | `insert(field: string, index: number, value: unknown)` | Insert a value at a specific index. |
| `move` | `move(field: string, from: number, to: number)` | Move an item from one index to another. |
| `swap` | `swap(field: string, indexA: number, indexB: number)` | Swap two items by index. |

All array operations work on dot-notation paths, so they support nested arrays:

```typescript
// Top-level array
form.push('items', { name: '' });

// Nested array: order.lineItems
form.push('order.lineItems', { product: '', qty: 1 });

// Remove third line item
form.remove('order.lineItems', 2);
```

### Automatic Error Reindexing

When you remove an item from an array, WarpKit automatically reindexes all error keys. For example, if you have three items with errors:

```
items.0.name → "Required"
items.1.name → (no error)
items.2.name → "Too short"
```

And you remove item at index 0, the errors become:

```
items.0.name → (no error)   // was items.1.name
items.1.name → "Too short"  // was items.2.name
```

The error that was at `items.2.name` is now at `items.1.name` because every item above the removed index shifted down. The error at `items.0.name` (the removed item) is gone. This happens automatically -- you do not need to manage it.

The same reindexing applies to `insert()`, which shifts error keys up above the insertion point.

## Custom Validators

Schema validation covers most cases, but sometimes you need logic that a schema cannot express. Cross-field validation (does the confirmation password match?), async validation (is this username taken?), or business logic validation (is this date in the billing period?).

WarpKit supports custom validators on a per-field basis. They run after schema validation, so they only fire if the schema passes first.

```typescript
const form = useForm({
  initialValues: {
    password: '',
    confirmPassword: '',
    username: ''
  },
  schema,
  validators: {
    confirmPassword: (value, allValues) => {
      if (value !== allValues.password) {
        return 'Passwords do not match';
      }
      return undefined; // No error
    },
    username: async (value) => {
      // Async validation: check server
      const taken = await checkUsernameAvailable(value);
      if (!taken) {
        return 'This username is already taken';
      }
      return undefined;
    }
  },
  onSubmit: async (values) => { ... }
});
```

Validators receive two arguments: the current field value and all form values (for cross-field validation). They return a string error message if invalid, or `undefined` if valid. Validators can be synchronous or asynchronous.

## Warnings

Warnings are like validation errors, but they do not block form submission. Use them for non-critical suggestions: "Consider using a stronger password", "This email looks like a personal address", "This date is in the past".

```typescript
const form = useForm({
  initialValues: { email: '', password: '' },
  schema,
  warners: {
    email: (value) => {
      if (value && !value.endsWith('@company.com')) {
        return 'Consider using your company email address';
      }
      return undefined;
    },
    password: (value) => {
      if (value && value.length < 12) {
        return 'A longer password would be more secure';
      }
      return undefined;
    }
  },
  onSubmit: async (values) => { ... }
});
```

Warnings are always run on change, regardless of validation mode. They are stored in `form.warnings` and displayed the same way as errors:

```svelte
{#if form.warnings.email}
  <span class="warning">{form.warnings.email}</span>
{/if}
```

## Error Debouncing

When `mode` is `'change'`, errors appear on every keystroke. If the user types quickly, the error might flicker -- appearing and disappearing rapidly as each character triggers validation. The `delayError` option prevents this by debouncing error display:

```typescript
const form = useForm({
  initialValues: { email: '' },
  schema,
  mode: 'change',
  delayError: 300, // Wait 300ms before showing errors
  onSubmit: async (values) => { ... }
});
```

With `delayError: 300`, the form engine waits 300 milliseconds after the last change before displaying a new error. If the user keeps typing, the timer resets. Errors are **cleared immediately** (no delay) so the user gets instant feedback when they fix a problem.

This is particularly useful for search or filter forms where you want real-time validation without the visual noise of flickering error messages.

## Field-Centric Access

When building reusable field components, it is useful to have a self-contained view of a single field's state. The `form.field()` method returns a `FieldState` object for a specific path:

```typescript
const emailField = form.field<string>('email');

// All state for this field, as reactive getters:
emailField.value;    // Current value
emailField.error;    // Error message or undefined
emailField.warning;  // Warning message or undefined
emailField.touched;  // Whether the field has been touched
emailField.dirty;    // Whether the value differs from initial
```

This is especially useful when you create a reusable `FormField` component:

```svelte
<!-- FormField.svelte -->
<script lang="ts">
  import type { FieldState } from '@warpkit/forms';

  interface Props {
    field: FieldState<string>;
    label: string;
    onblur?: () => void;
  }

  let { field, label, onblur }: Props = $props();
</script>

<div class="form-field">
  <label>{label}</label>
  <input
    value={field.value}
    oninput={(e) => { /* update via parent form.data binding */ }}
    {onblur}
    class:error={field.error}
  />
  {#if field.error}
    <span class="error">{field.error}</span>
  {/if}
  {#if field.warning}
    <span class="warning">{field.warning}</span>
  {/if}
</div>
```

## Form Operations

### submit(event?: Event)

Validates the form and calls `onSubmit` if valid. Automatically calls `event.preventDefault()` if an event is passed. Safe to use directly as an event handler: `<form onsubmit={form.submit}>`.

### reset(newValues?: Partial<T>)

Resets the form to its initial values (or merged with `newValues` if provided). Clears all errors, warnings, touched state, and dirty state. Resets `isSubmitting`, `isValidating`, `isSubmitted`, `submitError`, and `submitCount`.

```typescript
// Reset to original initial values
form.reset();

// Reset with some fields overridden
form.reset({ email: 'new@example.com' });
```

### validate(): Promise<boolean>

Validates the entire form (schema + custom validators) and returns `true` if valid. This is called automatically by `submit()` but you can call it manually if you need to check validity without submitting.

### validateField(field: string): Promise<boolean>

Validates a single field and returns `true` if valid.

### setField<K>(field: K, value: T[K])

Sets a field value programmatically. Use this when you need to update a value outside of `bind:value` (for example, in response to a button click or an API response).

### setError(field: string, message: string | null)

Sets or clears an error message for a field. Pass `null` to clear the error.

### setWarning(field: string, message: string | null)

Sets or clears a warning message for a field.

### touch(field: string)

Marks a field as touched and triggers blur validation if applicable.

### clearErrors()

Clears all errors and warnings and cancels any pending error debounce timers.

### cleanup()

Cleans up internal timers (error debounce timers). Call this when the component unmounts to prevent memory leaks:

```svelte
<script>
  import { onDestroy } from 'svelte';
  const form = useForm({ ... });
  onDestroy(() => form.cleanup());
</script>
```

## Complete Example: Registration Form

Here is a full registration form showing schema validation, custom validators, warnings, array fields, error display, and submit handling:

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';
  import { onDestroy } from 'svelte';

  const schema = Type.Object({
    name: Type.String({ minLength: 1 }),
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
    confirmPassword: Type.String({ minLength: 1 }),
    tags: Type.Array(Type.Object({
      label: Type.String({ minLength: 1 })
    }))
  });

  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      tags: [{ label: '' }]
    },
    schema,
    mode: 'blur',
    revalidateMode: 'change',
    validators: {
      confirmPassword: (value, values) => {
        if (value !== values.password) {
          return 'Passwords do not match';
        }
        return undefined;
      }
    },
    warners: {
      password: (value) => {
        if (value && value.length < 12) {
          return 'Consider using a longer password for better security';
        }
        return undefined;
      }
    },
    onSubmit: async (values) => {
      const { confirmPassword, ...data } = values;
      await api.register(data);
    }
  });

  onDestroy(() => form.cleanup());
</script>

<form onsubmit={form.submit}>
  <div>
    <label for="name">Name</label>
    <input id="name" bind:value={form.data.name} onblur={() => form.touch('name')} />
    {#if form.errors.name}<span class="error">{form.errors.name}</span>{/if}
  </div>

  <div>
    <label for="email">Email</label>
    <input id="email" type="email" bind:value={form.data.email} onblur={() => form.touch('email')} />
    {#if form.errors.email}<span class="error">{form.errors.email}</span>{/if}
  </div>

  <div>
    <label for="password">Password</label>
    <input id="password" type="password" bind:value={form.data.password} onblur={() => form.touch('password')} />
    {#if form.errors.password}<span class="error">{form.errors.password}</span>{/if}
    {#if form.warnings.password}<span class="warning">{form.warnings.password}</span>{/if}
  </div>

  <div>
    <label for="confirmPassword">Confirm Password</label>
    <input id="confirmPassword" type="password" bind:value={form.data.confirmPassword} onblur={() => form.touch('confirmPassword')} />
    {#if form.errors.confirmPassword}<span class="error">{form.errors.confirmPassword}</span>{/if}
  </div>

  <fieldset>
    <legend>Tags</legend>
    {#each form.data.tags as tag, index}
      <div class="tag-row">
        <input
          bind:value={form.data.tags[index].label}
          placeholder="Tag name"
          onblur={() => form.touch(`tags.${index}.label`)}
        />
        {#if form.errors[`tags.${index}.label`]}
          <span class="error">{form.errors[`tags.${index}.label`]}</span>
        {/if}
        <button type="button" onclick={() => form.remove('tags', index)}>Remove</button>
      </div>
    {/each}
    <button type="button" onclick={() => form.push('tags', { label: '' })}>Add Tag</button>
  </fieldset>

  {#if form.submitError}
    <div class="error">{form.submitError.message}</div>
  {/if}

  <button type="submit" disabled={form.isSubmitting}>
    {form.isSubmitting ? 'Creating Account...' : 'Create Account'}
  </button>
</form>
```

## Testing Forms

WarpKit provides testing helpers in `@warpkit/forms/testing`:

```typescript
import { waitForFormSubmit, waitForFormValidation, setFormValues, assertFieldError } from '@warpkit/forms/testing';

// Set multiple values at once
setFormValues(form, { name: 'John', email: 'john@example.com' });

// Wait for async submission to complete
await form.submit();
await waitForFormSubmit(form);

// Wait for async validation to complete
await form.validateField('email');
await waitForFormValidation(form);

// Assert field errors
assertFieldError(form, 'name', 'Required');
assertFieldError(form, 'email', undefined); // no error expected
```

## Compared to Other Frameworks

### React Hook Form

React Hook Form uses `register()` to attach refs to DOM inputs. It reads values from the DOM rather than maintaining a JavaScript data model. This is efficient for simple flat forms, but becomes cumbersome with deeply nested data. You end up building path strings like `"user.addresses.0.street"` by hand for `register()`. WarpKit's deep Proxy lets you bind directly to `form.data.user.addresses[0].street` -- the path is implicit.

### Formik

Formik provides `setFieldValue()`, `setFieldTouched()`, and other imperative methods. Every value change goes through a function call. With WarpKit, `bind:value` writes directly to the Proxy, which is more natural in Svelte. Formik also does not have built-in array field operations with automatic error reindexing.

### Svelte Superforms

Svelte Superforms is excellent but is designed specifically for SvelteKit's form actions and server-side validation. It does not work as a standalone client-side form engine for SPAs. WarpKit forms are entirely client-side and framework-agnostic (they work with any Svelte 5 project, not just SvelteKit).

### Vue FormKit

FormKit provides schema-based forms for Vue with a rich set of input components. It is Vue-specific. WarpKit forms are Svelte 5-specific but share the philosophy of schema-driven validation. Both approaches use a proxy-like mechanism for tracking form state, but WarpKit's integration with Svelte 5's `bind:value` is more idiomatic for the Svelte ecosystem.
