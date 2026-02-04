/**
 * resolveProviders
 *
 * Dependency-aware provider initialization.
 * Uses topological sort to initialize providers in correct order.
 */
import type {
	Provider,
	ProviderRegistry,
	ResolvedProviders,
	BrowserProvider,
	ConfirmDialogProvider,
	StorageProvider,
	WarpKitCore
} from '../providers/interfaces';
import { DefaultBrowserProvider } from '../providers/browser/BrowserProvider';
import { DefaultConfirmDialogProvider } from '../providers/confirm/ConfirmDialogProvider';
import { DefaultStorageProvider } from '../providers/storage/StorageProvider';

/**
 * Error thrown when circular dependencies detected.
 */
export class CircularDependencyError extends Error {
	constructor(cycle: string[]) {
		super(`Circular dependency detected: ${cycle.join(' → ')}`);
		this.name = 'CircularDependencyError';
	}
}

/**
 * Error thrown when a dependency is missing.
 */
export class MissingProviderError extends Error {
	constructor(providerId: string, dependencyId: string) {
		super(`Provider '${providerId}' depends on '${dependencyId}' which is not registered`);
		this.name = 'MissingProviderError';
	}
}

/**
 * Error thrown when provider key doesn't match provider.id.
 */
export class ProviderKeyMismatchError extends Error {
	constructor(key: string, id: string) {
		super(`Provider registered with key '${key}' has id '${id}' - key must match id`);
		this.name = 'ProviderKeyMismatchError';
	}
}

/**
 * Resolve and initialize providers with dependency ordering.
 *
 * @param registry - Partial registry of providers (defaults applied for missing core providers)
 * @param warpkit - WarpKitCore instance for provider initialization
 * @returns Resolved providers with all core providers guaranteed
 */
export async function resolveProviders(
	registry: ProviderRegistry,
	warpkit: WarpKitCore
): Promise<ResolvedProviders> {
	// Apply defaults for core providers
	const providers: ProviderRegistry = {
		browser: registry.browser ?? new DefaultBrowserProvider(),
		confirmDialog: registry.confirmDialog ?? new DefaultConfirmDialogProvider(),
		storage: registry.storage ?? new DefaultStorageProvider(),
		...registry
	};

	// Validate key-id matches
	for (const [key, provider] of Object.entries(providers)) {
		if (provider && provider.id !== key) {
			throw new ProviderKeyMismatchError(key, provider.id);
		}
	}

	// Build dependency graph
	const providerList = Object.values(providers).filter((p): p is Provider => p !== undefined);
	const providerMap = new Map<string, Provider>();

	for (const provider of providerList) {
		providerMap.set(provider.id, provider);
	}

	// Validate dependencies exist
	for (const provider of providerList) {
		if (provider.dependsOn) {
			for (const depId of provider.dependsOn) {
				if (!providerMap.has(depId)) {
					throw new MissingProviderError(provider.id, depId);
				}
			}
		}
	}

	// Topological sort
	const sorted = topologicalSort(providerList);

	// Initialize in order (with error context for debugging)
	for (const provider of sorted) {
		if (provider.initialize) {
			try {
				await provider.initialize(warpkit);
			} catch (error) {
				throw new Error(
					`Provider '${provider.id}' failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error }
				);
			}
		}
	}

	// Build resolved providers with type assertions for core providers
	return {
		browser: providers.browser as BrowserProvider,
		confirmDialog: providers.confirmDialog as ConfirmDialogProvider,
		storage: providers.storage as StorageProvider,
		...Object.fromEntries(providerList.map((p) => [p.id, p]))
	};
}

/**
 * Topological sort using Kahn's algorithm.
 * Detects cycles and throws CircularDependencyError.
 */
function topologicalSort(providers: Provider[]): Provider[] {
	const providerMap = new Map<string, Provider>();
	const inDegree = new Map<string, number>();
	const dependents = new Map<string, string[]>();

	// Initialize
	for (const provider of providers) {
		providerMap.set(provider.id, provider);
		inDegree.set(provider.id, 0);
		dependents.set(provider.id, []);
	}

	// Build graph
	for (const provider of providers) {
		if (provider.dependsOn) {
			for (const depId of provider.dependsOn) {
				// Increment in-degree (number of dependencies)
				inDegree.set(provider.id, (inDegree.get(provider.id) ?? 0) + 1);
				// Track dependents
				const deps = dependents.get(depId) ?? [];
				deps.push(provider.id);
				dependents.set(depId, deps);
			}
		}
	}

	// Find providers with no dependencies
	const queue: string[] = [];
	for (const [id, degree] of inDegree) {
		if (degree === 0) {
			queue.push(id);
		}
	}

	const sorted: Provider[] = [];

	while (queue.length > 0) {
		const id = queue.shift()!;
		const provider = providerMap.get(id)!;
		sorted.push(provider);

		// Reduce in-degree for dependents
		for (const dependentId of dependents.get(id) ?? []) {
			const newDegree = (inDegree.get(dependentId) ?? 1) - 1;
			inDegree.set(dependentId, newDegree);
			if (newDegree === 0) {
				queue.push(dependentId);
			}
		}
	}

	// Check for cycle
	if (sorted.length !== providers.length) {
		// Find the cycle for error message
		const remaining = providers.filter((p) => !sorted.includes(p));
		const cycle = findCycle(remaining);
		throw new CircularDependencyError(cycle);
	}

	return sorted;
}

/**
 * Find a cycle in the remaining providers (for error message).
 */
function findCycle(providers: Provider[]): string[] {
	const visited = new Set<string>();
	const stack = new Set<string>();
	const path: string[] = [];

	function dfs(id: string): string[] | null {
		if (stack.has(id)) {
			// Found cycle - extract it from path
			const cycleStart = path.indexOf(id);
			return [...path.slice(cycleStart), id];
		}
		if (visited.has(id)) return null;

		visited.add(id);
		stack.add(id);
		path.push(id);

		const provider = providers.find((p) => p.id === id);
		if (provider?.dependsOn) {
			for (const depId of provider.dependsOn) {
				const cycle = dfs(depId);
				if (cycle) return cycle;
			}
		}

		stack.delete(id);
		path.pop();
		return null;
	}

	for (const provider of providers) {
		const cycle = dfs(provider.id);
		if (cycle) return cycle;
	}

	return providers.map((p) => p.id);
}
