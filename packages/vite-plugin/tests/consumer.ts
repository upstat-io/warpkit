import type { Plugin } from 'vite';
import { localPackageBuilds, type LocalPackageBuild } from '@warpkit/vite-plugin';

const packageBuild: LocalPackageBuild = {
	name: '@example/widgets', root: '/work/widgets',
	async build(signal) { signal.throwIfAborted(); }
};
const plugin = localPackageBuilds([packageBuild]);
export const vitePlugin: Plugin = plugin;
export const ready: boolean = plugin.api.isReady;
export const errors: ReadonlyMap<string, Error> = plugin.api.errors;
export const stop: () => Promise<void> = plugin.api.stop;
