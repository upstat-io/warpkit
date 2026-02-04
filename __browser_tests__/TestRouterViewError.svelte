<script lang="ts">
/**
 * Test wrapper for RouterView error handling.
 * Tests that error snippet renders when navigation fails.
 */
import type { MockWarpKit } from '../src/testing';
import WarpKitProvider from '../src/components/WarpKitProvider.svelte';
import RouterView from '../src/components/RouterView.svelte';

interface Props {
	warpkit: MockWarpKit<any>;
}

let { warpkit }: Props = $props();
</script>

<WarpKitProvider {warpkit}>
	<RouterView>
		{#snippet error({ error, retry })}
			<div data-testid="error-display">
				<p data-testid="error-message">Error: {error?.message ?? 'Unknown error'}</p>
				<p data-testid="error-code">{error?.code ?? 'NO_CODE'}</p>
				<button data-testid="retry-button" onclick={retry}>Retry</button>
			</div>
		{/snippet}

		{#snippet fallback()}
			<div data-testid="fallback">Not found</div>
		{/snippet}
	</RouterView>
</WarpKitProvider>
