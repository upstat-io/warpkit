import type { StandardIssue } from './standard-schema';
/**
 * Error thrown when validation fails.
 */
export declare class ValidationError extends Error {
    readonly issues: ReadonlyArray<StandardIssue>;
    constructor(issues: ReadonlyArray<StandardIssue>);
}
