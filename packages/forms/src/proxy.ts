/**
 * @warpkit/forms Deep Proxy
 *
 * Creates a deep proxy that intercepts all nested property sets,
 * enabling transparent bind:value support in Svelte 5.
 */

/**
 * Options for creating a deep proxy.
 */
export interface ProxyOptions {
	/**
	 * Called when any property is set on the proxy or nested objects.
	 * @param path - Dot notation path to the property (e.g., 'user.name')
	 * @param value - The new value being set
	 */
	onSet: (path: string, value: unknown) => void;

	/**
	 * Optional callback when any property is accessed.
	 * @param path - Dot notation path to the property
	 * @param value - The current value
	 */
	onGet?: (path: string, value: unknown) => void;
}

/**
 * Create a deep proxy that intercepts all nested property sets.
 * Used to enable transparent bind:value support in Svelte 5 forms.
 *
 * @param target - The object to proxy
 * @param options - Proxy callbacks for set/get operations
 * @param parentPath - Internal: parent path for nested proxies
 * @returns A proxy that intercepts all nested property sets
 *
 * @example
 * ```typescript
 * const data = { user: { name: 'John', age: 30 } };
 * const proxy = createDeepProxy(data, {
 *   onSet: (path, value) => {
 *     console.log(`Set ${path} = ${value}`);
 *   }
 * });
 *
 * proxy.user.name = 'Jane'; // Logs: "Set user.name = Jane"
 * proxy.user.age = 31;      // Logs: "Set user.age = 31"
 * ```
 */
export function createDeepProxy<T extends object>(target: T, options: ProxyOptions, parentPath = ''): T {
	// Handle null/undefined - return as-is
	if (target === null || target === undefined) {
		return target;
	}

	// Handle non-objects (primitives) - return as-is
	if (typeof target !== 'object') {
		return target;
	}

	return new Proxy(target, {
		get(obj, prop, receiver) {
			// Symbols pass through without any callback
			if (typeof prop === 'symbol') {
				return Reflect.get(obj, prop, receiver);
			}

			const value = Reflect.get(obj, prop, receiver);
			const path = parentPath ? `${parentPath}.${String(prop)}` : String(prop);

			// Call onGet callback if provided
			if (options.onGet) {
				options.onGet(path, value);
			}

			// Recursively proxy nested objects
			if (value !== null && typeof value === 'object') {
				return createDeepProxy(value as object, options, path);
			}

			return value;
		},

		set(obj, prop, value, receiver) {
			// Symbols pass through without callback
			if (typeof prop === 'symbol') {
				return Reflect.set(obj, prop, value, receiver);
			}

			const path = parentPath ? `${parentPath}.${String(prop)}` : String(prop);

			// Set the value first
			const result = Reflect.set(obj, prop, value, receiver);

			// Call onSet callback
			options.onSet(path, value);

			return result;
		}
	}) as T;
}
