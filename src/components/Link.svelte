<script lang="ts">
/**
 * Link Component - Declarative Navigation
 *
 * Use instead of <a> tags for client-side navigation.
 * Uses shouldHandleClick to determine if navigation should be internal.
 */

import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import { useWarpKit } from '../hooks';
import { shouldHandleClick } from '../shared/shouldHandleClick';

interface Props extends Omit<HTMLAnchorAttributes, 'href'> {
	/** Target path (required) */
	href: string;
	/** Whether to replace history instead of push */
	replace?: boolean;
	/** Whether link is disabled */
	disabled?: boolean;
	/** Children content */
	children?: Snippet;
}

let {
	href,
	replace: replaceHistory = false,
	disabled = false,
	children,
	class: className = '',
	...rest
}: Props = $props();

const warpkit = useWarpKit();

function handleClick(event: MouseEvent) {
	// Don't handle if disabled
	if (disabled) {
		event.preventDefault();
		return;
	}

	// Check if we should handle this click internally
	if (shouldHandleClick(event, href)) {
		event.preventDefault();
		warpkit.navigate(href, { replace: replaceHistory });
	}
}
</script>

<a
	{href}
	class={className}
	class:disabled
	aria-disabled={disabled || undefined}
	onclick={handleClick}
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</a>

<style>
	.disabled {
		pointer-events: none;
		opacity: 0.5;
	}
</style>
