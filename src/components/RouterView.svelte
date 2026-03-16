<script lang="ts">
/**
 * RouterView - Route Renderer Component
 *
 * Renders the currently matched route's component.
 * Uses {#key} to remount when state changes or pathname changes.
 * Handles layout wrapping when layout is defined.
 * Wraps component rendering in svelte:boundary to catch RENDER_ERROR (code 8).
 *
 * Error handling strategy:
 * - When an `error` snippet is provided: renders it in the failed snippet (consumer handles UI)
 * - When no `error` snippet: routes error to ErrorOverlay via errorStore (framework handles UI)
 * - {#key page.pathname} ensures back/forward navigation recreates the boundary, clearing errors
 */

import type { Snippet } from 'svelte';
import { useWarpKitContext } from '../hooks';
import { errorStore } from '../errors/error-store.svelte.js';

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

/**
 * Route render errors to ErrorOverlay when no custom error snippet is provided.
 * Called via onerror on svelte:boundary — fires before the failed snippet renders.
 */
function handleRenderError(caught: unknown): void {
	if (error) return;
	const err = caught instanceof Error ? caught : new Error(String(caught));
	errorStore.setError(err, {
		source: 'component',
		severity: 'error',
		context: { renderError: true, path: page.path },
		showUI: true
	});
}
</script>

{#key stateId}
	{#if page.error && error}
		{@render error({ error: page.error, retry: ctx.retryLoad })}
	{:else if page.isNavigating && loading}
		{@render loading()}
	{:else if routeComponent}
		{#key page.pathname}
			<svelte:boundary onerror={handleRenderError}>
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
					{/if}
				{/snippet}
			</svelte:boundary>
		{/key}
	{:else if fallback}
		{@render fallback()}
	{/if}
{/key}
