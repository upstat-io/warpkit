<script lang="ts">
/**
 * RouterView - Route Renderer Component
 *
 * Renders the currently matched route's component.
 * Uses {#key} to remount when state changes.
 * Handles layout wrapping when layout is defined.
 */

import type { Snippet } from 'svelte';
import { useWarpKitContext } from '../hooks';

import type { NavigationError } from '../core/types';

interface Props {
	/** Optional loading indicator (shown while navigating) */
	loading?: Snippet;
	/** Optional error display (shown on navigation/load error) */
	error?: Snippet<[{ error: NavigationError | null; retry: () => void }]>;
	/** Optional fallback when no route matches */
	fallback?: Snippet;
}

let { loading, error, fallback }: Props = $props();

const ctx = useWarpKitContext();

// Derived values for cleaner template
const page = $derived(ctx.page);
const routeComponent = $derived(ctx.routeComponent);
const layoutComponent = $derived(ctx.layoutComponent);
const stateId = $derived(ctx.stateId);
</script>

{#key stateId}
	{#if page.error && error}
		{@render error({ error: page.error, retry: ctx.retryLoad })}
	{:else if page.isNavigating && loading}
		{@render loading()}
	{:else if routeComponent}
		{#if layoutComponent}
			{@const Layout = layoutComponent}
			{@const Route = routeComponent}
			<Layout>
				<Route {...page.params} />
			</Layout>
		{:else}
			{@const Route = routeComponent}
			<Route {...page.params} />
		{/if}
	{:else if fallback}
		{@render fallback()}
	{/if}
{/key}
