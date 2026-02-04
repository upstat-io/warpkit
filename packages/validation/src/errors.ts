import type { StandardIssue } from './standard-schema';

/**
 * Error thrown when validation fails.
 */
export class ValidationError extends Error {
	public readonly issues: ReadonlyArray<StandardIssue>;

	public constructor(issues: ReadonlyArray<StandardIssue>) {
		const message = `Validation failed: ${issues.map((i) => i.message).join(', ')}`;
		super(message);
		this.name = 'ValidationError';
		this.issues = issues;
	}
}
