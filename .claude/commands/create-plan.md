# Create Plan Command

Create a new plan directory with index and section files.

## Usage

```
/create-plan <name> [description]
```

- `name`: Directory name for the plan (kebab-case, e.g., `build-pipeline`, `auth-providers`)
- `description`: Optional one-line description of the plan's goal

## Workflow

### Step 1: Gather Information

If not provided via arguments, ask the user:

1. **Plan name** — kebab-case directory name
2. **Plan title** — Human-readable title (e.g., "Build Pipeline")
3. **Goal** — One-line description of what this plan accomplishes
4. **Sections** — List of major sections (at least 2-3)

Use AskUserQuestion if needed to clarify scope.

### Step 2: Load Context

Read `CLAUDE.md` for project conventions and architecture. All plans must respect:

- Package architecture (monorepo with `@warpkit/*` scope)
- Svelte 5 runes and component patterns
- Build/publish pipeline (compiled JS, OIDC trusted publishing)
- Testing strategy (bun test, vitest, vitest-browser-svelte)
- Provider abstraction pattern
- No consumer-specific code in the framework

### Step 3: Create Directory Structure

Create the plan directory and files:

```
plans/{name}/
├── index.md           # Keyword index for discovery
├── 00-overview.md     # High-level goals and section summary
├── section-01-*.md    # First section
├── section-02-*.md    # Additional sections...
└── section-NN-*.md    # Final section (verification)
```

### Step 4: Generate index.md

Create the keyword index with:
- Maintenance notice at the top
- How to use instructions
- Keyword cluster for each section
- Quick reference table

### Step 5: Generate 00-overview.md

Create overview with:
- YAML frontmatter (plan name, title, status)
- Mission statement
- Architecture impact (which packages are affected)
- Design principles
- Section dependency graph
- Implementation sequence with phases and gates
- Estimated effort table

### Step 6: Generate Section Files

For each section, create `section-{NN}-{name}.md` with:
- YAML frontmatter (section ID, title, status: not-started, goal)
- Section header with status
- Context explaining WHY this section exists
- Placeholder subsections with `- [ ]` checkboxes
- Completion checklist at the end with exit criteria

The **last section** should always be a **Verification** section including:
- Test coverage (unit, package, browser)
- Quality gates (`bun run typecheck`, `bun run test`, `bun run test:packages`)
- Consumer smoke test (scaffold project, install, run)
- Documentation updates

### Step 7: Report Progress

Show the user:
- Files created (with paths)
- Note: "Running 4 independent review passes..."

### Step 8: Sequential Independent Review (4 Agents)

After the plan is fully created, run **4 review agents in sequence** (NOT parallel). Each agent:

- Receives **only the plan files** — no conversation context
- Is instructed to **read the plan, review it, and edit the files directly** to fix issues
- Sees edits made by all previous agents (because they run sequentially)

**IMPORTANT**: Run these agents ONE AT A TIME. Wait for each to complete before starting the next.

#### Agent 1: Technical Accuracy Review

```
You are reviewing a plan for the WarpKit OSS framework at {plan_dir}/.

INSTRUCTIONS:
1. Read ALL files in {plan_dir}/ (index.md, 00-overview.md, and all section-*.md files)
2. Read CLAUDE.md for project conventions
3. Cross-reference every technical claim against the actual codebase:
   - Do referenced files, types, packages exist?
   - Are package dependency assumptions correct?
   - Are described code patterns accurate for Svelte 5 runes?
4. For every inaccuracy found, EDIT the plan files directly to fix them
5. Add a brief comment near each fix: <!-- reviewed: accuracy fix -->

After editing, list what you changed and why.
```

#### Agent 2: Completeness & Gap Review

```
You are reviewing a plan for the WarpKit OSS framework at {plan_dir}/.

INSTRUCTIONS:
1. Read ALL files in {plan_dir}/ (index.md, 00-overview.md, and all section-*.md files)
2. Review each section for completeness:
   - Are there missing steps that would block implementation?
   - Are edge cases and error handling accounted for?
   - Are dependencies between sections correctly identified?
   - Are test strategies adequate?
3. Check for missing considerations:
   - Does it affect the build/publish pipeline?
   - Does it affect the scaffolding CLI (create-warpkit)?
   - Does it affect existing consumers?
   - Are breaking changes identified?
4. For every gap found, EDIT the plan files directly to add missing content
5. Add a brief comment near each addition: <!-- reviewed: completeness fix -->

After editing, list what you changed and why.
```

#### Agent 3: OSS & Consumer Review

```
You are reviewing a plan for the WarpKit OSS framework at {plan_dir}/.

INSTRUCTIONS:
1. Read ALL files in {plan_dir}/ (index.md, 00-overview.md, and all section-*.md files)
2. Read CLAUDE.md for project conventions
3. Review the plan from an OSS consumer perspective:
   - Will this work when installed from npm? (not just in the monorepo)
   - Does it require special consumer-side configuration?
   - Is the API ergonomic and well-typed?
   - Are there breaking changes that need migration guides?
   - Does it follow Svelte ecosystem conventions?
4. Check framework-agnostic requirements:
   - No consumer-specific code (Upstat, etc.)
   - No hardcoded paths or versions
   - Compiled JS ships to npm (not raw source)
5. For every issue found, EDIT the plan files directly to fix them
6. Add a brief comment near each change: <!-- reviewed: oss fix -->

After editing, list what you changed and why.
```

#### Agent 4: Clarity & Consistency Review

```
You are reviewing a plan for the WarpKit OSS framework at {plan_dir}/.

INSTRUCTIONS:
1. Read ALL files in {plan_dir}/ (index.md, 00-overview.md, and all section-*.md files)
2. Review for clarity and internal consistency:
   - Are section descriptions clear and unambiguous?
   - Do checklist items describe concrete, actionable tasks (not vague goals)?
   - Is terminology consistent across sections?
   - Does the overview accurately reflect the section contents?
   - Does index.md have accurate keyword clusters?
   - Are there contradictions between sections?
3. For every issue found, EDIT the plan files directly to improve clarity
4. Sharpen vague checklist items into specific, verifiable tasks
5. Fix inconsistent terminology
6. Update the overview if sections have changed during prior reviews
7. Remove all <!-- reviewed: ... --> comments left by previous reviewers (clean up)

After editing, list what you changed and why.
```

### Step 9: Report Summary

Show the user:
- Files created (with paths)
- Summary of what each review agent changed
- Next steps

---

## Section Naming Conventions

| Section Type | Naming Pattern |
|--------------|----------------|
| Package Setup (exports, types, build) | `section-01-package-setup.md` |
| Core Implementation | `section-02-implementation.md` |
| Svelte Components | `section-03-components.md` |
| Testing | `section-04-testing.md` |
| Documentation | `section-05-docs.md` |
| Verification | `section-NN-verification.md` |

Adapt to the plan's needs. Not every plan needs all sections.

---

## WarpKit-Specific Plan Requirements

Plans that touch framework code MUST account for:

- **Package boundaries** — which `@warpkit/*` packages are affected?
- **Build pipeline** — do affected packages have Svelte files requiring vite build?
- **Publish impact** — will `workspace:*` deps resolve correctly?
- **Consumer impact** — does `bun add @warpkit/core` + `bun dev` still work?
- **Type exports** — are new types properly exported from package entry points?
- **Testing layers** — unit (bun test), package (vitest), browser (vitest-browser-svelte)

Quality gate checkpoints:

```markdown
## X.N Quality Gates

- [ ] `bun run typecheck` — zero errors
- [ ] `bun run test` — all pass
- [ ] `bun run test:packages` — all pass
- [ ] Consumer smoke test — scaffold, install, dev server runs
```

---

## After Creation

Remind the user to:
1. Fill in section details with specific tasks
2. Add relevant keywords to `index.md` clusters
3. Update `00-overview.md` with dependencies and success criteria
