/**
 * Test Utility: mockForms
 *
 * Provides utilities for testing form submission and unsaved changes handling.
 *
 * Usage:
 * ```typescript
 * import { createMockFormSubmit, waitForFormSuccess } from '@upstat/warpkit/testing';
 *
 * const mockSubmit = createMockFormSubmit({ simulateSuccess: true });
 * render(MyForm, { props: { onSubmit: mockSubmit.handler } });
 *
 * // Submit form
 * await user.click(submitButton);
 *
 * // Wait for success
 * await waitForFormSuccess(mockSubmit);
 * ```
 */

import { vi, type Mock } from 'vitest';

/**
 * Result type for mock form submissions.
 * Used by test utilities to track form submission outcomes.
 */
export interface FormSubmitResult {
	status: 'success' | 'error';
	errors?: string[];
}

export interface MockFormSubmit {
	/** The mock handler function to pass as onSubmit prop */
	handler: Mock<(data: Record<string, unknown>) => Promise<FormSubmitResult>>;

	/** Get all submission data */
	getSubmissions: () => Array<{ data: Record<string, unknown>; timestamp: Date }>;

	/** Get the last submitted data */
	getLastSubmission: () => Record<string, unknown> | undefined;

	/** Wait for a submission to occur */
	waitForSubmission: (timeout?: number) => Promise<Record<string, unknown>>;

	/** Check if form was submitted */
	wasSubmitted: () => boolean;

	/** Get submission count */
	getSubmissionCount: () => number;

	/** Reset the mock */
	reset: () => void;
}

export interface MockFormSubmitOptions {
	/** Simulate successful submission */
	simulateSuccess?: boolean;

	/** Simulate error response */
	simulateError?: string | string[];

	/** Simulate network delay (ms) */
	delay?: number;

	/** Custom result to return */
	result?: FormSubmitResult;
}

/**
 * Create a mock form submit handler
 *
 * @param options - Configuration for mock behavior
 * @returns MockFormSubmit with handler and utilities
 */
export function createMockFormSubmit(options: MockFormSubmitOptions = {}): MockFormSubmit {
	const submissions: Array<{ data: Record<string, unknown>; timestamp: Date }> = [];
	let resolveWaitingSubmission: ((data: Record<string, unknown>) => void) | null = null;

	const handler = vi.fn(async (data: Record<string, unknown>): Promise<FormSubmitResult> => {
		submissions.push({ data, timestamp: new Date() });

		if (resolveWaitingSubmission) {
			resolveWaitingSubmission(data);
			resolveWaitingSubmission = null;
		}

		// Apply delay if configured
		if (options.delay) {
			await new Promise((resolve) => setTimeout(resolve, options.delay));
		}

		// Return custom result if provided
		if (options.result) {
			return options.result;
		}

		// Simulate error
		if (options.simulateError) {
			const errors = Array.isArray(options.simulateError) ? options.simulateError : [options.simulateError];
			return { status: 'error', errors };
		}

		// Simulate success (default)
		if (options.simulateSuccess !== false) {
			return { status: 'success' };
		}

		return { status: 'success' };
	});

	return {
		handler,
		getSubmissions: () => [...submissions],
		getLastSubmission: () => submissions[submissions.length - 1]?.data,
		waitForSubmission: (timeout = 5000) => {
			return new Promise((resolve, reject) => {
				// If already submitted, return last
				if (submissions.length > 0) {
					resolve(submissions[submissions.length - 1].data);
					return;
				}

				resolveWaitingSubmission = resolve;

				setTimeout(() => {
					if (resolveWaitingSubmission === resolve) {
						resolveWaitingSubmission = null;
						reject(new Error('Timeout waiting for form submission'));
					}
				}, timeout);
			});
		},
		wasSubmitted: () => submissions.length > 0,
		getSubmissionCount: () => submissions.length,
		reset: () => {
			handler.mockClear();
			submissions.length = 0;
			resolveWaitingSubmission = null;
		}
	};
}

/**
 * Wait for a form to show success state
 *
 * @param mockSubmit - The mock submit handler
 * @param timeout - Max time to wait
 */
export async function waitForFormSuccess(mockSubmit: MockFormSubmit, timeout = 5000): Promise<void> {
	const start = Date.now();

	while (Date.now() - start < timeout) {
		if (mockSubmit.wasSubmitted()) {
			const result = await mockSubmit.handler.mock.results[mockSubmit.getSubmissionCount() - 1]?.value;
			if (result?.status === 'success') {
				return;
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	throw new Error('Timeout waiting for form success');
}

/**
 * Wait for a form to show error state
 *
 * @param mockSubmit - The mock submit handler
 * @param timeout - Max time to wait
 */
export async function waitForFormError(mockSubmit: MockFormSubmit, timeout = 5000): Promise<string[]> {
	const start = Date.now();

	while (Date.now() - start < timeout) {
		if (mockSubmit.wasSubmitted()) {
			const result = await mockSubmit.handler.mock.results[mockSubmit.getSubmissionCount() - 1]?.value;
			if (result?.status === 'error' && result.errors) {
				return result.errors;
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	throw new Error('Timeout waiting for form error');
}

export interface MockBlockerHandler {
	/** Mock for onblock event handler */
	handler: Mock<(event: { detail: { context: unknown; proceed: () => void } }) => void>;

	/** The last captured proceed function */
	getProceed: () => (() => void) | undefined;

	/** The last captured context */
	getContext: () => unknown | undefined;

	/** Call proceed to allow navigation */
	proceed: () => void;

	/** Reset the mock */
	reset: () => void;
}

/**
 * Create a mock blocker handler for UnsavedChangesGuard testing
 *
 * @returns MockBlockerHandler
 */
export function createMockBlockerHandler(): MockBlockerHandler {
	let lastProceed: (() => void) | undefined;
	let lastContext: unknown | undefined;

	const handler = vi.fn((event: { detail: { context: unknown; proceed: () => void } }) => {
		lastContext = event.detail.context;
		lastProceed = event.detail.proceed;
	});

	return {
		handler,
		getProceed: () => lastProceed,
		getContext: () => lastContext,
		proceed: () => {
			if (lastProceed) {
				lastProceed();
			}
		},
		reset: () => {
			handler.mockClear();
			lastProceed = undefined;
			lastContext = undefined;
		}
	};
}

/**
 * Mock window.confirm for testing browser confirm fallback
 *
 * @param returnValue - What confirm should return
 * @returns Spy that can be restored
 */
export function mockWindowConfirm(returnValue: boolean) {
	return vi.spyOn(window, 'confirm').mockReturnValue(returnValue);
}
