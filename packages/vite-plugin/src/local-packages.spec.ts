import { expect, test } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer } from 'vite';
import { chromium } from '@playwright/test';
import { localPackageBuilds, type LocalPackageBuild } from '@warpkit/vite-plugin';

async function fixture() {
	const directory = await mkdtemp(join(tmpdir(), 'warpkit-local-package-'));
	const app = join(directory, 'app');
	const pkg = join(directory, 'package');
	const source = join(pkg, 'src/index.ts');
	const link = join(app, 'node_modules/@fixture/widgets');
	await mkdir(join(pkg, 'src'), { recursive: true });
	await mkdir(join(app, 'node_modules/@fixture'), { recursive: true });
	await symlink(pkg, link, 'dir');
	await writeFile(join(pkg, 'package.json'), JSON.stringify({ name: '@fixture/widgets', type: 'module', exports: './dist/index.js' }));
	await writeFile(source, 'export const label = "initial";');
	await writeFile(join(app, 'index.html'), '<html><body><h1 id="label"></h1><script type="module" src="/main.js"></script></body></html>');
	await writeFile(join(app, 'main.js'), 'import { label } from "@fixture/widgets"; document.querySelector("#label").textContent = label;');
	const compile = async (signal: AbortSignal) => {
		signal.throwIfAborted();
		const child = Bun.spawn([process.execPath, 'build', 'src/index.ts', '--outdir', 'dist', '--format', 'esm', '--target', 'browser', '--packages', 'external'], {
			cwd: pkg, stdout: 'pipe', stderr: 'pipe', timeout: 10_000
		});
		const abort = () => child.kill();
		signal.addEventListener('abort', abort, { once: true });
		try {
			const [code, error] = await Promise.all([child.exited, new Response(child.stderr).text()]);
			if (code !== 0) throw new Error(error || 'Package build failed.');
		} finally { signal.removeEventListener('abort', abort); }
	};
	await compile(new AbortController().signal);
	const spec: LocalPackageBuild = { name: '@fixture/widgets', root: link, build: compile };
	return { directory, app, pkg, source, spec, compile };
}

async function serve(f: Awaited<ReturnType<typeof fixture>>, spec = f.spec) {
	const plugin = localPackageBuilds([spec]);
	const server = await createServer({ configFile: false, root: f.app, plugins: [plugin], logLevel: 'silent',
		server: { host: '127.0.0.1', port: 0, fs: { allow: [f.directory] } } });
	await server.listen();
	const address = server.httpServer?.address();
	if (!address || typeof address === 'string') throw new Error('The fixture requires an owned TCP listener.');
	await expect.poll(() => server.watcher.getWatched()[join(f.pkg, 'src')]).toContain('index.ts');
	return { plugin, server, url: `http://127.0.0.1:${address.port}` };
}

test('compiled public plugin watches a physical symlink target, refreshes the browser and recovers a failed build', async () => {
	const f = await fixture();
	const { plugin, server, url } = await serve(f);
	const http = server.httpServer;
	const browser = await chromium.launch({ headless: true });
	try {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto(url);
		await expect.poll(() => page.locator('h1').textContent()).toBe('initial');
		await page.evaluate(() => localStorage.setItem('retained-preference', 'present'));
		await writeFile(f.source, 'export const label = "changed";');
		await expect.poll(() => page.locator('h1').textContent()).toBe('changed');
		expect(await page.evaluate(() => localStorage.getItem('retained-preference'))).toBe('present');
		await writeFile(f.source, 'export const label = ;');
		await expect.poll(() => plugin.api.errors.size).toBe(1);
		expect(plugin.api.isReady).toBe(false);
		await writeFile(f.source, 'export const label = "recovered";');
		await expect.poll(() => page.locator('h1').textContent()).toBe('recovered');
		await expect.poll(() => plugin.api.isReady).toBe(true);
		expect(server.httpServer).toBe(http);
		expect(http?.listening).toBe(true);
	} finally { await browser.close(); await server.close(); await rm(f.directory, { recursive: true, force: true }); }
}, 20_000);

test('an edit during a build queues another serial pass', async () => {
	const f = await fixture();
	const release = Promise.withResolvers<void>();
	let calls = 0;
	let active = 0;
	let maximum = 0;
	const { plugin, server } = await serve(f, { ...f.spec, build: async (signal) => {
		calls++;
		maximum = Math.max(maximum, ++active);
		try { if (calls === 1) await release.promise; await f.compile(signal); }
		finally { active--; }
	} });
	try {
		await writeFile(f.source, 'export const label = "first edit";');
		await expect.poll(() => calls).toBe(1);
		let secondObserved = false;
		server.watcher.on('change', (file) => { if (file === f.source) secondObserved = true; });
		await writeFile(f.source, 'export const label = "latest edit";');
		await expect.poll(() => secondObserved).toBe(true);
		release.resolve();
		await expect.poll(() => calls).toBe(2);
		await expect.poll(() => plugin.api.isReady).toBe(true);
		expect(maximum).toBe(1);
		expect(await readFile(join(f.pkg, 'dist/index.js'), 'utf8')).toContain('latest edit');
	} finally { release.resolve(); await server.close(); await rm(f.directory, { recursive: true, force: true }); }
}, 10_000);

test('shutdown cancels and awaits the active builder and discards queued work', async () => {
	const f = await fixture();
	let calls = 0;
	let cleaned = false;
	const { plugin, server } = await serve(f, { ...f.spec, build: async (signal) => {
		calls++;
		await new Promise<void>((resolve) => {
			if (signal.aborted) resolve();
			else signal.addEventListener('abort', () => resolve(), { once: true });
		});
		await Promise.resolve();
		cleaned = true;
	} });
	try {
		await writeFile(f.source, 'export const label = "first edit";');
		await expect.poll(() => calls).toBe(1);
		let secondObserved = false;
		server.watcher.on('change', (file) => { if (file === f.source) secondObserved = true; });
		await writeFile(f.source, 'export const label = "queued edit";');
		await expect.poll(() => secondObserved).toBe(true);
		await Promise.all([plugin.api.stop(), plugin.api.stop()]);
		expect(cleaned).toBe(true);
		expect(calls).toBe(1);
		expect(plugin.api.isReady).toBe(false);
	} finally { await server.close(); await rm(f.directory, { recursive: true, force: true }); }
}, 10_000);

test('production builds do not initialise local watchers or invoke builders', async () => {
	const f = await fixture();
	let calls = 0;
	const plugin = localPackageBuilds([{ ...f.spec, root: join(f.directory, 'absent'), build: async () => { calls++; } }]);
	try {
		await build({ configFile: false, root: f.app, plugins: [plugin], logLevel: 'silent', build: { write: false } });
		expect(calls).toBe(0);
		expect(plugin.api.isReady).toBe(false);
	} finally { await rm(f.directory, { recursive: true, force: true }); }
});

test('physical output boundaries reject a directory symlink escaping the package', async () => {
	const f = await fixture();
	try {
		await rm(join(f.pkg, 'dist'), { recursive: true });
		await mkdir(join(f.directory, 'outside-output'));
		await symlink(join(f.directory, 'outside-output'), join(f.pkg, 'dist'), 'dir');
		const result = await createServer({ configFile: false, root: f.app, logLevel: 'silent',
			plugins: [localPackageBuilds([f.spec])], server: { middlewareMode: true, hmr: false } })
			.then(async (server) => { await server.close(); return null; }, (error: unknown) => error);
		expect(result).toBeInstanceOf(Error);
		if (!(result instanceof Error)) throw new Error('An escaped output must be rejected.');
		expect(result.message).toContain('separate paths inside');
	} finally { await rm(f.directory, { recursive: true, force: true }); }
});
