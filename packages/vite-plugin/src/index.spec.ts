import { describe, it, expect, vi, beforeEach } from 'vitest';
import { warpkitPlugin } from './index.js';
import type { Plugin, UserConfig } from 'vite';

describe('warpkitPlugin', () => {
	let plugin: Plugin;

	beforeEach(() => {
		plugin = warpkitPlugin();
	});

	it('should return a valid plugin object', () => {
		expect(plugin.name).toBe('warpkit');
		expect(plugin.enforce).toBe('post');
		expect(plugin.config).toBeDefined();
		expect(plugin.transform).toBeDefined();
	});

	describe('config', () => {
		it('should always disable Vite error overlay', () => {
			const config = plugin.config as () => UserConfig;
			const result = config();

			expect(result.server?.hmr).toEqual({ overlay: false });
		});

		it('should include warmup config with route component patterns', () => {
			const pluginWithRoutes = warpkitPlugin({
				routeComponents: ['./src/pages/**/*.svelte', './src/layouts/**/*.svelte']
			});

			const config = pluginWithRoutes.config as () => UserConfig;
			const result = config();

			expect(result.server?.warmup).toEqual({
				clientFiles: ['./src/pages/**/*.svelte', './src/layouts/**/*.svelte']
			});
		});

		it('should not include warmup when no patterns provided', () => {
			const config = plugin.config as () => UserConfig;
			const result = config();

			expect(result.server?.warmup).toBeUndefined();
		});

		it('should not include warmup when patterns array is empty', () => {
			const pluginEmpty = warpkitPlugin({ routeComponents: [] });

			const config = pluginEmpty.config as () => UserConfig;
			const result = config();

			expect(result.server?.warmup).toBeUndefined();
		});
	});

	describe('transform', () => {
		it('should append __warpkitHmrId export for .svelte files', () => {
			const transform = plugin.transform as (code: string, id: string) => string | undefined;

			const result = transform('export default Component;', '/src/pages/Dashboard.svelte');

			expect(result).toContain('export const __warpkitHmrId = "/src/pages/Dashboard.svelte";');
		});

		it('should preserve original code before the appended export', () => {
			const transform = plugin.transform as (code: string, id: string) => string | undefined;
			const originalCode = 'const x = 1;\nexport default Component;';

			const result = transform(originalCode, '/src/pages/Dashboard.svelte');

			expect(result).toContain(originalCode);
		});

		it('should skip non-.svelte files', () => {
			const transform = plugin.transform as (code: string, id: string) => string | undefined;

			const result = transform('export default {}', '/src/utils/helper.ts');

			expect(result).toBeUndefined();
		});

		it('should skip .svelte.ts files', () => {
			const transform = plugin.transform as (code: string, id: string) => string | undefined;

			const result = transform('export class WarpKit {}', '/src/core/WarpKit.svelte.ts');

			expect(result).toBeUndefined();
		});
	});

});
