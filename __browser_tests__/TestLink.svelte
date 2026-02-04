<script lang="ts">
/**
 * Test wrapper for Link component.
 * Provides WarpKit context via WarpKitProvider.
 */
import type { MockWarpKit } from '../src/testing';
import WarpKitProvider from '../src/components/WarpKitProvider.svelte';
import Link from '../src/components/Link.svelte';

interface Props {
	warpkit: MockWarpKit<any>;
	href: string;
	label: string;
	replace?: boolean;
	disabled?: boolean;
	class?: string;
}

let {
	warpkit,
	href,
	label,
	replace = false,
	disabled = false,
	class: className = ''
}: Props = $props();
</script>

<WarpKitProvider {warpkit}>
	<Link {href} {replace} {disabled} class={className}>
		{label}
	</Link>
</WarpKitProvider>
