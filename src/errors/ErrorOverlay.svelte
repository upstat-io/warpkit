<script lang="ts">
	// Global Error Overlay
	// Displays a full error dialog with stack trace when unhandled errors occur.
	import { errorStore } from './error-store.svelte';
	import type { NormalizedError } from './types';

	/** Duration to show "Copied!" feedback after copying error to clipboard */
	const COPY_FEEDBACK_TIMEOUT_MS = 2000;

	let copied = $state<boolean>(false);
	let dialogElement: HTMLDivElement | undefined = $state();

	// Subscribe to error store for reactive updates
	let showErrorUI = $state(false);
	let currentError = $state<NormalizedError | null>(null);

	$effect(() => {
		const unsubscribe = errorStore.subscribe((state) => {
			showErrorUI = state.showErrorUI;
			currentError = state.currentError;
		});
		return unsubscribe;
	});

	/**
	 * Clean up Vite dev server URLs in stack traces to show actual file paths.
	 * Transforms: http://localhost:4202/@fs/home/eric/project/file.ts?t=123:10:5
	 * Into: /home/eric/project/file.ts:10:5
	 */
	function cleanStackTrace(stack: string): string {
		return stack
			// Replace Vite @fs URLs with actual paths
			.replace(/https?:\/\/[^/]+\/@fs([^?\s]+)\?[^:]*:(\d+):(\d+)/g, '$1:$2:$3')
			// Also handle URLs without query params
			.replace(/https?:\/\/[^/]+\/@fs([^:\s]+):(\d+):(\d+)/g, '$1:$2:$3')
			// Clean up node_modules paths to be shorter
			.replace(/\/node_modules\/.pnpm\/[^/]+\/node_modules\//g, '/node_modules/')
			// Remove localhost URLs for regular imports
			.replace(/https?:\/\/localhost:\d+\//g, './');
	}

	// Focus the dismiss button when dialog appears (WCAG 2.4.3)
	$effect(() => {
		if (dialogElement) {
			dialogElement.querySelector<HTMLButtonElement>('button')?.focus();
		}
	});

	function dismiss(): void {
		errorStore.clearCurrentError();
	}

	function reload(): void {
		window.location.reload();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			dismiss();
			return;
		}

		// Focus trap for Tab/Shift+Tab
		if (event.key === 'Tab' && dialogElement) {
			const focusableElements = dialogElement.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			if (event.shiftKey && document.activeElement === firstElement) {
				event.preventDefault();
				lastElement?.focus();
			} else if (!event.shiftKey && document.activeElement === lastElement) {
				event.preventDefault();
				firstElement?.focus();
			}
		}
	}

	async function copyError(): Promise<void> {
		const error = errorStore.currentError;
		if (!error) return;

		const text = `${error.message}\n\n${error.stack ?? ''}`;
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), COPY_FEEDBACK_TIMEOUT_MS);
	}
</script>

{#if showErrorUI && currentError}
	<div
		class="warpkit-error-overlay"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="error-title"
		tabindex="-1"
		onkeydown={handleKeydown}
	>
		<div class="warpkit-error-dialog" bind:this={dialogElement}>
			<div class="warpkit-error-header">
				<span class="warpkit-error-icon">⚠</span>
				<h2 id="error-title">Unhandled Error</h2>
			</div>
			<div class="warpkit-error-body">
				<p class="warpkit-error-message">{currentError.message}</p>
				{#if currentError.stack}
					<div class="warpkit-stack-container">
						<button class="warpkit-btn-copy" onclick={copyError} title="Copy to clipboard" aria-label="Copy error to clipboard">
							{#if copied}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
							{:else}
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
									<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
								</svg>
							{/if}
						</button>
						<pre class="warpkit-error-stack">{cleanStackTrace(currentError.stack)}</pre>
					</div>
				{/if}
			</div>
			<div class="warpkit-error-actions">
				<span class="warpkit-brand">WarpKit</span>
				<button class="warpkit-btn-secondary" onclick={dismiss}>Dismiss</button>
				<button class="warpkit-btn-primary" onclick={reload}>Reload Page</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/*
	 * ErrorOverlay Styles
	 * These styles are intentionally isolated from the host app.
	 * All properties are explicitly set to prevent Tailwind or other CSS from leaking in.
	 */

	.warpkit-error-overlay {
		/* Reset any inherited styles */
		all: initial;
		/* Re-apply box-sizing after reset */
		box-sizing: border-box;

		/* Layout */
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;

		/* Visual */
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(4px);

		/* Typography - explicit to prevent app fonts leaking in */
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 16px;
		line-height: 1.5;
		color: #fff;
		text-align: left;
		font-weight: normal;
		font-style: normal;
		text-transform: none;
		letter-spacing: normal;
		word-spacing: normal;
	}

	.warpkit-error-overlay *,
	.warpkit-error-overlay *::before,
	.warpkit-error-overlay *::after {
		box-sizing: border-box;
	}

	/* Reset scrollbar styles to prevent app styles from leaking in */
	.warpkit-error-overlay ::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.warpkit-error-overlay ::-webkit-scrollbar-track {
		background: #0d0d0d;
	}

	.warpkit-error-overlay ::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 0;
	}

	.warpkit-error-overlay ::-webkit-scrollbar-thumb:hover {
		background: #555;
	}

	/* Firefox scrollbar */
	.warpkit-error-overlay * {
		scrollbar-width: thin;
		scrollbar-color: #444 #0d0d0d;
	}

	.warpkit-error-dialog {
		background: #1a1a1a;
		max-width: 800px;
		width: 90%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		border: 1px solid #333;
	}

	.warpkit-error-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: #991b1b;
		color: #fff;
	}

	.warpkit-error-icon {
		font-size: 1.25rem;
	}

	.warpkit-error-header h2 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.warpkit-error-body {
		padding: 1.25rem;
		overflow: auto;
		flex: 1;
	}

	.warpkit-error-message {
		margin: 0 0 1rem;
		font-size: 1rem;
		font-weight: 500;
		color: #f87171;
		line-height: 1.5;
		word-break: break-word;
	}

	.warpkit-stack-container {
		position: relative;
	}

	.warpkit-btn-copy {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0.375rem;
		background: #333;
		border: 1px solid #444;
		color: #a3a3a3;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.warpkit-btn-copy:hover {
		background: #444;
		color: #fff;
	}

	.warpkit-btn-copy:focus-visible {
		outline: 2px solid #f87171;
		outline-offset: 2px;
	}

	.warpkit-error-stack {
		margin: 0;
		padding: 1rem;
		padding-right: 3rem;
		background: #0d0d0d;
		border: 1px solid #333;
		font-size: 0.75rem;
		line-height: 1.6;
		color: #a3a3a3;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.warpkit-error-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 1rem 1.25rem;
		background: #0d0d0d;
		border-top: 1px solid #333;
	}

	.warpkit-brand {
		font-size: 0.875rem;
		font-weight: 600;
		color: #666;
		margin-right: auto;
	}

	.warpkit-btn-secondary,
	.warpkit-btn-primary {
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: inherit;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border: none;
		cursor: pointer;
	}

	.warpkit-btn-secondary {
		background: #333;
		color: #e5e5e5;
	}

	.warpkit-btn-secondary:hover {
		background: #444;
	}

	.warpkit-btn-secondary:focus-visible {
		outline: 2px solid #e5e5e5;
		outline-offset: 2px;
	}

	.warpkit-btn-primary {
		background: #991b1b;
		color: #fff;
	}

	.warpkit-btn-primary:hover {
		background: #7f1d1d;
	}

	.warpkit-btn-primary:focus-visible {
		outline: 2px solid #f87171;
		outline-offset: 2px;
	}
</style>
