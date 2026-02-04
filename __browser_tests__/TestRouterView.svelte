<script lang="ts">
/**
 * Test wrapper for RouterView component.
 * Provides WarpKit context and optional loading/fallback snippets.
 */
import type { MockWarpKit } from '../src/testing';
import WarpKitProvider from '../src/components/WarpKitProvider.svelte';
import RouterView from '../src/components/RouterView.svelte';

interface Props {
	warpkit: MockWarpKit<any>;
	showLoading?: boolean;
	showFallback?: boolean;
	showError?: boolean;
}

let {
	warpkit,
	showLoading = false,
	showFallback = false,
	showError = false
}: Props = $props();
</script>

<WarpKitProvider {warpkit}>
	<RouterView>
		{#snippet loading()}
			{#if showLoading}
				<div data-testid="loading">Loading...</div>
			{/if}
		{/snippet}

		{#snippet fallback()}
			{#if showFallback}
				<div data-testid="fallback">No route matched</div>
			{/if}
		{/snippet}

		{#snippet error({ error, retry })}
			{#if showError && error}
				<div data-testid="error">
					<p>Error: {error.message}</p>
					<button onclick={retry}>Retry</button>
				</div>
			{/if}
		{/snippet}
	</RouterView>
</WarpKitProvider>
