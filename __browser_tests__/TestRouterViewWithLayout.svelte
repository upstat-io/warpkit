<script lang="ts">
/**
 * Test wrapper for RouterView with layout support.
 * Tests that layouts wrap route components correctly.
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
	<div data-testid="router-view-wrapper">
		<RouterView />
	</div>
</WarpKitProvider>
