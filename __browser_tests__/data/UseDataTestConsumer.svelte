<script lang="ts">
	import { useData } from '../../packages/data/src/useData.svelte.js';
	import type { DataKey } from '../../packages/data/src/types.js';

	interface Props {
		dataKey: string;
		invalidateOn?: string[];
	}

	let { dataKey, invalidateOn = [] }: Props = $props();

	// Use the actual useData hook we're testing
	// The key must be registered in the wrapper's DataClientConfig
	// Pass invalidateOn through the config (not just rely on DataClient key config)
	const queryResult = useData(dataKey as DataKey, {
		url: `/${dataKey}`,
		invalidateOn: invalidateOn.length > 0 ? invalidateOn : undefined
	});

	function handleRefetch() {
		queryResult.refetch();
	}
</script>

<div data-testid="loading">{queryResult.isLoading}</div>
<div data-testid="data">{JSON.stringify(queryResult.data)}</div>
<div data-testid="error">{queryResult.error?.message ?? ''}</div>
<div data-testid="is-error">{queryResult.isError}</div>
<div data-testid="is-success">{queryResult.isSuccess}</div>
<button data-testid="refetch" onclick={handleRefetch}>Refetch</button>
