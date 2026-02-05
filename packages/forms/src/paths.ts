/**
 * @warpkit/forms Path Utilities
 *
 * Functions for accessing and manipulating nested values in objects
 * using dot notation paths. All functions are pure and immutable.
 */

/**
 * Get a value from a nested object using dot notation path.
 *
 * @param obj - The object to read from
 * @param path - Dot notation path (e.g., "user.address.city" or "items.0.name")
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * ```typescript
 * getPath({ user: { name: 'John' } }, 'user.name'); // 'John'
 * getPath({ items: [1, 2, 3] }, 'items.1'); // 2
 * getPath({ a: 1 }, 'b'); // undefined
 * getPath({ a: { b: 1 } }, ''); // { a: { b: 1 } }
 * ```
 */
export function getPath<T>(obj: T, path: string): unknown {
	if (!path) return obj;

	const parts = path.split('.');
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}

/**
 * Set a value in a nested object using dot notation path.
 * Returns a new object - the original is not modified.
 *
 * @param obj - The object to update
 * @param path - Dot notation path (e.g., "user.address.city" or "items.0.name")
 * @param value - The value to set
 * @returns A new object with the value set at the path
 *
 * @example
 * ```typescript
 * setPath({ user: { name: 'John' } }, 'user.name', 'Jane');
 * // { user: { name: 'Jane' } }
 *
 * setPath({ items: [1, 2] }, 'items.1', 5);
 * // { items: [1, 5] }
 *
 * setPath({}, 'a.b.c', 1);
 * // { a: { b: { c: 1 } } }
 * ```
 */
export function setPath<T>(obj: T, path: string, value: unknown): T {
	if (!path) return value as T;

	const parts = path.split('.');
	// Use JSON clone to handle Svelte 5 reactive proxies that structuredClone can't handle
	const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;

	let current: Record<string, unknown> = result;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		const nextPart = parts[i + 1];

		// Determine if next level should be array or object
		const isNextArray = /^\d+$/.test(nextPart);

		if (current[part] === null || current[part] === undefined) {
			current[part] = isNextArray ? [] : {};
		} else if (typeof current[part] !== 'object') {
			// Overwrite primitive with object/array
			current[part] = isNextArray ? [] : {};
		} else {
			// Clone the existing object/array to maintain immutability
			current[part] = Array.isArray(current[part])
				? [...(current[part] as unknown[])]
				: { ...(current[part] as Record<string, unknown>) };
		}

		current = current[part] as Record<string, unknown>;
	}

	const lastPart = parts[parts.length - 1];
	current[lastPart] = value;

	return result as T;
}

/**
 * Convert a path array to a dot notation string.
 *
 * @param path - Array of path segments (strings or numbers)
 * @returns Dot notation string
 *
 * @example
 * ```typescript
 * pathToString(['user', 'name']); // 'user.name'
 * pathToString(['items', 0, 'id']); // 'items.0.id'
 * pathToString([]); // ''
 * pathToString(undefined); // ''
 * ```
 */
export function pathToString(path: (string | number)[] | undefined): string {
	if (!path || path.length === 0) return '';
	return path.join('.');
}

/**
 * Get all leaf paths from an object.
 * A leaf is a primitive value (string, number, boolean, null) or
 * an empty object/array.
 *
 * @param obj - The object to traverse
 * @param prefix - Internal: current path prefix
 * @returns Array of dot notation paths to all leaf values
 *
 * @example
 * ```typescript
 * getAllPaths({ user: { name: 'John', age: 30 } });
 * // ['user.name', 'user.age']
 *
 * getAllPaths({ items: [1, 2] });
 * // ['items.0', 'items.1']
 *
 * getAllPaths({ a: { b: { c: 1 } } });
 * // ['a.b.c']
 *
 * getAllPaths({});
 * // []
 * ```
 */
export function getAllPaths(obj: unknown, prefix = ''): string[] {
	// Handle non-objects
	if (obj === null || obj === undefined || typeof obj !== 'object') {
		return [];
	}

	const paths: string[] = [];
	const entries = Object.entries(obj as Record<string, unknown>);

	// Empty object/array = no paths
	if (entries.length === 0) {
		return [];
	}

	for (const [key, value] of entries) {
		const currentPath = prefix ? `${prefix}.${key}` : key;

		if (value === null || value === undefined || typeof value !== 'object') {
			// Leaf value (primitive or null/undefined)
			paths.push(currentPath);
		} else if (Array.isArray(value)) {
			if (value.length === 0) {
				// Empty array is a leaf
				paths.push(currentPath);
			} else {
				// Recurse into array elements
				for (let i = 0; i < value.length; i++) {
					const elementPath = `${currentPath}.${i}`;
					const element = value[i];

					if (element === null || element === undefined || typeof element !== 'object') {
						paths.push(elementPath);
					} else {
						const nestedPaths = getAllPaths(element, elementPath);
						if (nestedPaths.length === 0) {
							// Empty object in array
							paths.push(elementPath);
						} else {
							paths.push(...nestedPaths);
						}
					}
				}
			}
		} else {
			// Object - recurse
			const nestedPaths = getAllPaths(value, currentPath);
			if (nestedPaths.length === 0) {
				// Empty object
				paths.push(currentPath);
			} else {
				paths.push(...nestedPaths);
			}
		}
	}

	return paths;
}

/**
 * Compute a structural signature for an object.
 *
 * This signature changes only when the structure changes (keys added/removed,
 * array lengths changed), NOT when values change. Used for caching getAllPaths()
 * results to avoid O(n) traversal on every value change.
 *
 * @param obj - Object to compute signature for
 * @param prefix - Internal: path prefix for recursion
 * @returns A string that uniquely identifies the object's structure
 *
 * @example
 * ```typescript
 * // Same structure = same signature
 * getStructuralSignature({ a: 1, b: 2 }) === getStructuralSignature({ a: 99, b: 100 })
 *
 * // Different structure = different signature
 * getStructuralSignature({ a: 1 }) !== getStructuralSignature({ a: 1, b: 2 })
 * getStructuralSignature({ items: [1] }) !== getStructuralSignature({ items: [1, 2] })
 * ```
 */
export function getStructuralSignature(obj: unknown, prefix = ''): string {
	if (obj === null || obj === undefined || typeof obj !== 'object') {
		return prefix || '_leaf';
	}

	if (Array.isArray(obj)) {
		// For arrays, include length and recurse into elements
		const parts = [`${prefix}[${obj.length}]`];
		for (let i = 0; i < obj.length; i++) {
			parts.push(getStructuralSignature(obj[i], `${prefix}.${i}`));
		}
		return parts.join('|');
	}

	// For objects, include sorted keys and recurse
	const keys = Object.keys(obj).sort();
	const parts = [prefix + '{' + keys.join(',') + '}'];
	for (const key of keys) {
		parts.push(getStructuralSignature((obj as Record<string, unknown>)[key], `${prefix}.${key}`));
	}
	return parts.join('|');
}
