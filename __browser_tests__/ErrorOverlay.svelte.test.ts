/**
 * Browser Test: ErrorOverlay Component
 *
 * Tests the error overlay display, interaction, and accessibility features.
 */
import { render, cleanup } from 'vitest-browser-svelte';
import { expect, test, describe, beforeEach, afterEach } from 'vitest';
import TestErrorOverlay from './TestErrorOverlay.svelte';
import { errorStore } from '../src/errors/error-store.svelte';

describe('ErrorOverlay', () => {
	beforeEach(() => {
		errorStore.clearHistory();
	});

	afterEach(() => {
		cleanup();
	});

	describe('visibility', () => {
		test('should not show overlay when no error', async () => {
			const screen = render(TestErrorOverlay);
			await expect.element(screen.getByTestId('show-ui')).toHaveTextContent('false');

			// Overlay should not be in DOM
			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay).toBeNull();
		});

		test('should show overlay when error is triggered', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			await expect.element(screen.getByTestId('show-ui')).toHaveTextContent('true');

			// Overlay should be visible
			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay).not.toBeNull();
		});

		test('should display error message in overlay', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const messageEl = screen.container.querySelector('.warpkit-error-message');
			expect(messageEl?.textContent).toBe('Test error message');
		});

		test('should display stack trace when available', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const stackEl = screen.container.querySelector('.warpkit-error-stack');
			expect(stackEl).not.toBeNull();
			expect(stackEl?.textContent).toContain('at TestComponent');
		});

		test('should not display stack trace for string errors', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-string').click();

			// Overlay should be visible
			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay).not.toBeNull();

			// Stack container should not be present
			const stackContainer = screen.container.querySelector('.warpkit-stack-container');
			expect(stackContainer).toBeNull();
		});
	});

	describe('dismiss functionality', () => {
		test('should hide overlay when dismiss button is clicked', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			// Verify overlay is visible
			let overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay).not.toBeNull();

			// Click dismiss button
			const dismissBtn = screen.container.querySelector('.warpkit-btn-secondary');
			dismissBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

			// Wait for state update
			await expect.element(screen.getByTestId('show-ui')).toHaveTextContent('false');

			// Overlay should be gone
			overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay).toBeNull();
		});

		test('should clear error state when dismissed', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('true');

			// Click dismiss
			const dismissBtn = screen.container.querySelector('.warpkit-btn-secondary');
			dismissBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('false');
		});
	});

	describe('accessibility', () => {
		test('should have alertdialog role', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay?.getAttribute('role')).toBe('alertdialog');
		});

		test('should have aria-modal attribute', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay?.getAttribute('aria-modal')).toBe('true');
		});

		test('should have aria-labelledby pointing to title', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay?.getAttribute('aria-labelledby')).toBe('error-title');

			// Verify the title element exists
			const title = screen.container.querySelector('#error-title');
			expect(title).not.toBeNull();
		});

		test('should have accessible dismiss button', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const dismissBtn = screen.container.querySelector('.warpkit-btn-secondary');
			expect(dismissBtn?.textContent).toBe('Dismiss');
		});

		test('should have accessible copy button', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const copyBtn = screen.container.querySelector('.warpkit-btn-copy');
			expect(copyBtn?.getAttribute('aria-label')).toBe('Copy error to clipboard');
			expect(copyBtn?.getAttribute('title')).toBe('Copy to clipboard');
		});
	});

	describe('reload functionality', () => {
		test('should have reload button', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const reloadBtn = screen.container.querySelector('.warpkit-btn-primary');
			expect(reloadBtn?.textContent).toBe('Reload Page');
		});
	});

	describe('error states', () => {
		test('should handle fatal errors', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-fatal').click();

			const messageEl = screen.container.querySelector('.warpkit-error-message');
			expect(messageEl?.textContent).toBe('Fatal error occurred');
		});

		test('should allow multiple errors in sequence', async () => {
			const screen = render(TestErrorOverlay);

			// First error
			await screen.getByTestId('trigger-error').click();
			let messageEl = screen.container.querySelector('.warpkit-error-message');
			expect(messageEl?.textContent).toBe('Test error message');

			// Clear error using the dismiss button in the overlay (since overlay blocks other buttons)
			const dismissBtn = screen.container.querySelector('.warpkit-btn-secondary');
			dismissBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

			// Wait for overlay to be gone
			await expect.element(screen.getByTestId('show-ui')).toHaveTextContent('false');

			// Trigger new error
			await screen.getByTestId('trigger-string').click();

			messageEl = screen.container.querySelector('.warpkit-error-message');
			expect(messageEl?.textContent).toBe('Simple string error');
		});
	});

	describe('branding', () => {
		test('should display WarpKit brand', async () => {
			const screen = render(TestErrorOverlay);

			await screen.getByTestId('trigger-error').click();

			const brand = screen.container.querySelector('.warpkit-brand');
			expect(brand?.textContent).toBe('WarpKit');
		});
	});
});
