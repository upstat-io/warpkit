<script lang="ts">
/**
 * Test component that consumes WarpKit context.
 * Used to verify WarpKitProvider correctly provides context.
 */
import { useWarpKit, usePage } from '../src/hooks';

const warpkit = useWarpKit();
const page = usePage();

// Check if context is available
const hasContext = $derived(warpkit !== null && warpkit !== undefined);
</script>

<div data-testid="context-check">
	{#if hasContext}
		Context Available
	{:else}
		Context Missing
	{/if}
</div>

<div data-testid="current-path">
	{page.pathname}
</div>

<div data-testid="app-state">
	{warpkit.getState()}
</div>

<div data-testid="is-navigating">
	{page.isNavigating ? 'Navigating' : 'Idle'}
</div>
