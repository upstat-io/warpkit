import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

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
			'@warpkit/errors': './packages/errors/src/index.ts',
			'@warpkit/data': './packages/data/src/index.ts',
			'@warpkit/cache': './packages/cache/src/index.ts',
			'@warpkit/state-machine': './packages/state-machine/src/index.ts',
			'@warpkit/state-machine/svelte': './packages/state-machine/src/svelte/index.ts',
			'@warpkit/forms': './packages/forms/src/index.ts',
			'@warpkit/forms/testing': './packages/forms/src/testing/index.ts'
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
