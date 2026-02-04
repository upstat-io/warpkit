/**
 * Browser Tests: useForm hook
 *
 * Tests for the useForm hook form state management functionality.
 * Uses Playwright browser mode since hooks require Svelte component context.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from 'vitest-browser-svelte';
import UseFormTestWrapper from './UseFormTestWrapper.svelte';
import type { StandardSchema } from '@warpkit/validation';

// Helper to create a mock StandardSchema
function createMockSchema<T extends object>(
	validateFn: (value: T) => { value: T } | { issues: Array<{ path: string[]; message: string }> }
): StandardSchema<T> {
	return {
		'~standard': {
			version: 1,
			vendor: 'test',
			validate: validateFn
		}
	} as StandardSchema<T>;
}

interface FormValues {
	name: string;
	email: string;
}

describe('useForm', () => {
	afterEach(() => {
		cleanup();
	});

	describe('initial state', () => {
		it('should initialize with provided initial values', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: 'john@example.com' }
				}
			});

			await expect.element(screen.getByTestId('name')).toHaveValue('John');
			await expect.element(screen.getByTestId('email')).toHaveValue('john@example.com');
		});

		it('should start with isValid true when no validation', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' }
				}
			});

			await expect.element(screen.getByTestId('isValid')).toHaveTextContent('true');
		});

		it('should start with isDirty false', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: '' }
				}
			});

			await expect.element(screen.getByTestId('isDirty')).toHaveTextContent('false');
		});

		it('should start with submitCount 0', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' }
				}
			});

			await expect.element(screen.getByTestId('submitCount')).toHaveTextContent('0');
		});

		it('should start with isSubmitted false', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' }
				}
			});

			await expect.element(screen.getByTestId('isSubmitted')).toHaveTextContent('false');
		});
	});

	describe('validation on submit', () => {
		it('should show errors on submit with invalid data', async () => {
			const schema = createMockSchema<FormValues>((value) => {
				if (!value.name) {
					return { issues: [{ path: ['name'], message: 'Name is required' }] };
				}
				return { value };
			});

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' },
					schema
				}
			});

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('Name is required');
		});

		it('should set isSubmitted to true after submit attempt', async () => {
			const schema = createMockSchema<FormValues>((value) => {
				if (!value.name) {
					return { issues: [{ path: ['name'], message: 'Required' }] };
				}
				return { value };
			});

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' },
					schema
				}
			});

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('isSubmitted')).toHaveTextContent('true');
		});

		it('should increment submitCount on each submit', async () => {
			const onSubmit = vi.fn();
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: 'john@example.com' },
					onSubmit
				}
			});

			await expect.element(screen.getByTestId('submitCount')).toHaveTextContent('0');

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('submitCount')).toHaveTextContent('1');

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('submitCount')).toHaveTextContent('2');
		});

		it('should call onSubmit when validation passes', async () => {
			const onSubmit = vi.fn();
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: 'john@example.com' },
					onSubmit
				}
			});

			await screen.getByTestId('submit').click();

			// Wait for submit to complete
			await expect.element(screen.getByTestId('isSubmitting')).toHaveTextContent('false');
			expect(onSubmit).toHaveBeenCalledTimes(1);
			expect(onSubmit).toHaveBeenCalledWith({ name: 'John', email: 'john@example.com' });
		});

		it('should not call onSubmit when validation fails', async () => {
			const onSubmit = vi.fn();
			const schema = createMockSchema<FormValues>((value) => {
				if (!value.name) {
					return { issues: [{ path: ['name'], message: 'Required' }] };
				}
				return { value };
			});

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' },
					schema,
					onSubmit
				}
			});

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('Required');
			expect(onSubmit).not.toHaveBeenCalled();
		});
	});

	describe('isSubmitting state', () => {
		it('should be false before and after submit completes', async () => {
			const onSubmit = vi.fn().mockResolvedValue(undefined);

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: 'john@example.com' },
					onSubmit
				}
			});

			// Initially not submitting
			await expect.element(screen.getByTestId('isSubmitting')).toHaveTextContent('false');

			// Submit and wait for it to complete
			await screen.getByTestId('submit').click();

			// Verify callback was called
			expect(onSubmit).toHaveBeenCalled();

			// After submit completes, should be false
			await expect.element(screen.getByTestId('isSubmitting')).toHaveTextContent('false');
		});
	});

	describe('submitError', () => {
		it('should capture error when onSubmit throws', async () => {
			const onSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: 'john@example.com' },
					onSubmit
				}
			});

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('submitError')).toHaveTextContent('Submit failed');
		});

		it('should set isSubmitting false after error', async () => {
			const onSubmit = vi.fn().mockRejectedValue(new Error('Failed'));

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: '' },
					onSubmit
				}
			});

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('isSubmitting')).toHaveTextContent('false');
		});
	});

	describe('reset', () => {
		it('should reset to initial values', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: 'john@example.com' }
				}
			});

			// Modify value
			const nameInput = screen.getByTestId('name');
			await nameInput.fill('Jane');
			await expect.element(nameInput).toHaveValue('Jane');

			// Reset
			await screen.getByTestId('reset').click();
			await expect.element(nameInput).toHaveValue('John');
		});

		it('should clear errors on reset', async () => {
			const schema = createMockSchema<FormValues>((value) => {
				if (!value.name) {
					return { issues: [{ path: ['name'], message: 'Required' }] };
				}
				return { value };
			});

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' },
					schema
				}
			});

			// Submit to trigger validation error
			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('Required');

			// Reset
			await screen.getByTestId('reset').click();
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('{}');
		});

		it('should reset isSubmitted to false', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: '' }
				}
			});

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('isSubmitted')).toHaveTextContent('true');

			await screen.getByTestId('reset').click();
			await expect.element(screen.getByTestId('isSubmitted')).toHaveTextContent('false');
		});

		it('should reset submitCount to 0', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: '' }
				}
			});

			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('submitCount')).toHaveTextContent('1');

			await screen.getByTestId('reset').click();
			await expect.element(screen.getByTestId('submitCount')).toHaveTextContent('0');
		});
	});

	describe('dirty state', () => {
		it('should set isDirty true when field changes', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: '' }
				}
			});

			await expect.element(screen.getByTestId('isDirty')).toHaveTextContent('false');

			await screen.getByTestId('name').fill('Jane');
			await expect.element(screen.getByTestId('isDirty')).toHaveTextContent('true');
		});

		it('should set isDirty false when field returns to initial', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: '' }
				}
			});

			await screen.getByTestId('name').fill('Jane');
			await expect.element(screen.getByTestId('isDirty')).toHaveTextContent('true');

			await screen.getByTestId('name').fill('John');
			await expect.element(screen.getByTestId('isDirty')).toHaveTextContent('false');
		});

		it('should track per-field dirty state', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: 'john@example.com' }
				}
			});

			await screen.getByTestId('name').fill('Jane');

			const dirty = screen.getByTestId('dirty');
			await expect.element(dirty).toHaveTextContent('"name":true');
		});
	});

	describe('touched state', () => {
		it('should track touched state on blur', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' }
				}
			});

			await expect.element(screen.getByTestId('touched')).toHaveTextContent('{}');

			// Focus and blur name field
			const nameInput = screen.getByTestId('name');
			await nameInput.click();
			nameInput.element().blur();

			await expect.element(screen.getByTestId('touched')).toHaveTextContent('"name":true');
		});
	});

	describe('warnings', () => {
		it('should display warnings from warner function', async () => {
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: 'test@test.com' },
					warners: {
						email: (value) => (!value ? 'Email recommended' : undefined)
					}
				}
			});

			// Clear email to trigger warning (initial has value, clearing triggers warner)
			await screen.getByTestId('email').fill('');

			await expect.element(screen.getByTestId('warnings')).toHaveTextContent('Email recommended');
		});

		it('should allow submit even with warnings', async () => {
			const onSubmit = vi.fn();
			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: '' },
					warners: {
						email: () => 'Email recommended'
					},
					onSubmit
				}
			});

			await screen.getByTestId('submit').click();
			expect(onSubmit).toHaveBeenCalled();
		});
	});

	describe('validation modes', () => {
		it('should validate on blur when mode is blur', async () => {
			const schema = createMockSchema<FormValues>((value) => {
				if (!value.name) {
					return { issues: [{ path: ['name'], message: 'Required' }] };
				}
				return { value };
			});

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' },
					schema,
					mode: 'blur'
				}
			});

			// Initially no errors
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('{}');

			// Focus and blur should trigger validation
			const nameInput = screen.getByTestId('name');
			await nameInput.click();
			nameInput.element().blur();

			await expect.element(screen.getByTestId('errors')).toHaveTextContent('Required');
		});

		it('should not validate before submit when mode is submit', async () => {
			const schema = createMockSchema<FormValues>((value) => {
				if (!value.name) {
					return { issues: [{ path: ['name'], message: 'Required' }] };
				}
				return { value };
			});

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' },
					schema,
					mode: 'submit'
				}
			});

			// Focus, blur - no validation
			const nameInput = screen.getByTestId('name');
			await nameInput.click();
			nameInput.element().blur();

			await expect.element(screen.getByTestId('errors')).toHaveTextContent('{}');

			// Submit triggers validation
			await screen.getByTestId('submit').click();
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('Required');
		});

		it('should validate on change when mode is change', async () => {
			const schema = createMockSchema<FormValues>((value) => {
				if (!value.name) {
					return { issues: [{ path: ['name'], message: 'Required' }] };
				}
				return { value };
			});

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: 'John', email: '' },
					schema,
					mode: 'change'
				}
			});

			// Clear the name - should trigger validation immediately
			await screen.getByTestId('name').fill('');
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('Required');
		});
	});

	describe('error clearing', () => {
		it('should clear error when field becomes valid', async () => {
			const schema = createMockSchema<FormValues>((value) => {
				if (!value.name) {
					return { issues: [{ path: ['name'], message: 'Required' }] };
				}
				return { value };
			});

			const screen = render(UseFormTestWrapper, {
				props: {
					initialValues: { name: '', email: '' },
					schema,
					mode: 'change'
				}
			});

			// Trigger error by typing then clearing
			await screen.getByTestId('name').fill('a');
			await screen.getByTestId('name').fill('');
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('Required');

			// Fix error
			await screen.getByTestId('name').fill('John');
			await expect.element(screen.getByTestId('errors')).toHaveTextContent('{}');
		});
	});
});
