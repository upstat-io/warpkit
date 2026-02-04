# Svelte 5 Rules

## Runes (REQUIRED)

Use Svelte 5 runes, not stores:

```typescript
// State
let count = $state(0);
let items = $state<string[]>([]);

// Derived
let doubled = $derived(count * 2);
let total = $derived(items.reduce((a, b) => a + b, 0));

// Effects
$effect(() => {
  console.log('count changed:', count);
});

// Cleanup in effects
$effect(() => {
  const id = setInterval(() => count++, 1000);
  return () => clearInterval(id);
});
```

## Component Props

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    href,
    class: className = '',
    children
  }: {
    href: string;
    class?: string;
    children: Snippet;
  } = $props();
</script>
```

## File Naming

- Files using runes outside components: `*.svelte.ts`
- Test files for rune code: `*.svelte.test.ts`
- Regular TypeScript: `*.ts`

## Reactive Objects

**NEVER destructure reactive objects** - breaks reactivity:

```typescript
// WRONG - loses reactivity
const { count } = $state({ count: 0 });

// CORRECT
const state = $state({ count: 0 });
// Access as state.count
```

## Class Directive

```svelte
<!-- Conditional classes -->
<div class:active={isActive} class:disabled>

<!-- Dynamic class string -->
<div class={`base ${isActive ? 'active' : ''}`}>
```

## Event Handlers

```svelte
<!-- Svelte 5 syntax -->
<button onclick={() => count++}>
<input oninput={(e) => value = e.currentTarget.value}>

<!-- NOT the old on:click syntax -->
```

## Snippets (Replacing Slots)

```svelte
<!-- Parent -->
<Card>
  {#snippet header()}
    <h2>Title</h2>
  {/snippet}

  {#snippet content()}
    <p>Body content</p>
  {/snippet}
</Card>

<!-- Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { header, content }: { header: Snippet; content: Snippet } = $props();
</script>

<div class="card">
  <div class="header">{@render header()}</div>
  <div class="content">{@render content()}</div>
</div>
```

## Dark Mode in CSS

**NEVER use `@apply dark:...` inside `:global()`**

```css
/* WRONG */
:global(.element) {
  @apply dark:bg-gray-900;
}

/* CORRECT */
:global(.dark) .element {
  background: theme('colors.gray.900');
}
```
