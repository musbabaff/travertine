## What and why

<!-- What changed, why, and which issue it closes (e.g. Closes #12). -->

## How it was verified

<!-- Tests run, screenshots reviewed, live checks. -->

## Checklist

- [ ] Branch and title follow the conventions (`web/*`, `engine/*`, `contract/*`, `docs/*`; Conventional Commits).
- [ ] Tests pass locally (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; `uv run pytest` for the engine).
- [ ] UI changes passed the `visual-review` skill at 390, 768 and 1440 px.
- [ ] Docs updated where behaviour changed, including `docs/AI_USE.md` for a new AI-assisted workflow.
- [ ] `README.md` and `README.tr.md` updated together, if either changed.
- [ ] No invented data: every number traces to a dataset, a cited source or the engine; caveats shown as returned.
- [ ] No secrets, credentials or `.env` files.
- [ ] A contract change is alone in this pull request, titled `contract: …`.
