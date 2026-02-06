import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				dev: true,
				runes: true
			}
		})
	],
	resolve: {
		conditions: ['browser'],
		alias: {
			'@warpkit/errors': resolve(root, 'packages/errors/src/index.ts'),
			'@warpkit/data': resolve(root, 'packages/data/src/index.ts'),
			'@warpkit/cache': resolve(root, 'packages/cache/src/index.ts'),
			'@warpkit/state-machine/svelte': resolve(root, 'packages/state-machine/src/svelte/index.ts'),
			'@warpkit/state-machine': resolve(root, 'packages/state-machine/src/index.ts'),
			'@warpkit/validation': resolve(root, 'packages/validation/src/index.ts'),
			'@warpkit/forms/testing': resolve(root, 'packages/forms/src/testing/index.ts'),
			'@warpkit/forms': resolve(root, 'packages/forms/src/index.ts')
		}
	},
	test: {
		include: ['__browser_tests__/**/*.svelte.test.ts', 'packages/**/*.svelte.test.ts'],
		testTimeout: 1000,
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }],
			headless: true
		},
		setupFiles: ['./vitest-setup-client.ts']
	}
});
