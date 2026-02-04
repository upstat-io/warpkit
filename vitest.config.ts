import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@warpkit/data': './packages/data/src/index.ts',
			'@warpkit/cache': './packages/cache/src/index.ts',
			'@warpkit/state-machine': './packages/state-machine/src/index.ts',
			'@warpkit/state-machine/svelte': './packages/state-machine/src/svelte/index.ts',
			'@warpkit/websocket': './packages/websocket/src/index.ts',
			'@warpkit/validation': './packages/validation/src/index.ts',
			'@warpkit/forms': './packages/forms/src/index.ts',
			'@warpkit/forms/testing': './packages/forms/src/testing/index.ts'
		}
	},
	test: {
		include: ['src/**/*.spec.ts', 'packages/**/*.spec.ts'],
		exclude: [
			'**/*.svelte.test.ts',
			'**/*.browser.spec.ts',
			'src/**/__tests__/**/*.spec.ts', // Bun tests use bun:test, not vitest
			'packages/**/__tests__/**/*.spec.ts' // Bun tests use bun:test, not vitest
		]
	}
});
