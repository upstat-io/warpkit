<script lang="ts">
/**
 * WarpKitTestWrapper - Test Context Provider
 *
 * Simplified version of WarpKitProvider for tests.
 * Does NOT include ErrorOverlay - tests should handle errors explicitly.
 */

import { setContext, type Snippet } from 'svelte';
import { WARPKIT_CONTEXT, type WarpKit, type WarpKitContext } from '../context';
import type { PageState } from '../core/types';

interface Props {
	/** The WarpKit instance to provide */
	warpkit: WarpKit;
	/** Child content */
	children: Snippet;
}

let { warpkit, children }: Props = $props();

// Create the context object with getters for reactive properties
const context: WarpKitContext = {
	get warpkit() {
		return warpkit;
	},
	get page(): PageState {
		return warpkit.page;
	},
	get routeComponent() {
		return (warpkit as any).loadedComponent;
	},
	get layoutComponent() {
		return (warpkit as any).loadedLayout;
	},
	get stateId() {
		return warpkit.getStateId();
	},
	retryLoad: () => {
		(warpkit as any).retry?.();
	}
};

setContext(WARPKIT_CONTEXT, context);
</script>

{@render children()}
