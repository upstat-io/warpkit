<script lang="ts">
/**
 * NavLink Component - Active-Aware Navigation Link
 *
 * Extends Link with active state classes.
 * - activeClass: Applied when current path starts with href
 * - exactActiveClass: Applied when current path exactly matches href
 */

import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import { useWarpKit, usePage } from '../hooks';
import { shouldHandleClick } from '../shared/shouldHandleClick';

interface Props extends Omit<HTMLAnchorAttributes, 'href'> {
	/** Target path (required) */
	href: string;
	/** Class to apply when path starts with href (partial match) */
	activeClass?: string;
	/** Class to apply when path exactly matches href */
	exactActiveClass?: string;
	/** Whether to replace history instead of push */
	replace?: boolean;
	/** Whether link is disabled */
	disabled?: boolean;
	/** Children content */
	children?: Snippet;
}

let {
	href,
	activeClass = '',
	exactActiveClass = '',
	replace: replaceHistory = false,
	disabled = false,
	children,
	class: className = '',
	...rest
}: Props = $props();

const warpkit = useWarpKit();
const page = usePage();

// Check for exact match
const isExactActive = $derived(page.pathname === href);

// Check for partial match (path starts with href)
// Handle root path specially to avoid false positives
const isActive = $derived(
	isExactActive || (page.pathname.startsWith(href + '/') && href !== '/')
);

// Combine classes
const computedClass = $derived(
	[
		className,
		isActive ? activeClass : '',
		isExactActive ? exactActiveClass : ''
	]
		.filter(Boolean)
		.join(' ')
);

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
	class={computedClass}
	class:disabled
	aria-disabled={disabled || undefined}
	aria-current={isExactActive ? 'page' : isActive ? 'true' : undefined}
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
