/**
 * Safe JSON parsing utilities.
 *
 * Provides protection against prototype pollution attacks by sanitizing
 * parsed objects. This is a hot path - implementation optimized for O(1)
 * key lookups and single-pass traversal.
 *
 * @internal This module is internal to @warpkit/websocket
 */

/**
 * Keys that can trigger prototype pollution when used with Object.assign,
 * spread operators, or bracket notation assignment.
 *
 * - __proto__: Direct prototype setter
 * - constructor: Access to constructor.prototype
 * - prototype: Direct prototype property
 *
 * Set lookup is O(1).
 */
const DANGEROUS_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively sanitizes an object by removing prototype pollution keys.
 *
 * Performance characteristics:
 * - O(n) where n = total number of keys across all nested objects
 * - O(1) per-key lookup via Set
 * - Single pass, no repeated traversal
 * - Primitives, null, and built-in types return immediately (no allocation)
 *
 * @param obj - The object to sanitize (typically from JSON.parse)
 * @returns A new object with dangerous keys removed
 */
function sanitize<T>(obj: T): T {
	// Fast path: primitives and null pass through with no allocation
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}

	// Preserve built-in types that revivers might create
	// These have their own prototype and shouldn't be sanitized as plain objects
	if (
		obj instanceof Date ||
		obj instanceof RegExp ||
		obj instanceof Map ||
		obj instanceof Set ||
		obj instanceof Error
	) {
		return obj;
	}

	// Arrays: map with sanitization (allocates new array)
	if (Array.isArray(obj)) {
		return obj.map(sanitize) as T;
	}

	// Objects: single-pass copy, skipping dangerous keys
	const result: Record<string, unknown> = {};
	const keys = Object.keys(obj);

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]!;
		// O(1) Set lookup
		if (DANGEROUS_KEYS.has(key)) {
			continue;
		}
		result[key] = sanitize((obj as Record<string, unknown>)[key]);
	}

	return result as T;
}

/**
 * Safe JSON parser that sanitizes output to prevent prototype pollution.
 *
 * @internal
 */
export const Json = {
	/**
	 * Parse JSON string and sanitize the result.
	 *
	 * @param text - JSON string to parse
	 * @param reviver - Optional reviver function (applied before sanitization)
	 * @returns Sanitized parsed value
	 * @throws SyntaxError if the string is not valid JSON
	 */
	parse<T = unknown>(text: string, reviver?: (key: string, value: unknown) => unknown): T {
		const parsed = reviver ? JSON.parse(text, reviver) : JSON.parse(text);
		return sanitize(parsed);
	}
};
