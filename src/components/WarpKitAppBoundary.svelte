<script lang="ts">
/**
 * WarpKitAppBoundary - Root Application Boundary Component
 *
 * This component provides the complete WarpKit application boundary including:
 * - Error overlay for catching and displaying unhandled errors
 * - WarpKit context for child components
 * - Loading state handling (when using authAdapter)
 *
 * The ErrorOverlay is placed OUTSIDE the WarpKitProvider so errors during
 * provider initialization or component rendering are still captured.
 *
 * When an authAdapter is configured, the boundary will not render children
 * until WarpKit is ready (auth initialization complete). An optional loading
 * snippet can be provided for custom loading UI.
 *
 * Usage:
 * ```svelte
 * <WarpKitAppBoundary {warpkit}>
 *   <RouterView />
 * </WarpKitAppBoundary>
 *
 * <!-- With custom loading UI -->
 * <WarpKitAppBoundary {warpkit}>
 *   {#snippet loading()}
 *     <LoadingSpinner />
 *   {/snippet}
 *   <RouterView />
 * </WarpKitAppBoundary>
 * ```
 */

import type { Snippet } from 'svelte';
import type { WarpKit } from '../context';
import WarpKitProvider from './WarpKitProvider.svelte';
import ErrorOverlay from '../errors/ErrorOverlay.svelte';

interface Props {
	/** The WarpKit instance to provide */
	warpkit: WarpKit;
	/** Child content */
	children: Snippet;
	/**
	 * Optional loading snippet shown while WarpKit initializes.
	 * By default, nothing is rendered until ready.
	 */
	loading?: Snippet;
}

let { warpkit, children, loading }: Props = $props();
</script>

<!-- ErrorOverlay outside WarpKitProvider for resilience -->
<ErrorOverlay />

{#if warpkit.ready}
	<WarpKitProvider {warpkit}>
		{@render children()}
	</WarpKitProvider>
{:else if loading}
	{@render loading()}
{/if}
