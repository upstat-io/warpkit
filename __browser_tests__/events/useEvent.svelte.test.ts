/**
 * Browser Tests: useEvent hook
 *
 * Tests for the useEvent hook with automatic cleanup via $effect.
 * Uses Playwright browser mode since hooks require Svelte component context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import UseEventTestWrapper from './UseEventTestWrapper.svelte';

describe('useEvent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	describe('subscription', () => {
		it('should subscribe to events and receive payload', async () => {
			const screen = render(UseEventTestWrapper, {
				props: { event: 'auth:signed-in' }
			});

			// Initially no events received
			const receivedCount = screen.getByTestId('received-count');
			await expect.element(receivedCount).toHaveTextContent('0');

			// Emit event
			const emitButton = screen.getByTestId('emit-button');
			await emitButton.click();

			// Handler should have been called
			await expect.element(receivedCount).toHaveTextContent('1');
		});

		it('should receive multiple events', async () => {
			const screen = render(UseEventTestWrapper, {
				props: { event: 'auth:signed-in' }
			});

			const receivedCount = screen.getByTestId('received-count');
			const emitButton = screen.getByTestId('emit-button');

			// Emit multiple events
			await emitButton.click();
			await emitButton.click();
			await emitButton.click();

			// Should have received all events
			await expect.element(receivedCount).toHaveTextContent('3');
		});

		it('should work with void payload events', async () => {
			const screen = render(UseEventTestWrapper, {
				props: { event: 'auth:signed-out' }
			});

			const receivedCount = screen.getByTestId('received-count');
			await expect.element(receivedCount).toHaveTextContent('0');

			// Emit void event
			const emitButton = screen.getByTestId('emit-button');
			await emitButton.click();

			// Handler should have been called
			await expect.element(receivedCount).toHaveTextContent('1');
		});
	});

	describe('cleanup', () => {
		it('should unsubscribe when component is destroyed', async () => {
			const screen = render(UseEventTestWrapper, {
				props: { event: 'auth:signed-in', showComponent: true }
			});

			const receivedCount = screen.getByTestId('received-count');
			const emitButton = screen.getByTestId('emit-button');
			const toggleButton = screen.getByTestId('toggle-component');

			// Emit event while component exists
			await emitButton.click();
			await expect.element(receivedCount).toHaveTextContent('1');

			// Destroy component (triggers $effect cleanup)
			await toggleButton.click();

			// Reset count to verify no new events received
			const resetButton = screen.getByTestId('reset-count');
			await resetButton.click();
			await expect.element(receivedCount).toHaveTextContent('0');

			// Emit after component destroyed
			await emitButton.click();

			// Handler should NOT have been called (subscription cleaned up)
			await expect.element(receivedCount).toHaveTextContent('0');
		});

		it('should re-subscribe when component is recreated', async () => {
			const screen = render(UseEventTestWrapper, {
				props: { event: 'auth:signed-in', showComponent: true }
			});

			const receivedCount = screen.getByTestId('received-count');
			const emitButton = screen.getByTestId('emit-button');
			const toggleButton = screen.getByTestId('toggle-component');
			const resetButton = screen.getByTestId('reset-count');

			// Destroy component
			await toggleButton.click();
			await resetButton.click();

			// Recreate component
			await toggleButton.click();

			// Emit event
			await emitButton.click();

			// Handler should be called (re-subscribed)
			await expect.element(receivedCount).toHaveTextContent('1');
		});
	});

	describe('enabled option', () => {
		it('should not subscribe when enabled=false', async () => {
			const screen = render(UseEventTestWrapper, {
				props: { event: 'auth:signed-in', enabled: false }
			});

			const receivedCount = screen.getByTestId('received-count');
			const emitButton = screen.getByTestId('emit-button');

			// Emit event while disabled
			await emitButton.click();

			// Handler should NOT have been called
			await expect.element(receivedCount).toHaveTextContent('0');
		});

		it('should subscribe when enabled changes from false to true', async () => {
			const screen = render(UseEventTestWrapper, {
				props: { event: 'auth:signed-in', enabled: false }
			});

			const receivedCount = screen.getByTestId('received-count');
			const emitButton = screen.getByTestId('emit-button');
			const toggleEnabled = screen.getByTestId('toggle-enabled');

			// Emit while disabled - should not receive
			await emitButton.click();
			await expect.element(receivedCount).toHaveTextContent('0');

			// Enable subscription
			await toggleEnabled.click();

			// Verify enabled is now true
			const enabledState = screen.getByTestId('enabled-state');
			await expect.element(enabledState).toHaveTextContent('true');

			// Emit while enabled - should receive
			await emitButton.click();
			await expect.element(receivedCount).toHaveTextContent('1');
		});

		it('should unsubscribe when enabled changes from true to false', async () => {
			const screen = render(UseEventTestWrapper, {
				props: { event: 'auth:signed-in', enabled: true }
			});

			const receivedCount = screen.getByTestId('received-count');
			const emitButton = screen.getByTestId('emit-button');
			const toggleEnabled = screen.getByTestId('toggle-enabled');
			const resetButton = screen.getByTestId('reset-count');

			// Emit while enabled - should receive
			await emitButton.click();
			await expect.element(receivedCount).toHaveTextContent('1');

			// Disable subscription
			await toggleEnabled.click();

			// Reset count
			await resetButton.click();
			await expect.element(receivedCount).toHaveTextContent('0');

			// Emit while disabled - should NOT receive
			await emitButton.click();
			await expect.element(receivedCount).toHaveTextContent('0');
		});
	});
});
