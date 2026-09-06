# @warpkit/vite-plugin

`warpkitPlugin` configures WarpKit's development error handling, route warmup and Svelte HMR identifiers.

## Linked packages with compiled exports

`localPackageBuilds(packages)` is an optional development-only Vite plugin for local packages whose exports point to compiled files. Keep those exports intact: the plugin watches physical input paths and invokes each package's owning build callback. It does not substitute source aliases or choose a compiler.

Each package supplies:

| Field | Contract |
| --- | --- |
| `name` | The exact installed package name, excluded from dependency prebundling during development. |
| `root` | Its local directory, resolved physically so symlink targets are watched. |
| `watch` | Input paths relative to that directory; defaults to `['src']`. |
| `output` | Compiled output directory relative to the package; defaults to `dist`. Inputs and output must not overlap. |
| `build(signal)` | The existing package build, returning a promise that settles only after its work and cleanup finish. Honour cancellation and reject failed builds. |

Build the initial package exports before starting Vite. Changes queue builds serially in the supplied package order. Further edits during a build queue another pass. A successful batch uses Vite's existing connection to reload the browser; it does not restart application services. Build failures are reported through Vite and remain in `plugin.api.errors` until that package builds successfully. `plugin.api.isReady` is false during pending builds, after a failure and after shutdown. `plugin.api.stop()` cancels and awaits the current callback, and prevents queued work from starting; `closeBundle` calls that same idempotent shutdown.

Build callbacks own subprocesses, deadlines and coordination with other processes writing the same physical output directory. Two development servers must not concurrently run uncoordinated builds into shared output. Use the build system's existing lock/lifecycle mechanism; a callback that ignores cancellation can prevent shutdown. The plugin serialises its own callbacks only.

Resolve input and output boundaries physically before attaching watchers. An output symlink can escape a textually valid package path; the compiled-output directory must already exist and remain inside its package. Keep the escaping-symlink regression in the consumer suite.

The package list is explicit; it does not infer a dependency build graph. Supply dependency order for batches, and let the owning build command handle any additional required outputs. Do not use a destructive whole-repository clean/build when only one package changed. Compiler, dependency-link and development-server configuration changes still require their appropriate restart/setup operation.

This plugin uses the [Vite plugin lifecycle and HMR hooks](https://v6.vite.dev/guide/api-plugin). It adds no watcher service or browser socket implementation and is excluded from production builds with `apply: 'serve'`.

Build `@warpkit/vite-plugin` before running its tests: they import the compiled public package. `bun run --filter @warpkit/vite-plugin check:types` checks a standalone consumer against an explicit configuration, without adding Bun globals to the public API. Runtime test code uses the repository's normal test/compiler configuration. The local-package suite uses a real Vite server, a physically linked fixture package and Chromium; all edits and build output remain in its owned temporary directory.

The public local-package plugin type describes its implemented hooks and the native server operations they consume. Check it against Vite with `satisfies Plugin`, and annotate hook parameters explicitly so contextual inference does not expose unused environment classes from a second Vite installation. Verify the compiled public consumer and the linked application's compiler; never cast plugin objects to hide incompatible dependency types.
