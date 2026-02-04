# Forms

WarpKit provides schema-driven form state management with deep proxy binding, validation, and array operations.

## useForm Hook

The `useForm` hook creates a reactive form state manager.

### Basic Usage

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';

  const form = useForm({
    initialValues: {
      email: '',
      password: ''
    },
    onSubmit: async (values) => {
      await login(values);
    }
  });
</script>

<form onsubmit={form.submit}>
  <input type="email" bind:value={form.data.email} />
  <input type="password" bind:value={form.data.password} />
  <button type="submit" disabled={form.isSubmitting}>
    {form.isSubmitting ? 'Submitting...' : 'Submit'}
  </button>
</form>
```

### With Schema Validation

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const schema = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 })
  });

  const form = useForm({
    initialValues: { email: '', password: '' },
    schema,
    onSubmit: async (values) => {
      await login(values);
    }
  });
</script>

<form onsubmit={form.submit}>
  <div>
    <input
      type="email"
      bind:value={form.data.email}
      onblur={() => form.touch('email')}
    />
    {#if form.errors.email}
      <span class="error">{form.errors.email}</span>
    {/if}
  </div>

  <div>
    <input
      type="password"
      bind:value={form.data.password}
      onblur={() => form.touch('password')}
    />
    {#if form.errors.password}
      <span class="error">{form.errors.password}</span>
    {/if}
  </div>

  <button type="submit" disabled={form.isSubmitting || !form.isValid}>
    Submit
  </button>
</form>
```

## Form Options

```typescript
interface FormOptions<T> {
  initialValues?: T;            // Initial form values
  schema?: StandardSchema<T>;   // Validation schema (TypeBox, Zod)
  onSubmit: (values: T) => Promise<void>;  // Submit handler
  mode?: ValidationMode;        // When to validate
  revalidateMode?: RevalidateMode;  // When to revalidate after error
  delayError?: number;          // Debounce error display (ms)
  validators?: Record<string, FieldValidator<T>>;  // Custom validators
  warners?: Record<string, FieldValidator<T>>;     // Warning validators
}
```

## Validation Modes

### mode (Initial Validation)

| Mode | Description |
|------|-------------|
| `'blur'` | Validate on field blur (default) |
| `'change'` | Validate on every change |
| `'submit'` | Only validate on submit |
| `'touched'` | Validate after field is touched |
| `'all'` | Validate on blur and change |

### revalidateMode (After Error)

| Mode | Description |
|------|-------------|
| `'change'` | Revalidate on change (default) |
| `'blur'` | Revalidate on blur |
| `'submit'` | Only revalidate on submit |

```typescript
const form = useForm({
  initialValues: { ... },
  mode: 'blur',           // First validation on blur
  revalidateMode: 'change', // After error, revalidate on change
  onSubmit: async (values) => { ... }
});
```

## Form State

```typescript
interface FormState<T> {
  // Data
  data: T;                          // Form values (proxied for bind:value)
  errors: Record<string, string>;   // Validation errors
  warnings: Record<string, string>; // Validation warnings
  touched: Record<string, boolean>; // Touched fields
  dirty: Record<string, boolean>;   // Changed fields

  // Status
  isValid: boolean;       // No errors
  isDirty: boolean;       // Any field changed
  isSubmitting: boolean;  // Submit in progress
  isValidating: boolean;  // Validation in progress
  isSubmitted: boolean;   // Has been submitted
  submitError: Error | null;  // Submit error
  submitCount: number;    // Number of submit attempts

  // Methods
  submit: (event?: Event) => Promise<void>;
  reset: (values?: Partial<T>) => void;
  validate: () => Promise<boolean>;
  validateField: (field: string) => Promise<boolean>;
  setField: (field: keyof T, value: T[keyof T]) => void;
  setError: (field: string, message: string | null) => void;
  setWarning: (field: string, message: string | null) => void;
  touch: (field: string) => void;
  clearErrors: () => void;

  // Array operations
  push: (field: string, value: unknown) => void;
  remove: (field: string, index: number) => void;
  insert: (field: string, index: number, value: unknown) => void;
  move: (field: string, from: number, to: number) => void;
  swap: (field: string, indexA: number, indexB: number) => void;

  // Field-centric access
  field: <V>(path: string) => FieldState<V>;
}
```

## Deep Proxy Binding

WarpKit forms use a deep proxy that allows direct `bind:value` on nested properties:

```svelte
<script>
  const form = useForm({
    initialValues: {
      user: {
        name: '',
        address: {
          street: '',
          city: ''
        }
      }
    },
    onSubmit: async (values) => { ... }
  });
</script>

<!-- Nested binding works directly! -->
<input bind:value={form.data.user.name} />
<input bind:value={form.data.user.address.street} />
<input bind:value={form.data.user.address.city} />
```

## Custom Validators

Add custom validation logic beyond schema validation:

```typescript
const form = useForm({
  initialValues: { username: '', email: '' },
  schema,
  validators: {
    username: async (value, allValues) => {
      // Check if username is taken
      const taken = await checkUsername(value);
      if (taken) return 'Username is already taken';
      return undefined; // No error
    }
  },
  onSubmit: async (values) => { ... }
});
```

## Warnings

Warnings don't block submission but provide feedback:

```typescript
const form = useForm({
  initialValues: { password: '' },
  warners: {
    password: (value) => {
      if (value.length < 12) {
        return 'Consider using a longer password';
      }
      return undefined;
    }
  },
  onSubmit: async (values) => { ... }
});
```

```svelte
<input type="password" bind:value={form.data.password} />
{#if form.errors.password}
  <span class="error">{form.errors.password}</span>
{:else if form.warnings.password}
  <span class="warning">{form.warnings.password}</span>
{/if}
```

## Array Fields

WarpKit forms provide operations for array fields with automatic error reindexing.

### Example: Dynamic List

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';

  const form = useForm({
    initialValues: {
      items: [{ name: '' }]
    },
    onSubmit: async (values) => { ... }
  });
</script>

{#each form.data.items as item, index}
  <div class="item">
    <input bind:value={form.data.items[index].name} />
    <button onclick={() => form.remove('items', index)}>Remove</button>
  </div>
{/each}

<button onclick={() => form.push('items', { name: '' })}>Add Item</button>
```

### Array Operations

```typescript
// Add to end
form.push('items', { name: '' });

// Remove at index
form.remove('items', 2);

// Insert at index
form.insert('items', 1, { name: 'Inserted' });

// Move item
form.move('items', 0, 3); // Move from index 0 to index 3

// Swap items
form.swap('items', 0, 1); // Swap indices 0 and 1
```

### Error Reindexing

When you remove or insert items, errors are automatically reindexed:

```typescript
// Before: errors = { 'items.2.name': 'Required' }
form.remove('items', 0);
// After: errors = { 'items.1.name': 'Required' }
```

## Field-Centric Access

Get a field-specific view for complex forms:

```typescript
const emailField = form.field<string>('user.email');

// Access field state
emailField.value;    // Current value
emailField.error;    // Error message
emailField.warning;  // Warning message
emailField.touched;  // Has been touched
emailField.dirty;    // Has changed
```

```svelte
<script>
  const emailField = form.field<string>('email');
</script>

<input
  value={emailField.value}
  oninput={(e) => form.setField('email', e.target.value)}
  class:error={emailField.error}
  class:dirty={emailField.dirty}
/>
{#if emailField.error}
  <span>{emailField.error}</span>
{/if}
```

## Error Debouncing

Delay error display to avoid flickering:

```typescript
const form = useForm({
  initialValues: { ... },
  delayError: 300, // Show errors after 300ms
  onSubmit: async (values) => { ... }
});
```

## Schema Support

### TypeBox

```typescript
import { Type } from '@sinclair/typebox';

const schema = Type.Object({
  email: Type.String({ format: 'email' }),
  age: Type.Number({ minimum: 18 })
});

const form = useForm({
  initialValues: { email: '', age: 0 },
  schema,
  onSubmit: async (values) => { ... }
});
```

### Zod

```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(18)
});

const form = useForm({
  initialValues: { email: '', age: 0 },
  schema,
  onSubmit: async (values) => { ... }
});
```

### StandardSchema

Any library implementing StandardSchema works:

```typescript
interface StandardSchema<T> {
  '~standard': {
    version: 1;
    vendor: string;
    validate: (value: unknown) => StandardResult<T>;
  };
}
```

## Default Values from Schema

TypeBox schemas with defaults are automatically extracted:

```typescript
const schema = Type.Object({
  name: Type.String({ default: '' }),
  count: Type.Number({ default: 0 }),
  enabled: Type.Boolean({ default: true })
});

// initialValues can be empty - defaults come from schema
const form = useForm({
  schema,
  onSubmit: async (values) => { ... }
});

// form.data = { name: '', count: 0, enabled: true }
```

## Reset Form

```typescript
// Reset to initial values
form.reset();

// Reset with new values
form.reset({ email: 'new@example.com' });
```

## Best Practices

1. **Use schemas** - Define validation upfront with TypeBox or Zod
2. **Use blur mode** - Better UX than validating on every keystroke
3. **Show field errors** - Display errors next to inputs
4. **Use warnings for suggestions** - Non-blocking feedback
5. **Handle submit errors** - Display API errors to users
6. **Use field-centric access** - For complex, reusable field components
7. **Debounce errors** - Avoid flicker during typing
