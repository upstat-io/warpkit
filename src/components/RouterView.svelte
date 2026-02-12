<script lang="ts">
/**
 * RouterView - Route Renderer Component
 *
 * Renders the currently matched route's component.
 * Uses {#key} to remount when state changes.
 * Handles layout wrapping when layout is defined.
 * Wraps component rendering in svelte:boundary to catch RENDER_ERROR (code 8).
 */

import type { Snippet } from 'svelte';
import { useWarpKitContext } from '../hooks';

import { NavigationErrorCode } from '../core/types';
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

/**
 * Convert a caught render error into a NavigationError with RENDER_ERROR code.
 * Does NOT set PageState.error — lives entirely within svelte:boundary's failed snippet.
 */
function toRenderError(caught: unknown): NavigationError {
	const cause = caught instanceof Error ? caught : new Error(String(caught));
	return {
		code: NavigationErrorCode.RENDER_ERROR,
		message: `Component render error: ${cause.message}`,
		cause,
		requestedPath: page.path
	};
}
</script>

{#key stateId}
	{#if page.error && error}
		{@render error({ error: page.error, retry: ctx.retryLoad })}
	{:else if page.isNavigating && loading}
		{@render loading()}
	{:else if routeComponent}
		<svelte:boundary>
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
			{#snippet failed(caughtError, reset)}
				{#if error}
					{@render error({ error: toRenderError(caughtError), retry: () => { reset(); ctx.retryLoad(); } })}
				{:else}
					<p>Component render error: {caughtError instanceof Error ? caughtError.message : String(caughtError)}</p>
				{/if}
			{/snippet}
		</svelte:boundary>
	{:else if fallback}
		{@render fallback()}
	{/if}
{/key}
