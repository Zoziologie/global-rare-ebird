# Working on the site

## Plan and progress

Start substantive work with a GitHub issue containing the problem, the intended result, and a short checklist. For a small fix, the checklist can live directly in the PR. Use a `codex/` branch for agent work and open a draft PR as soon as there is code to review.

Link the issue in the PR with `Closes #NUMBER`. Update the checklist and add a concise progress comment after each meaningful milestone, including what passed, what failed, and what remains. Rewrite the PR description around the final result before requesting review. Keep merging as a separate, explicitly requested step.

## Local development and debugging

Use a supported Node.js version (22.13+, 24, or 26+). Install with `npm ci` and follow the environment setup in README.md. `npm run dev` provides Vite's local server, error overlay, and source maps. Vue Devtools and your browser's Network and Performance panels are useful for inspecting reactive state, requests, and rendering.

- `npm run lint`: JavaScript and Vue correctness checks.
- `npm run lint:fix`: apply ESLint's available fixes, then review the diff.
- `npm test`: run deterministic regression tests once.
- `npm run test:watch`: rerun relevant tests during development.
- `npm run check`: run lint, tests, release checks, and the production build.
- `npm audit`: check dependencies for known vulnerabilities.

Tests live in `tests/`. Use fixed observations and mocked HTTP responses; do not require live keys or network services. Add regression tests for behavior that can fail, especially request races, filtering, grouping, and sharing. Check changed browser interactions on desktop and mobile when needed. Record manual browser checks in the PR.

## Versions and releases

`package.json` is the version source. Keep `package-lock.json`, a dated entry in CHANGELOG.md, and the `vX.Y.Z` release tag consistent.

- Patch: bug fixes, dependency maintenance, and tooling changes that preserve behavior.
- Minor: new features or user-visible capabilities. During `0.x`, a minor can also introduce incompatible changes.
- Major: incompatible changes once the project reaches `1.0`.

For a release, run `npm version patch --no-git-tag-version` (or `minor`/`major`), add the dated changelog entry, and include both in the PR. Ordinary development can add notes under `Unreleased` until a release is prepared. CI verifies metadata consistency and prevents version rollback.

After the release PR is reviewed and merged, the existing workflow deploys `main`. To publish a GitHub release, run **Publish Release** from Actions on `main`. It installs the locked dependencies and reruns lint, tests, audit, release checks, and build before creating a `vX.Y.Z` tag at that exact commit with notes from CHANGELOG.md. Existing release tags cannot be reused. Release publication is manual; it does not commit or change code.

All code changes go through PR review. To enforce this at the repository level, a maintainer can configure a ruleset for `main` requiring a PR and the `checks` status. Repository protection settings are managed separately from these source files.
