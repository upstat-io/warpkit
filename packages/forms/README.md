# @warpkit/forms

Schema-driven form state management for Svelte 5 with deep proxy binding.

## Installation

```bash
npm install @warpkit/forms @warpkit/validation
```

## Features

- **Schema validation** - StandardSchema compatible (Zod, TypeBox, Valibot)
- **Deep binding** - Transparent `bind:value` for nested objects
- **Array support** - push, remove, insert, move operations
- **Validation modes** - submit, blur, change, touched

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

<form onsubmit={form.handleSubmit}>
  <input bind:value={form.data.name} />
  {#if form.errors.name}
    <span class="error">{form.errors.name}</span>
  {/if}

  <input bind:value={form.data.email} />

  {#each form.data.tags as _, i}
    <input bind:value={form.data.tags[i]} />
    <button type="button" onclick={() => form.removeFromArray('tags', i)}>
      Remove
    </button>
  {/each}

  <button type="button" onclick={() => form.pushToArray('tags', '')}>
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
- `errors` - Field errors
- `warnings` - Field warnings
- `touched` - Touched fields
- `isDirty` - Form has changes
- `isValid` - No validation errors
- `isSubmitting` - Submit in progress
- `handleSubmit` - Form submit handler
- `setFieldValue(path, value)` - Set field value
- `setFieldError(path, message)` - Set field error
- `clearFieldError(path)` - Clear field error
- `reset()` - Reset to initial values
- `pushToArray(path, value)` - Add to array
- `removeFromArray(path, index)` - Remove from array
- `insertIntoArray(path, index, value)` - Insert into array
- `moveInArray(path, from, to)` - Reorder array
