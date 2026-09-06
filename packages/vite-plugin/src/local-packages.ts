import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

export interface LocalPackageBuild {
	name: string;
	root: string;
	watch?: readonly string[];
	output?: string;
	/** Own the build, including subprocess cleanup and cross-process output locking. */
	build: (signal: AbortSignal) => Promise<void>;
}

type Watcher = ViteDevServer['watcher'];
/** Accept the native operations we use, without requiring a second installation's environment classes. */
interface LocalPackageServer {
	config: { root: string; logger: Pick<ViteDevServer['config']['logger'], 'error'> };
	watcher: {
		add: (...args: Parameters<Watcher['add']>) => unknown;
		on: (...args: Parameters<Watcher['on']>) => unknown;
		off: (...args: Parameters<Watcher['off']>) => unknown;
	};
	moduleGraph: Pick<ViteDevServer['moduleGraph'], 'invalidateAll'>;
	ws: Pick<ViteDevServer['ws'], 'send'>;
}

export interface LocalPackageBuildPlugin {
	name: string;
	apply: 'serve';
	enforce: 'pre';
	config: () => { optimizeDeps: { exclude: string[] } };
	configureServer: (server: LocalPackageServer) => Promise<void>;
	handleHotUpdate: (context: { file: string }) => [] | void;
	closeBundle: () => Promise<void>;
	api: {
		readonly isReady: boolean;
		readonly isBuilding: boolean;
		readonly errors: ReadonlyMap<string, Error>;
		stop: () => Promise<void>;
	};
}

interface Target { spec: LocalPackageBuild; inputs: string[]; output: string }

function contains(parent: string, file: string): boolean {
	const path = relative(parent, file);
	return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

/** Rebuild explicitly selected local packages through Vite's existing watcher. */
export function localPackageBuilds(packages: readonly LocalPackageBuild[]): LocalPackageBuildPlugin {
	if (new Set(packages.map((entry) => entry.name)).size !== packages.length) throw new Error('Local package names must be unique.');
	if (packages.some((entry) => !entry.name || typeof entry.build !== 'function')) throw new Error('Each local package needs a name and build callback.');
	let server: LocalPackageServer | undefined;
	let targets: Target[] = [];
	let configured = false;
	let closed = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running: Promise<void> | undefined;
	let controller: AbortController | undefined;
	const pending = new Set<Target>();
	const errors = new Map<string, Error>();

	async function flush(): Promise<void> {
		let built = false;
		while (!closed && pending.size > 0) {
			const batch = targets.filter((target) => pending.has(target));
			for (const target of batch) pending.delete(target);
			for (const target of batch) {
				if (closed) break;
				controller = new AbortController();
				try {
					await target.spec.build(controller.signal);
					if (closed) break;
					errors.delete(target.spec.name);
					built = true;
				} catch (value) {
					if (closed) break;
					const error = value instanceof Error ? value : new Error(String(value));
					errors.set(target.spec.name, error);
					server?.config.logger.error(`${target.spec.name}: ${error.message}`);
					server?.ws.send({ type: 'error', err: { message: `${target.spec.name}: ${error.message}`, stack: error.stack ?? '', plugin: 'warpkit-local-packages' } });
				} finally { controller = undefined; }
			}
		}
		if (built && !closed && errors.size === 0 && server) {
			server.moduleGraph.invalidateAll();
			server.ws.send({ type: 'full-reload' });
		}
	}

	function changed(event: string, file: string): void {
		if (closed || !['add', 'change', 'unlink', 'addDir', 'unlinkDir'].includes(event)) return;
		for (const target of targets) {
			if (target.inputs.some((input) => contains(input, resolve(file)))) pending.add(target);
		}
		if (!pending.size || running) return;
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			running = Promise.resolve().then(flush).finally(() => { running = undefined; });
		}, 150);
	}

	async function stop(): Promise<void> {
		closed = true;
		configured = false;
		clearTimeout(timer);
		timer = undefined;
		pending.clear();
		server?.watcher.off('all', changed);
		controller?.abort(new Error('The development server is closing.'));
		await running;
	}

	return {
		name: 'warpkit-local-packages', apply: 'serve', enforce: 'pre',
		api: {
			get isReady() { return configured && !closed && !timer && !running && !pending.size && !errors.size; },
			get isBuilding() { return Boolean(running); },
			get errors() { return new Map(errors); },
			stop
		},
		config: () => ({ optimizeDeps: { exclude: packages.map((entry) => entry.name) } }),
		async configureServer(value: LocalPackageServer) {
			server = value;
			closed = false;
			errors.clear();
			const roots = new Set<string>();
			targets = await Promise.all(packages.map(async (spec): Promise<Target> => {
				const root = await realpath(resolve(value.config.root, spec.root));
				if (roots.has(root)) throw new Error(`Duplicate local package directory: ${root}`);
				roots.add(root);
				const output = await realpath(resolve(root, spec.output ?? 'dist'));
				const inputs = await Promise.all((spec.watch ?? ['src']).map((input) => realpath(resolve(root, input))));
				if (!contains(root, output) || !inputs.length || inputs.some((input) => !contains(root, input) || contains(input, output) || contains(output, input))) {
					throw new Error(`Local package inputs and output must be separate paths inside ${root}`);
				}
				return { spec, inputs, output };
			}));
			value.watcher.add(targets.flatMap((target) => target.inputs));
			value.watcher.on('all', changed);
			configured = true;
		},
		handleHotUpdate({ file }: { file: string }): [] | void {
			if ((timer || running || pending.size) && targets.some((target) => contains(target.output, resolve(file)))) return [];
		},
		closeBundle: stop
	} satisfies Plugin;
}
