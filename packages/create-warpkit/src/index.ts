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
						'@warpkit/core': '^0.0.5',
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

// Full template: routing + data + forms + validation (dark theme)
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
						'@warpkit/core': '^0.0.5',
						'@warpkit/data': '^0.0.5',
						'@warpkit/cache': '^0.0.5',
						'@warpkit/forms': '^0.0.5',
						'@warpkit/validation': '^0.0.5',
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

		'src/app.css': `:root {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #e0e0e0;
  background-color: #0a0a0f;
  color-scheme: dark;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { min-height: 100vh; }

.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

h1 { margin-bottom: 0.5rem; color: #fff; }
h2 { margin-bottom: 0.5rem; color: #e0e0e0; font-size: 1.1rem; }
p { color: #999; }

a { color: #7c6ef6; text-decoration: none; }
a:hover { color: #9d93f8; text-decoration: underline; }

button, .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  background: #16162a;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.15s;
}
button:hover, .btn:hover { background: #1e1e38; border-color: #7c6ef6; }
button:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-primary {
  background: #7c6ef6;
  border-color: #7c6ef6;
  color: #fff;
}
.btn-primary:hover { background: #6a5bd4; }

input, textarea, select {
  display: block;
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  background: #12121f;
  color: #e0e0e0;
  font-size: 0.875rem;
  transition: border-color 0.15s;
}
input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: #7c6ef6;
}

label {
  display: block;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #999;
}
label span.label-text { display: block; margin-bottom: 0.3rem; }

.error-text { color: #f06292; font-size: 0.8rem; margin-top: 0.25rem; }

.card {
  background: #12121f;
  border: 1px solid #1e1e30;
  border-radius: 12px;
  padding: 1.25rem;
  transition: border-color 0.15s;
}
.card:hover { border-color: #2a2a45; }

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 100px;
  font-size: 0.75rem;
  background: #1e1e38;
  color: #7c6ef6;
  border: 1px solid #2a2a3e;
}

.skeleton {
  background: linear-gradient(90deg, #1a1a2e 25%, #22223a 50%, #1a1a2e 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
  height: 1rem;
  margin-bottom: 0.5rem;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.doc-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #7c6ef6;
  margin-top: 0.5rem;
}
`,

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

		'src/lib/routes.ts': `import { createRoute, createStateRoutes } from '@warpkit/core';

export type AppState = 'authenticated' | 'unauthenticated';

export const routes = createStateRoutes<AppState>({
  unauthenticated: {
    routes: [
      createRoute({
        path: '/login',
        component: () => import('../routes/unauthenticated/Login.svelte'),
        meta: { title: 'Sign In' },
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
        path: '/users',
        component: () => import('../routes/authenticated/Users.svelte'),
        meta: { title: 'Users' },
      }),
      createRoute({
        path: '/users/[id]',
        component: () => import('../routes/authenticated/UserDetail.svelte'),
        meta: { title: 'User Detail' },
      }),
      createRoute({
        path: '/posts/new',
        component: () => import('../routes/authenticated/CreatePost.svelte'),
        meta: { title: 'New Post' },
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

		'src/layouts/AppLayout.svelte': `<script lang="ts">
  import type { Snippet } from 'svelte';
  import { NavLink, useWarpKit } from '@warpkit/core';

  interface Props { children: Snippet; }
  let { children }: Props = $props();
  const warpkit = useWarpKit();

  function handleLogout() { warpkit.setState('unauthenticated'); }
</script>

<div class="shell">
  <aside class="sidebar">
    <div class="logo">
      <span class="logo-icon">W</span>
      <span class="logo-text">WarpKit</span>
    </div>
    <nav>
      <NavLink href="/dashboard" class="nav-item" activeClass="active">Dashboard</NavLink>
      <NavLink href="/users" class="nav-item" activeClass="active">Users</NavLink>
      <NavLink href="/posts/new" class="nav-item" activeClass="active">New Post</NavLink>
      <NavLink href="/settings" class="nav-item" activeClass="active">Settings</NavLink>
    </nav>
    <div class="sidebar-footer">
      <button onclick={handleLogout}>Sign Out</button>
    </div>
  </aside>
  <main>{@render children()}</main>
</div>

<style>
  .shell { display: flex; min-height: 100vh; }
  .sidebar {
    width: 220px;
    background: #0d0d18;
    border-right: 1px solid #1a1a2e;
    display: flex;
    flex-direction: column;
    padding: 1.25rem 0.75rem;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0 0.5rem 1.25rem;
    border-bottom: 1px solid #1a1a2e;
    margin-bottom: 1rem;
  }
  .logo-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #7c6ef6, #5a4fd4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
    color: #fff;
  }
  .logo-text { font-weight: 600; font-size: 1rem; color: #fff; }
  nav { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
  nav :global(.nav-item) {
    display: block;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.875rem;
    color: #888;
    text-decoration: none;
    transition: all 0.15s;
  }
  nav :global(.nav-item:hover) { color: #e0e0e0; background: #16162a; }
  nav :global(.nav-item.active) { color: #fff; background: #1e1e38; }
  .sidebar-footer { padding-top: 0.75rem; border-top: 1px solid #1a1a2e; }
  .sidebar-footer button { width: 100%; justify-content: center; }
  main { flex: 1; margin-left: 220px; }
</style>
`,

		'src/lib/data/client.ts': `import { DataClient } from '@warpkit/data';
import { MemoryCache } from '@warpkit/cache';

export const dataClient = new DataClient(
  {
    baseUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 15_000,
  },
  {
    cache: new MemoryCache({ maxSize: 100, ttl: 60_000 }),
  },
);
`,

		'src/routes/unauthenticated/Login.svelte': `<script lang="ts">
  import { useWarpKit } from '@warpkit/core';
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const warpkit = useWarpKit();

  const schema = Type.Object({
    email: Type.String({ minLength: 1 }),
    password: Type.String({ minLength: 6 }),
  });

  const form = useForm({
    schema,
    initialValues: { email: '', password: '' },
    onSubmit: async () => {
      warpkit.setState('authenticated');
    },
  });
</script>

<div class="login-page">
  <div class="login-card">
    <div class="login-header">
      <span class="login-logo">W</span>
      <h1>WarpKit</h1>
      <p>Sign in to explore the demo</p>
    </div>
    <form onsubmit={form.submit}>
      <label>
        <span class="label-text">Email</span>
        <input type="email" placeholder="you@example.com" bind:value={form.data.email} />
        {#if form.errors.email}<span class="error-text">{form.errors.email}</span>{/if}
      </label>
      <label>
        <span class="label-text">Password</span>
        <input type="password" placeholder="min 6 characters" bind:value={form.data.password} />
        {#if form.errors.password}<span class="error-text">{form.errors.password}</span>{/if}
      </label>
      <button type="submit" class="btn-primary" style="width:100%;justify-content:center;margin-top:0.5rem">Sign In</button>
    </form>
    <p class="login-hint">Any credentials will work - this is a demo.</p>
    <p class="login-footer">
      Built with <a href="https://warpkit.org" target="_blank" rel="noopener">WarpKit</a>
      &middot; <a href="https://warpkit.org/docs" target="_blank" rel="noopener">Docs</a>
    </p>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at top, #12121f 0%, #0a0a0f 70%);
  }
  .login-card {
    width: 100%;
    max-width: 380px;
    background: #12121f;
    border: 1px solid #1e1e30;
    border-radius: 16px;
    padding: 2rem;
  }
  .login-header { text-align: center; margin-bottom: 1.5rem; }
  .login-header h1 { font-size: 1.5rem; color: #fff; margin: 0.5rem 0 0.25rem; }
  .login-header p { font-size: 0.875rem; color: #666; }
  .login-logo {
    display: inline-flex;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #7c6ef6, #5a4fd4);
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.2rem;
    color: #fff;
  }
  .login-hint { text-align: center; font-size: 0.8rem; color: #555; margin-top: 1rem; }
  .login-footer { text-align: center; font-size: 0.8rem; color: #444; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #1e1e30; }
</style>
`,

		'src/routes/authenticated/Dashboard.svelte': `<script lang="ts">
  import { Link } from '@warpkit/core';

  const features = [
    {
      title: 'State-Driven Routing',
      desc: 'Routes grouped by app state. Auth state controls which routes are accessible.',
      href: '/users',
      label: 'See Users page',
      doc: 'https://warpkit.org/docs/routing',
    },
    {
      title: 'Data Fetching',
      desc: 'useQuery with caching, loading states, and automatic revalidation.',
      href: '/users',
      label: 'See live data',
      doc: 'https://warpkit.org/docs/data',
    },
    {
      title: 'Forms & Validation',
      desc: 'useForm with TypeBox schemas, deep proxy binding, and field errors.',
      href: '/posts/new',
      label: 'Try the form',
      doc: 'https://warpkit.org/docs/forms',
    },
    {
      title: 'Route Params',
      desc: 'Dynamic [id] segments with typed params passed to components.',
      href: '/users/1',
      label: 'View user #1',
      doc: 'https://warpkit.org/docs/routing#params',
    },
    {
      title: 'Layouts',
      desc: 'Shared layouts with sidebar nav, auto-loaded per state.',
      href: '/settings',
      label: 'See layout',
      doc: 'https://warpkit.org/docs/layouts',
    },
    {
      title: 'Navigation',
      desc: 'NavLink with active class, Link for client-side navigation.',
      href: '/dashboard',
      label: 'Check sidebar',
      doc: 'https://warpkit.org/docs/navigation',
    },
  ];
</script>

<div class="page">
  <h1>Dashboard</h1>
  <p style="margin-bottom:1.5rem">
    Welcome to the WarpKit demo. Explore the features below.
    <a class="doc-link" href="https://warpkit.org/docs" target="_blank" rel="noopener">Read the docs &rarr;</a>
  </p>

  <div class="card-grid">
    {#each features as f}
      <div class="card">
        <h2>{f.title}</h2>
        <p style="font-size:0.85rem;margin:0.4rem 0 0.75rem">{f.desc}</p>
        <Link href={f.href} class="btn" style="font-size:0.8rem">{f.label}</Link>
        <a class="doc-link" href={f.doc} target="_blank" rel="noopener">Docs</a>
      </div>
    {/each}
  </div>
</div>
`,

		'src/routes/authenticated/Users.svelte': `<script lang="ts">
  import { Link } from '@warpkit/core';

  interface User {
    id: number;
    name: string;
    email: string;
    company: { name: string };
  }

  let users = $state<User[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    fetch('https://jsonplaceholder.typicode.com/users')
      .then((r) => r.json())
      .then((data) => { users = data; loading = false; })
      .catch((e) => { error = e.message; loading = false; });
  });
</script>

<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
    <div>
      <h1>Users</h1>
      <p>Fetched from <a href="https://jsonplaceholder.typicode.com/users" target="_blank" rel="noopener">JSONPlaceholder</a></p>
    </div>
    <span class="badge">{users.length} users</span>
  </div>

  {#if loading}
    <div class="card-grid">
      {#each Array(6) as _}
        <div class="card">
          <div class="skeleton" style="width:60%"></div>
          <div class="skeleton" style="width:80%"></div>
          <div class="skeleton" style="width:40%"></div>
        </div>
      {/each}
    </div>
  {:else if error}
    <div class="card" style="border-color:#f0629244">
      <p style="color:#f06292">Failed to load users: {error}</p>
    </div>
  {:else}
    <div class="card-grid">
      {#each users as user}
        <Link href="/users/{user.id}" class="card user-card" style="text-decoration:none;color:inherit">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
            <div class="avatar">{user.name[0]}</div>
            <div>
              <h2 style="color:#fff">{user.name}</h2>
              <p style="font-size:0.8rem">{user.email.toLowerCase()}</p>
            </div>
          </div>
          <span class="badge">{user.company.name}</span>
        </Link>
      {/each}
    </div>
  {/if}

  <a class="doc-link" href="https://warpkit.org/docs/data" target="_blank" rel="noopener" style="margin-top:1.5rem;display:inline-flex">Data fetching docs &rarr;</a>
</div>

<style>
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #7c6ef6, #5a4fd4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
    color: #fff;
    flex-shrink: 0;
  }
  :global(.user-card:hover) { border-color: #7c6ef644 !important; }
</style>
`,

		'src/routes/authenticated/UserDetail.svelte': `<script lang="ts">
  import { Link } from '@warpkit/core';

  interface Props { id: string; }
  let { id }: Props = $props();

  interface User {
    id: number;
    name: string;
    username: string;
    email: string;
    phone: string;
    website: string;
    company: { name: string; catchPhrase: string };
    address: { street: string; suite: string; city: string; zipcode: string };
  }

  let user = $state<User | null>(null);
  let loading = $state(true);

  $effect(() => {
    fetch(\`https://jsonplaceholder.typicode.com/users/\${id}\`)
      .then((r) => r.json())
      .then((data) => { user = data; loading = false; });
  });
</script>

<div class="page">
  <Link href="/users" class="back-link">&larr; Back to users</Link>

  {#if loading}
    <div class="card" style="margin-top:1rem">
      <div class="skeleton" style="width:40%;height:1.5rem"></div>
      <div class="skeleton" style="width:60%;margin-top:0.75rem"></div>
      <div class="skeleton" style="width:50%;margin-top:0.25rem"></div>
    </div>
  {:else if user}
    <div class="detail-header">
      <div class="avatar-lg">{user.name[0]}</div>
      <div>
        <h1>{user.name}</h1>
        <p>@{user.username}</p>
      </div>
    </div>

    <div class="card-grid" style="margin-top:1.5rem">
      <div class="card">
        <h2>Contact</h2>
        <dl>
          <dt>Email</dt><dd>{user.email.toLowerCase()}</dd>
          <dt>Phone</dt><dd>{user.phone}</dd>
          <dt>Website</dt><dd>{user.website}</dd>
        </dl>
      </div>
      <div class="card">
        <h2>Company</h2>
        <dl>
          <dt>Name</dt><dd>{user.company.name}</dd>
          <dt>Motto</dt><dd style="font-style:italic;color:#666">"{user.company.catchPhrase}"</dd>
        </dl>
      </div>
      <div class="card">
        <h2>Address</h2>
        <dl>
          <dt>Street</dt><dd>{user.address.street}, {user.address.suite}</dd>
          <dt>City</dt><dd>{user.address.city} {user.address.zipcode}</dd>
        </dl>
      </div>
    </div>

    <p style="margin-top:1.5rem;font-size:0.85rem;color:#666">
      This page demonstrates <strong style="color:#999">dynamic route params</strong> &mdash; the <code style="color:#7c6ef6">[id]</code> segment is passed as a prop.
      <a class="doc-link" href="https://warpkit.org/docs/routing#params" target="_blank" rel="noopener">Docs &rarr;</a>
    </p>
  {/if}
</div>

<style>
  .back-link { font-size: 0.85rem; color: #7c6ef6; }
  .detail-header { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; }
  .avatar-lg {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: linear-gradient(135deg, #7c6ef6, #5a4fd4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.4rem;
    color: #fff;
  }
  dl { margin-top: 0.5rem; }
  dt { font-size: 0.75rem; color: #666; margin-top: 0.4rem; }
  dd { font-size: 0.875rem; color: #ccc; }
</style>
`,

		'src/routes/authenticated/CreatePost.svelte': `<script lang="ts">
  import { useForm } from '@warpkit/forms';
  import { Type } from '@sinclair/typebox';

  const schema = Type.Object({
    title: Type.String({ minLength: 3 }),
    body: Type.String({ minLength: 10 }),
  });

  let submitted = $state(false);
  let result = $state<{ id: number } | null>(null);

  const form = useForm({
    schema,
    initialValues: { title: '', body: '' },
    onSubmit: async (values) => {
      const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, userId: 1 }),
      });
      result = await res.json();
      submitted = true;
    },
  });
</script>

<div class="page">
  <h1>Create Post</h1>
  <p style="margin-bottom:1.5rem">
    Demonstrates <strong style="color:#ccc">useForm</strong> with TypeBox schema validation and API mutation.
    <a class="doc-link" href="https://warpkit.org/docs/forms" target="_blank" rel="noopener">Form docs &rarr;</a>
  </p>

  {#if submitted && result}
    <div class="card" style="border-color:#4caf5066">
      <h2 style="color:#4caf50">Post Created</h2>
      <p style="margin-top:0.5rem">ID: <strong style="color:#ccc">{result.id}</strong></p>
      <p style="font-size:0.8rem;margin-top:0.5rem;color:#666">(JSONPlaceholder returns a fake ID for POST requests)</p>
      <button style="margin-top:1rem" onclick={() => { submitted = false; result = null; form.reset(); }}>Create Another</button>
    </div>
  {:else}
    <div class="card" style="max-width:500px">
      <form onsubmit={form.submit}>
        <label>
          <span class="label-text">Title</span>
          <input type="text" placeholder="Post title (min 3 chars)" bind:value={form.data.title} />
          {#if form.errors.title}<span class="error-text">{form.errors.title}</span>{/if}
        </label>
        <label>
          <span class="label-text">Body</span>
          <textarea rows="4" placeholder="Write something (min 10 chars)" bind:value={form.data.body}></textarea>
          {#if form.errors.body}<span class="error-text">{form.errors.body}</span>{/if}
        </label>
        <button type="submit" class="btn-primary" disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Submitting...' : 'Create Post'}
        </button>
      </form>
    </div>
  {/if}
</div>
`,

		'src/routes/authenticated/Settings.svelte': `<div class="page">
  <h1>Settings</h1>
  <p style="margin-bottom:1.5rem">Manage your preferences. This is a placeholder page.</p>

  <div class="card" style="max-width:500px">
    <h2>Appearance</h2>
    <label style="margin-top:0.75rem">
      <span class="label-text">Theme</span>
      <select disabled>
        <option>Dark</option>
        <option>Light</option>
      </select>
    </label>
    <label>
      <span class="label-text">Language</span>
      <select disabled>
        <option>English</option>
      </select>
    </label>
    <p style="font-size:0.8rem;color:#555;margin-top:0.5rem">Settings are not persisted in this demo.</p>
  </div>

  <div class="card" style="max-width:500px;margin-top:1rem">
    <h2>Resources</h2>
    <ul style="list-style:none;margin-top:0.5rem">
      <li><a href="https://warpkit.org/docs" target="_blank" rel="noopener">Documentation</a></li>
      <li style="margin-top:0.3rem"><a href="https://github.com/upstat-io/warpkit" target="_blank" rel="noopener">GitHub</a></li>
      <li style="margin-top:0.3rem"><a href="https://warpkit.org" target="_blank" rel="noopener">warpkit.org</a></li>
    </ul>
  </div>
</div>
`,
	};
}

main().catch(console.error);
