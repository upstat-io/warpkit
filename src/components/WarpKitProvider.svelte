<script lang="ts">
/**
 * WarpKitProvider - Context Provider Component
 *
 * Provides WarpKit context to child components.
 * Must wrap all components that use useWarpKit() or usePage().
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
// Note: warpkit prop doesn't change after mount, this is intentional
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

{@render children()}
