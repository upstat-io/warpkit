/**
 * ESLint is disabled for Svelte 5 projects.
 * This config redirects to svelte-check instead.
 */
import { execSync } from 'child_process';

console.log('\x1b[33m%s\x1b[0m', 'ESLint disabled for Svelte 5. Running svelte-check instead...\n');

try {
	execSync('npx svelte-check --tsconfig ./tsconfig.json', { stdio: 'inherit' });
	process.exit(0);
} catch {
	process.exit(1);
}
