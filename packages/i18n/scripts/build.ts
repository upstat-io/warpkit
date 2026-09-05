import { compileModule } from 'svelte/compiler';
import { unlink } from 'node:fs/promises';

// svelte-package emits declarations and strips TS, but preserves runes. Ship lowered JS for both environments.
const source = await Bun.file('dist/svelte/context.svelte.js').text();
for (const generate of ['client', 'server']) {
	if (generate !== 'client' && generate !== 'server') throw new Error('Invalid compilation target');
	const compiled = compileModule(source, { filename: 'context.svelte.js', generate });
	await Bun.write(`dist/svelte/context.${generate}.js`, compiled.js.code);
}
await unlink('dist/svelte/context.svelte.js');
await unlink('dist/svelte/index.js');
