import { defineConfig, devices } from '@playwright/experimental-ct-svelte';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	testDir: './src',
	testMatch: '**/*.ct.ts',
	snapshotDir: './__snapshots__',
	timeout: 10 * 1000,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		trace: 'on-first-retry',
		ctPort: 3100,
		ctViteConfig: {
			plugins: [
				svelte({
					compilerOptions: {
						runes: true
					}
				})
			]
		}
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
