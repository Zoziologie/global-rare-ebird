# Repository workflow

- Start substantive work with a GitHub issue that contains a short implementation checklist; small tasks may keep the plan directly in the PR.
- Work on a `codex/` branch and open a draft PR once a concrete diff is available. Link its issue with `Closes #NUMBER` and attach the PR to the Codex chat.
- Update the issue/PR checklist and post concise progress after meaningful milestones so the user can follow the work outside chat.
- Use conventional commit messages (`fix:`, `feat:`, `chore:`, `test:`, `docs:`) and describe the actual result in the PR.
- Follow CONTRIBUTING.md for semantic versions, changelog entries, and releases. Never lower the package version or move an existing release tag.
- Run `npm run check` and `npm audit` before marking a PR ready. Add deterministic behavior tests for bug fixes; tests must not require live credentials or network access.
- Keep implementation readable and practical. Avoid defensive guards, single-use helpers, broad formatting changes, and unnecessary abstractions.
- Do not merge a PR or publish a release unless the user explicitly requests it.
