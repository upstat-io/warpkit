# @warpkit/forms

Schema-driven form state management for Svelte 5 with deep proxy binding.

## Installation

```bash
bun add @warpkit/forms @warpkit/validation
```

## Features

- **Schema validation** - StandardSchema compatible (Zod, TypeBox, Valibot)
- **Deep binding** - Transparent `bind:value` for nested objects
- **Array support** - push, remove, insert, move operations
- **Validation modes** - submit, blur, change, touched
- **Typed errors** - Autocomplete for top-level field keys
- **Auto-cleanup** - Timer cleanup via `$effect` (no manual `onDestroy` needed)

## Usage

```svelte
<script lang="ts">
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const schema = Type.Object({
    name: Type.String({ minLength: 1 }),
    email: Type.String({ format: 'email' }),
    tags: Type.Array(Type.String())
  });

  const form = useForm({
    schema,
    initialValues: { name: '', email: '', tags: [] },
    onSubmit: async (values) => {
      await saveUser(values);
    }
  });
</script>

<form onsubmit={form.submit}>
  <input bind:value={form.data.name} />
  {#if form.errors.name}
    <span class="error">{form.errors.name}</span>
  {/if}

  <input bind:value={form.data.email} />

  {#each form.data.tags as _, i}
    <input bind:value={form.data.tags[i]} />
    <button type="button" onclick={() => form.remove('tags', i)}>
      Remove
    </button>
  {/each}

  <button type="button" onclick={() => form.push('tags', '')}>
    Add Tag
  </button>

  <button type="submit" disabled={form.isSubmitting}>
    {form.isSubmitting ? 'Saving...' : 'Save'}
  </button>
</form>
```

## API

### useForm(options)

Options:
- `schema` - StandardSchema for validation
- `initialValues` - Initial form values
- `onSubmit` - Submit handler
- `mode` - Validation mode: 'submit' | 'blur' | 'change' | 'touched'
- `revalidateMode` - Revalidation mode after error

Returns:
- `data` - Proxied form values (use with bind:value)
- `errors` - Typed field errors (autocomplete for top-level keys)
- `warnings` - Field warnings
- `touched` - Touched fields
- `dirty` - Dirty fields
- `isDirty` - Form has changes
- `isValid` - No validation errors
- `isSubmitting` - Submit in progress
- `isSubmitted` - Form has been submitted
- `submitError` - Error from last submit
- `submitCount` - Number of submit attempts
- `submit(event?)` - Form submit handler
- `reset(newValues?)` - Reset to initial values
- `resetDirty()` - Snapshot current values as dirty baseline
- `validate()` - Validate entire form
- `validateField(field)` - Validate single field
- `setField(field, value)` - Set field value
- `setError(field, message)` - Set/clear field error
- `setWarning(field, message)` - Set/clear field warning
- `touch(field)` - Mark field as touched
- `clearErrors()` - Clear all errors and warnings
- `push(field, value)` - Add to array
- `remove(field, index)` - Remove from array
- `insert(field, index, value)` - Insert into array
- `move(field, from, to)` - Reorder array
- `swap(field, indexA, indexB)` - Swap array items
- `field(path)` - Get field-centric state view
- `cleanup()` - Clean up timers (automatic via $effect)

## Native TypeBox errors

Raw TypeBox schemas are validated without a StandardSchema wrapper. Install TypeBox in the consuming application and register any formats it uses. Validation checks encoded values; it does not decode transforms before submission.

For unions, including nullable objects and nested array entries, `form.errors` retains the union summary and descendant field diagnostics using dotted paths, such as `contact.email` or `entries.1.contact.email`. The first diagnostic at each path wins, with a schema's string `error` annotation preferred to the default message. Alternative diagnostics describe why validation failed; they do not select a branch or establish that a value is valid. Valid alternatives produce no errors. Async validation and the sync path after TypeBox has loaded use the same mapping.
