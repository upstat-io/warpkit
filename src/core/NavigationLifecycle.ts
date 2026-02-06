/**
 * NavigationLifecycle - Hook registration and execution
 *
 * Manages the three navigation lifecycle hooks:
 * - beforeNavigate: Runs in PARALLEL, can abort (return false) or redirect (return string)
 * - onNavigate: Runs SEQUENTIALLY, used for View Transitions
 * - afterNavigate: Runs in PARALLEL, fire-and-forget (errors logged, not thrown)
 */

import type { NavigationContext, BeforeNavigateHook, OnNavigateHook, AfterNavigateHook } from './types.js';
import { reportError } from '@warpkit/errors';

/**
 * Result of running beforeNavigate hooks.
 */
export interface BeforeNavigateResult {
	/** True if navigation should proceed */
	proceed: boolean;
	/** If a hook returned a redirect path */
	redirect?: string;
}

/**
 * Manages navigation lifecycle hooks.
 * Provides registration methods that return unsubscribe functions,
 * and execution methods called by Navigator during the pipeline.
 */
export class NavigationLifecycle {
	private beforeNavigateHooks = new Set<BeforeNavigateHook>();
	private onNavigateHooks = new Set<OnNavigateHook>();
	private afterNavigateHooks = new Set<AfterNavigateHook>();

	/**
	 * Register a beforeNavigate hook.
	 * Hooks run in parallel. Return false to abort, string to redirect, void to continue.
	 * @param hook - The hook function
	 * @returns Unsubscribe function
	 */
	public registerBeforeNavigate(hook: BeforeNavigateHook): () => void {
		this.beforeNavigateHooks.add(hook);
		return () => this.beforeNavigateHooks.delete(hook);
	}

	/**
	 * Register an onNavigate hook.
	 * Hooks run sequentially (awaited). Used for View Transitions.
	 * @param hook - The hook function
	 * @returns Unsubscribe function
	 */
	public registerOnNavigate(hook: OnNavigateHook): () => void {
		this.onNavigateHooks.add(hook);
		return () => this.onNavigateHooks.delete(hook);
	}

	/**
	 * Register an afterNavigate hook.
	 * Hooks run in parallel, fire-and-forget. Errors are logged but don't block.
	 * @param hook - The hook function
	 * @returns Unsubscribe function
	 */
	public registerAfterNavigate(hook: AfterNavigateHook): () => void {
		this.afterNavigateHooks.add(hook);
		return () => this.afterNavigateHooks.delete(hook);
	}

	/**
	 * Run all beforeNavigate hooks in parallel.
	 *
	 * Conflict resolution: abort wins over redirect.
	 * If any hook returns false, navigation aborts regardless of other hooks returning redirects.
	 *
	 * @param context - Navigation context
	 * @returns Result indicating whether to proceed, abort, or redirect
	 */
	public async runBeforeNavigate(context: NavigationContext): Promise<BeforeNavigateResult> {
		if (this.beforeNavigateHooks.size === 0) {
			return { proceed: true };
		}

		// Run all hooks in parallel, each wrapped in try-catch
		const results = await Promise.all(
			[...this.beforeNavigateHooks].map(async (hook) => {
				try {
					return await hook(context);
				} catch (error) {
					// Hook threw - treat as abort
					reportError('navigation-lifecycle', error, {
						severity: 'warning',
						showUI: false,
						handledLocally: true,
						context: { hook: 'beforeNavigate' }
					});
					return false;
				}
			})
		);

		// Process results: abort wins over redirect
		let redirect: string | undefined;

		for (const result of results) {
			// Explicit abort (false) takes priority over everything
			if (result === false) {
				return { proceed: false };
			}

			// Collect first redirect (string)
			if (typeof result === 'string' && redirect === undefined) {
				redirect = result;
			}
		}

		// If we got a redirect, return it
		if (redirect !== undefined) {
			return { proceed: false, redirect };
		}

		return { proceed: true };
	}

	/**
	 * Run all onNavigate hooks sequentially.
	 *
	 * Used for View Transitions - hooks can call document.startViewTransition().
	 * Errors are logged but don't stop other hooks from running.
	 *
	 * @param context - Navigation context
	 */
	public async runOnNavigate(context: NavigationContext): Promise<void> {
		for (const hook of this.onNavigateHooks) {
			try {
				await hook(context);
			} catch (error) {
				reportError('navigation-lifecycle', error, {
					showUI: false,
					context: { hook: 'onNavigate' }
				});
			}
		}
	}

	/**
	 * Run all afterNavigate hooks in parallel (fire-and-forget).
	 *
	 * Used for analytics, logging, cleanup. Errors are logged but don't block.
	 * This method does NOT await the hooks - they run in the background.
	 *
	 * @param context - Navigation context
	 */
	public runAfterNavigate(context: NavigationContext): void {
		for (const hook of this.afterNavigateHooks) {
			try {
				hook(context);
			} catch (error) {
				reportError('navigation-lifecycle', error, {
					showUI: false,
					context: { hook: 'afterNavigate' }
				});
			}
		}
	}
}
