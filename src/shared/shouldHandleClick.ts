/**
 * WarpKit v2 Click Guard
 *
 * Utility to determine if a click event should be handled internally
 * by WarpKit's navigation system or passed to the browser.
 */

/**
 * Determine if a click event should be handled by WarpKit's navigation.
 *
 * Returns false (let browser handle) when:
 * - Event's default was already prevented
 * - Non-primary mouse button (middle click, right click)
 * - Modifier key pressed (Ctrl, Cmd, Shift, Alt) - user wants new tab/window
 * - External URL (http://, https://, //)
 * - Protocol URL (mailto:, tel:, etc.)
 * - Download link (has download attribute)
 * - Target blank (target="_blank")
 *
 * @param event - The mouse event from the click
 * @param href - The href attribute of the anchor
 * @returns true if WarpKit should handle the navigation, false for browser default
 *
 * @example
 * ```svelte
 * <script>
 *   import { shouldHandleClick } from '@warpkit/core/shared';
 *   import { useWarpKit } from '@warpkit/core';
 *
 *   const warpkit = useWarpKit();
 *
 *   function handleClick(event: MouseEvent) {
 *     if (shouldHandleClick(event, href)) {
 *       event.preventDefault();
 *       warpkit.navigate(href);
 *     }
 *   }
 * </script>
 * ```
 */
export function shouldHandleClick(event: MouseEvent, href: string): boolean {
	// Event already handled
	if (event.defaultPrevented) return false;

	// Non-primary button (right click, middle click)
	if (event.button !== 0) return false;

	// Modifier keys - user wants new tab/window
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

	// External URLs - let browser handle
	if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
		return false;
	}

	// Protocol URLs (mailto:, tel:, javascript:, etc.)
	if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
		return false;
	}

	// Check anchor element attributes
	const target = event.currentTarget as HTMLAnchorElement | null;
	if (target) {
		// Download link
		if (target.hasAttribute('download')) return false;

		// Target blank - should open in new tab
		if (target.target === '_blank') return false;
	}

	return true;
}
