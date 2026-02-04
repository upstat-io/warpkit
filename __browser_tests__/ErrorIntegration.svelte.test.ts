/**
 * Integration Test: WarpKit Error Flow
 *
 * Tests the complete error handling flow:
 * 1. WarpKit navigation triggers error
 * 2. Error is captured by errorStore
 * 3. ErrorOverlay displays the error to the user
 */
import { render } from 'vitest-browser-svelte';
import { expect, test, describe, beforeEach } from 'vitest';
import TestErrorIntegration from './TestErrorIntegration.svelte';
import { errorStore } from '../src/errors/error-store';

describe('WarpKit Error Integration', () => {
	beforeEach(() => {
		errorStore.clearHistory();
	});

	describe('startup', () => {
		test('should start without errors on valid route', async () => {
			const screen = render(TestErrorIntegration);

			// Wait for WarpKit to start
			await expect.element(screen.getByTestId('is-started')).toHaveTextContent('true');

			// No error should be shown
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('false');

			// Error overlay should not be present
			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay).toBeNull();
		});
	});

	describe('navigation errors', () => {
		test('should show error overlay when component load fails', async () => {
			const screen = render(TestErrorIntegration);

			// Wait for startup
			await expect.element(screen.getByTestId('is-started')).toHaveTextContent('true');

			// Navigate to failing route
			await screen.getByTestId('nav-fail-load').click();

			// Wait for error to appear
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('true');

			// Error message should contain the original error and route context
			const errorMsg = screen.container.querySelector('[data-testid="error-message"]');
			expect(errorMsg?.textContent).toContain('Component load failed!');
			expect(errorMsg?.textContent).toContain('/fail-load');

			// Error overlay should be visible
			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay).not.toBeNull();

			// Error message should be displayed in overlay with enhanced context
			const messageEl = screen.container.querySelector('.warpkit-error-message');
			expect(messageEl?.textContent).toContain('Component load failed!');
		});

		test('should show error overlay for network errors', async () => {
			const screen = render(TestErrorIntegration);

			// Wait for startup
			await expect.element(screen.getByTestId('is-started')).toHaveTextContent('true');

			// Navigate to network failure route
			await screen.getByTestId('nav-fail-network').click();

			// Wait for error to appear
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('true');

			// Should contain the network error message
			const errorMsg = screen.container.querySelector('[data-testid="error-message"]');
			expect(errorMsg?.textContent).toContain('Failed to fetch');
		});

		test('should allow dismissing error and continuing', async () => {
			const screen = render(TestErrorIntegration);

			// Wait for startup
			await expect.element(screen.getByTestId('is-started')).toHaveTextContent('true');

			// Trigger error
			await screen.getByTestId('nav-fail-load').click();
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('true');

			// Dismiss the error using the overlay button
			const dismissBtn = screen.container.querySelector('.warpkit-btn-secondary');
			expect(dismissBtn).not.toBeNull();
			dismissBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

			// Error should be cleared
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('false');

			// Overlay should be gone
			const overlay = screen.container.querySelector('.warpkit-error-overlay');
			expect(overlay).toBeNull();
		});

		test('should allow navigation after dismissing error', async () => {
			const screen = render(TestErrorIntegration);

			// Wait for startup
			await expect.element(screen.getByTestId('is-started')).toHaveTextContent('true');

			// Trigger error
			await screen.getByTestId('nav-fail-load').click();
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('true');

			// Dismiss error
			const dismissBtn = screen.container.querySelector('.warpkit-btn-secondary');
			dismissBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('false');

			// Navigate to success route
			await screen.getByTestId('nav-success').click();

			// Should not have error
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('false');
		});
	});

	describe('error context', () => {
		test('should include navigation context in error', async () => {
			const screen = render(TestErrorIntegration);

			// Wait for startup
			await expect.element(screen.getByTestId('is-started')).toHaveTextContent('true');

			// Navigate to failing route
			await screen.getByTestId('nav-fail-load').click();

			// Wait for error
			await expect.element(screen.getByTestId('has-error')).toHaveTextContent('true');

			// Check error store has context
			let errorContext: Record<string, unknown> | undefined;
			const unsubscribe = errorStore.subscribe((state) => {
				errorContext = state.currentError?.context;
			});
			unsubscribe();

			expect(errorContext).toBeDefined();
			expect(errorContext?.requestedPath).toBe('/fail-load');
			// NavigationErrorCode.LOAD_FAILED = 6
			expect(errorContext?.code).toBe(6);
		});
	});
});
