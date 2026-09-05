# Contributing to WarpKit

Thank you for your interest in contributing to WarpKit!

## Development Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Run tests: `bun test`
4. Type check: `bun run typecheck`
5. For browser tests, install matching Chromium with `bun run test:install-browser`, then run `bun run test:browser`. The install command uses `@playwright/test/cli` because the experimental component-test package also provides a binary named `playwright`.

## Code Style

- Use TypeScript strict mode
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Follow existing patterns in the codebase
- Write tests for new functionality
- Keep functions small and focused

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and type checking
5. Submit a pull request

## Commit Messages

Use clear, descriptive commit messages:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for test changes
- `refactor:` for refactoring

## Questions?

Open an issue for questions or discussion.
