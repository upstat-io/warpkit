<script lang="ts">
/**
 * WarpKitTestWrapper - Test Context Provider
 *
 * Simplified version of WarpKitProvider for tests.
 * Does NOT include ErrorOverlay - tests should handle errors explicitly.
 *
 * Supports two modes:
 * 1. Pass `children` snippet for manual control
 * 2. Pass `targetComponent` + `targetProps` for renderWithWarpKit() usage
 */

import { setContext, type Snippet, type Component } from 'svelte';
import { WARPKIT_CONTEXT, type WarpKit, type WarpKitContext } from '../context';
import type { PageState } from '../core/types';

interface Props {
	/** The WarpKit instance to provide */
	warpkit: WarpKit;
	/** Child content (manual mode) */
	children?: Snippet;
	/** Target component to render inside context (renderWithWarpKit mode) */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	targetComponent?: Component<any>;
	/** Props to pass to the target component */
	targetProps?: Record<string, unknown>;
}

let { warpkit, children, targetComponent, targetProps = {} }: Props = $props();

// Create the context object with getters for reactive properties
const context: WarpKitContext = {
	get warpkit() {
		return warpkit;
	},
	get page(): PageState {
		return warpkit.page;
	},
	get routeComponent() {
		return warpkit.loadedComponent;
	},
	get layoutComponent() {
		return warpkit.loadedLayout;
	},
	get stateId() {
		return warpkit.getStateId();
	},
	retryLoad: () => {
		warpkit.retry();
	}
};

setContext(WARPKIT_CONTEXT, context);
</script>

{#if targetComponent}
	{@const Target = targetComponent}
	<Target {...targetProps} />
{:else if children}
	{@render children()}
{/if}
