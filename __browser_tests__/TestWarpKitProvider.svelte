<script lang="ts">
/**
 * Test wrapper for WarpKitProvider context testing.
 * Verifies that context is correctly provided to children.
 */
import type { MockWarpKit } from '../src/testing';
import WarpKitProvider from '../src/components/WarpKitProvider.svelte';
import TestContextConsumer from './TestContextConsumer.svelte';

interface Props {
	warpkit: MockWarpKit<any>;
}

let { warpkit }: Props = $props();
</script>

<WarpKitProvider {warpkit}>
	<TestContextConsumer />
</WarpKitProvider>
