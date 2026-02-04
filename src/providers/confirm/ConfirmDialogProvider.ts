/**
 * ConfirmDialogProvider
 *
 * Default confirmation dialog provider wrapping window.confirm.
 */
import type { ConfirmDialogProvider } from '../interfaces';

/**
 * Default implementation using window.confirm.
 */
export class DefaultConfirmDialogProvider implements ConfirmDialogProvider {
	readonly id = 'confirmDialog' as const;

	async confirm(message: string): Promise<boolean> {
		// Handle unavailable window.confirm (SSR, testing)
		if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
			return true;
		}

		return window.confirm(message);
	}
}
