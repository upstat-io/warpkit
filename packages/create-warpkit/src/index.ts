import * as p from '@clack/prompts';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';

function detectPackageManager(): string {
	const ua = process.env.npm_config_user_agent;
	if (ua?.startsWith('bun')) return 'bun install';
	if (ua?.startsWith('yarn')) return 'yarn install';
	if (ua?.startsWith('pnpm')) return 'pnpm install';
	return 'npm install';
}

function detectPMName(): string {
	const ua = process.env.npm_config_user_agent;
	if (ua?.startsWith('bun')) return 'bun';
	if (ua?.startsWith('yarn')) return 'yarn';
	if (ua?.startsWith('pnpm')) return 'pnpm';
	return 'npm';
}

async function main() {
	console.log();
	p.intro('create-warpkit');

	const args = process.argv.slice(2);
	const positional = args.find((a) => !a.startsWith('--'));
	const flagTemplate =
		args.find((a) => a.startsWith('--template='))?.split('=')[1] ||
		(args.includes('--template')
			? args[args.indexOf('--template') + 1]
			: undefined);
	const flagInstall = args.includes('--install')
		? true
		: args.includes('--no-install')
			? false
			: undefined;

	const project = await p.group(
		{
			name: () =>
				positional
					? (Promise.resolve(positional) as Promise<string>)
					: p.text({
							message: 'Project name',
							placeholder: 'my-warpkit-app',
							validate: (v) => {
								if (!v.trim()) return 'Name is required';
								if (/[^a-zA-Z0-9._-]/.test(v))
									return 'Name can only contain letters, numbers, dots, hyphens, and underscores';
							},
						}),
			template: () =>
				flagTemplate && ['minimal', 'full'].includes(flagTemplate)
					? (Promise.resolve(flagTemplate) as Promise<'minimal' | 'full'>)
					: p.select({
							message: 'Which template?',
							options: [
								{
									value: 'minimal' as const,
									label: 'Minimal',
									hint: 'Core routing only',
								},
								{
									value: 'full' as const,
									label: 'Full',
									hint: '+ data, forms, validation',
								},
							],
						}),
			install: () =>
				flagInstall !== undefined
					? (Promise.resolve(flagInstall) as Promise<boolean>)
					: p.confirm({
							message: 'Install dependencies?',
							initialValue: true,
						}),
		},
		{
			onCancel: () => {
				p.cancel('Cancelled.');
				process.exit(0);
			},
		},
	);

	const root = resolve(project.name);

	if (existsSync(root)) {
		p.cancel(`Directory "${project.name}" already exists.`);
		process.exit(1);
	}

	const s = p.spinner();
	s.start('Scaffolding project...');

	const files = getFiles(project.name, project.template);
	for (const [filePath, content] of Object.entries(files)) {
		const full = join(root, filePath);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, content);
	}

	s.stop('Project created.');

	if (project.install) {
		const installSpinner = p.spinner();
		installSpinner.start('Installing dependencies...');
		try {
			const installCmd = detectPackageManager();
			execSync(installCmd, { cwd: root, stdio: 'ignore' });
			installSpinner.stop('Dependencies installed.');
		} catch {
			const pm = detectPMName();
			installSpinner.stop(`Failed to install. Run \`${pm} install\` manually.`);
		}
	}

	const steps = [`cd ${project.name}`];
	const pm = detectPMName();
	if (!project.install) steps.push(`${pm} install`);
	steps.push(`${pm === 'npm' ? 'npx vite' : `${pm} dev`}`);

	p.note(steps.join('\n'), 'Next steps');
	p.outro('Happy hacking!');
}

// ---------------------------------------------------------------------------
// Template files
// ---------------------------------------------------------------------------

function getFiles(
	name: string,
	template: string,
): Record<string, string> {
	return {
		...shared(name),
		...(template === 'full' ? full(name) : minimal(name)),
	};
}

// Files shared by both templates
function shared(name: string): Record<string, string> {
	return {
		'.gitignore': `node_modules
dist
.vite
`,

		'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,

		'vite.config.ts': `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    exclude: ['@warpkit/core'],
  },
});
`,

		'tsconfig.json': JSON.stringify(
			{
				compilerOptions: {
					target: 'ES2022',
					module: 'ESNext',
					moduleResolution: 'bundler',
					lib: ['ES2022', 'DOM', 'DOM.Iterable'],
					strict: true,
					esModuleInterop: true,
					skipLibCheck: true,
					forceConsistentCasingInFileNames: true,
					resolveJsonModule: true,
					isolatedModules: true,
					noEmit: true,
					verbatimModuleSyntax: true,
				},
				include: ['src'],
			},
			null,
			'\t',
		) + '\n',

		'src/main.ts': `import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

mount(App, { target: document.getElementById('app')! });
`,

		'src/vite-env.d.ts': `/// <reference types="svelte" />
/// <reference types="vite/client" />
`,

		'src/app.css': `:root {
  font-family: Inter, system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #213547;
  background-color: #ffffff;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
}

.page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 0.9rem;
}

button:hover {
  background: #e5e5e5;
}

input {
  display: block;
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  margin-top: 0.25rem;
  font-size: 0.9rem;
}

label {
  display: block;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.error {
  color: #d32f2f;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}
`,

		'src/lib/routes.ts': `import { createRoute, createStateRoutes } from '@warpkit/core';

export type AppState = 'authenticated' | 'unauthenticated';

export const routes = createStateRoutes<AppState>({
  unauthenticated: {
    routes: [
      createRoute({
        path: '/login',
        component: () => import('../routes/unauthenticated/Login.svelte'),
        meta: { title: 'Login' },
      }),
    ],
    default: '/login',
  },
  authenticated: {
    routes: [
      createRoute({
        path: '/dashboard',
        component: () => import('../routes/authenticated/Dashboard.svelte'),
        meta: { title: 'Dashboard' },
      }),
      createRoute({
        path: '/settings',
        component: () => import('../routes/authenticated/Settings.svelte'),
        meta: { title: 'Settings' },
      }),
    ],
    default: '/dashboard',
    layout: {
      id: 'app-layout',
      load: () => import('../layouts/AppLayout.svelte'),
    },
  },
});
`,

		'src/lib/warpkit.ts': `import { createWarpKit } from '@warpkit/core';
import { routes, type AppState } from './routes';

export function initWarpKit() {
  return createWarpKit<AppState>({
    routes,
    initialState: 'unauthenticated',
  });
}
`,

		'src/layouts/AppLayout.svelte': `<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Link, useWarpKit } from '@warpkit/core';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
  const warpkit = useWarpKit();

  function handleLogout() {
    warpkit.setState('unauthenticated');
  }
</script>

<div class="app-layout">
  <header>
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/settings">Settings</Link>
      <button onclick={handleLogout}>Logout</button>
    </nav>
  </header>
  <main>
    {@render children()}
  </main>
</div>

<style>
  .app-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    padding: 1rem 2rem;
    border-bottom: 1px solid #eee;
  }

  nav {
    display: flex;
    gap: 1rem;
    align-items: center;
    max-width: 800px;
    margin: 0 auto;
  }

  main {
    flex: 1;
  }
</style>
`,

		'src/routes/authenticated/Settings.svelte': `<div class="page">
  <h1>Settings</h1>
  <p>Manage your preferences.</p>
</div>
`,
	};
}

// Minimal template: core routing only
function minimal(name: string): Record<string, string> {
	return {
		'package.json':
			JSON.stringify(
				{
					name,
					private: true,
					version: '0.0.0',
					type: 'module',
					scripts: {
						dev: 'vite',
						build: 'vite build',
						preview: 'vite preview',
					},
					dependencies: {
						'@warpkit/core': '^0.0.3',
						svelte: '^5.0.0',
					},
					devDependencies: {
						'@sveltejs/vite-plugin-svelte': '^6.0.0',
						typescript: '^5.0.0',
						vite: '^6.0.0',
					},
				},
				null,
				'\t',
			) + '\n',

		'src/App.svelte': `<script lang="ts">
  import { WarpKitProvider, RouterView } from '@warpkit/core';
  import { initWarpKit } from './lib/warpkit';

  const warpkit = initWarpKit();

  $effect(() => {
    warpkit.start();
    return () => warpkit.destroy();
  });
</script>

<WarpKitProvider {warpkit}>
  <RouterView />
</WarpKitProvider>
`,

		'src/routes/unauthenticated/Login.svelte': `<script lang="ts">
  import { useWarpKit } from '@warpkit/core';

  const warpkit = useWarpKit();

  function handleLogin() {
    warpkit.setState('authenticated');
  }
</script>

<div class="page">
  <h1>Login</h1>
  <p>Click below to simulate authentication.</p>
  <button onclick={handleLogin}>Sign In</button>
</div>
`,

		'src/routes/authenticated/Dashboard.svelte': `<div class="page">
  <h1>Dashboard</h1>
  <p>Welcome! You are authenticated.</p>
</div>
`,
	};
}

// Full template: routing + data + forms + validation
function full(name: string): Record<string, string> {
	return {
		'package.json':
			JSON.stringify(
				{
					name,
					private: true,
					version: '0.0.0',
					type: 'module',
					scripts: {
						dev: 'vite',
						build: 'vite build',
						preview: 'vite preview',
					},
					dependencies: {
						'@warpkit/core': '^0.0.3',
						'@warpkit/data': '^0.0.1',
						'@warpkit/cache': '^0.0.1',
						'@warpkit/forms': '^0.0.1',
						'@warpkit/validation': '^0.0.1',
						'@sinclair/typebox': '^0.34.0',
						svelte: '^5.0.0',
					},
					devDependencies: {
						'@sveltejs/vite-plugin-svelte': '^6.0.0',
						typescript: '^5.0.0',
						vite: '^6.0.0',
					},
				},
				null,
				'\t',
			) + '\n',

		'src/App.svelte': `<script lang="ts">
  import { WarpKitProvider, RouterView } from '@warpkit/core';
  import { DataClientProvider } from '@warpkit/data';
  import { initWarpKit } from './lib/warpkit';
  import { dataClient } from './lib/data/client';

  const warpkit = initWarpKit();

  $effect(() => {
    warpkit.start();
    return () => warpkit.destroy();
  });
</script>

<WarpKitProvider {warpkit}>
  <DataClientProvider client={dataClient}>
    <RouterView />
  </DataClientProvider>
</WarpKitProvider>
`,

		'src/lib/data/client.ts': `import { DataClient } from '@warpkit/data';
import { ETagCacheProvider } from '@warpkit/cache';

export const dataClient = new DataClient(
  {
    baseUrl: '/api',
    timeout: 30_000,
  },
  {
    cache: new ETagCacheProvider(),
  },
);
`,

		'src/routes/unauthenticated/Login.svelte': `<script lang="ts">
  import { useWarpKit } from '@warpkit/core';
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const warpkit = useWarpKit();

  const schema = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
  });

  const form = useForm({
    schema,
    initialValues: { email: '', password: '' },
    onSubmit: async (values) => {
      // Replace with your auth logic
      console.log('Login:', values);
      warpkit.setState('authenticated');
    },
  });
</script>

<div class="page">
  <h1>Login</h1>
  <form onsubmit={form.submit}>
    <label>
      Email
      <input type="email" bind:value={form.data.email} />
      {#if form.errors.email}
        <span class="error">{form.errors.email}</span>
      {/if}
    </label>
    <label>
      Password
      <input type="password" bind:value={form.data.password} />
      {#if form.errors.password}
        <span class="error">{form.errors.password}</span>
      {/if}
    </label>
    <button type="submit">Sign In</button>
  </form>
</div>
`,

		'src/routes/authenticated/Dashboard.svelte': `<script lang="ts">
  // import { useData } from '@warpkit/data';

  // Example: fetch data from your API
  // const { data, isLoading, error } = useData('your-key');
</script>

<div class="page">
  <h1>Dashboard</h1>
  <p>Welcome! You are authenticated.</p>
</div>
`,
	};
}

main().catch(console.error);
