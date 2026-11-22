# Contributing to AcademyOS

- Keep the product in its own repository. Never mix its files with unrelated applications.
- Use stable dependencies. Update and commit the pnpm lockfile after installing.
- Use Tailwind 4 utilities and design tokens; avoid large handwritten CSS systems.
- Each new API route needs server-side authorization by workspace, input validation and tests.
- Never expose OAuth credentials or student records in logs, source, prompts or example commits.
- Prefer incremental PRs per epic in docs/BACKLOG.md.
- Format and linting are planned as part of the initial CI-hardening issue.
