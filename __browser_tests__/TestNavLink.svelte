<script lang="ts">
/**
 * Test wrapper for NavLink component.
 * Provides WarpKit context via WarpKitProvider.
 */
import type { MockWarpKit } from '../src/testing';
import WarpKitProvider from '../src/components/WarpKitProvider.svelte';
import NavLink from '../src/components/NavLink.svelte';

interface Props {
	warpkit: MockWarpKit<any>;
	href: string;
	label: string;
	activeClass?: string;
	exactActiveClass?: string;
	replace?: boolean;
	disabled?: boolean;
	class?: string;
}

let {
	warpkit,
	href,
	label,
	activeClass = '',
	exactActiveClass = '',
	replace = false,
	disabled = false,
	class: className = ''
}: Props = $props();
</script>

<WarpKitProvider {warpkit}>
	<NavLink {href} {activeClass} {exactActiveClass} {replace} {disabled} class={className}>
		{label}
	</NavLink>
</WarpKitProvider>
