<script lang="ts">
	import { useQuery } from '../../packages/data/src/hooks.svelte.js';
	import type { DataKey } from '../../packages/data/src/types.js';

	interface Props {
		queryKey: string;
		params?: Record<string, string>;
		enabled?: boolean;
	}

	let { queryKey, params, enabled = true }: Props = $props();

	// Call useQuery with provided options
	// Use getter function for enabled to maintain Svelte 5 reactivity
	const state = useQuery({
		key: queryKey as DataKey,
		params,
		enabled: () => enabled
	});

	function handleRefetch() {
		state.refetch();
	}
</script>

<div data-testid="loading">{state.isLoading}</div>
<div data-testid="data">{JSON.stringify(state.data)}</div>
<div data-testid="error">{state.error?.message ?? ''}</div>
<div data-testid="is-error">{state.isError}</div>
<div data-testid="is-success">{state.isSuccess}</div>
<button data-testid="refetch" onclick={handleRefetch}>Refetch</button>
