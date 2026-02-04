<script lang="ts">
	import { useForm } from '../../packages/forms/src/index.js';
	import type { FormOptions } from '../../packages/forms/src/index.js';
	import type { StandardSchema } from '@warpkit/validation';

	interface ArrayFormValues {
		items: Array<{ id: string; name: string }>;
	}

	interface Props {
		initialValues: ArrayFormValues;
		schema?: StandardSchema<ArrayFormValues>;
		onSubmit?: (values: ArrayFormValues) => void | Promise<void>;
	}

	let {
		initialValues,
		schema,
		onSubmit
	}: Props = $props();

	const form = useForm({
		initialValues,
		schema: schema as FormOptions<ArrayFormValues>['schema'],
		onSubmit: onSubmit ?? (() => {})
	});

	function handleAdd() {
		const newId = String(form.data.items.length + 1);
		form.push('items', { id: newId, name: `Item ${newId}` });
	}

	function handleRemove(index: number) {
		form.remove('items', index);
	}

	function handleInsert(index: number) {
		const newId = `inserted-${Date.now()}`;
		form.insert('items', index, { id: newId, name: `Inserted at ${index}` });
	}

	function handleMove(from: number, to: number) {
		form.move('items', from, to);
	}

	function handleSwap(indexA: number, indexB: number) {
		form.swap('items', indexA, indexB);
	}

	function handleSetError(index: number, message: string) {
		form.setError(`items.${index}.name`, message);
	}
</script>

<div data-testid="items-count">{form.data.items.length}</div>
<div data-testid="items-data">{JSON.stringify(form.data.items)}</div>
<div data-testid="errors">{JSON.stringify(form.errors)}</div>

<ul data-testid="items-list">
	{#each form.data.items as item, index (item.id)}
		<li data-testid="item-{index}">
			<span data-testid="item-{index}-name">{item.name}</span>
			<span data-testid="item-{index}-id">{item.id}</span>
			<button data-testid="remove-{index}" onclick={() => handleRemove(index)}>Remove</button>
			<button data-testid="insert-before-{index}" onclick={() => handleInsert(index)}>Insert Before</button>
			<button data-testid="set-error-{index}" onclick={() => handleSetError(index, `Error on item ${index}`)}>Set Error</button>
		</li>
	{/each}
</ul>

<button data-testid="add" onclick={handleAdd}>Add Item</button>
<button data-testid="move-0-1" onclick={() => handleMove(0, 1)}>Move 0 to 1</button>
<button data-testid="move-1-0" onclick={() => handleMove(1, 0)}>Move 1 to 0</button>
<button data-testid="swap-0-1" onclick={() => handleSwap(0, 1)}>Swap 0 and 1</button>
