# Contributing to Travertine

Thank you for helping. Travertine is a small two-person project built for the NASA Space Apps Challenge 2026; every
change goes through a pull request with passing checks.

## Set up

Requirements: Node.js 22 or newer, pnpm 12 (`corepack enable`), Python 3.12 and [uv](https://docs.astral.sh/uv/) for
the engine.

```bash
pnpm install                      # web app and contract
pnpm dev                          # http://localhost:3000 on contract fixtures
cd services/engine && uv sync     # engine
uv run python -m uvicorn travertine_engine.main:app --reload --port 8000
```

Set `NEXT_PUBLIC_ENGINE_URL` in `apps/web/.env.local` to use a running engine (see `.env.example`).

## Who owns what

`CLAUDE.md` is the authority. In short: `apps/web`, `packages/contract`, `.claude` and repository tooling belong to
the web lead; `services/engine` and the engine documents (`docs/METHODOLOGY.md`, `DATA_SOURCES.md`, `MODEL_CARD.md`,
`VALIDATION.md`) belong to the engine lead. `.github/CODEOWNERS` requests the right reviewer automatically. If you need
a change in an area you do not own, open an issue instead of editing it.

## Contract first

`packages/contract/openapi.yaml` is the single source of truth for every endpoint, field, type and unit.

- The engine implements it exactly; the web app consumes it through generated types (`pnpm contract:gen`).
- Every endpoint has one realistic fixture in `packages/contract/fixtures/`, traceable to real data or real engine
  output.
- A contract change is its own pull request titled `contract: <what changed>`, with the reason in the description and
  no other changes. Request one with the **Contract change** issue form.
- Breaking changes need a new version path (`/v2`) or explicit agreement from both maintainers.

## Branches and commits

| Branch prefix | For |
|---|---|
| `web/<topic>` | Web app |
| `engine/<topic>` | Engine |
| `contract/<topic>` | Contract changes |
| `docs/<topic>` | Documentation only |

Commits follow [Conventional Commits](https://www.conventionalcommits.org): `feat(web): …`, `fix(engine): …`,
`contract: …`, `docs: …`, `chore(ci): …`, `test(web): …`. Keep pull requests small and single-purpose; rebase on
`main` before opening one.

## Tests

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # web and contract
pnpm contract:lint                                       # OpenAPI
pnpm --filter web test:e2e                               # Playwright end-to-end (builds the app)
cd services/engine && uv run pytest                      # engine
```

UI changes also follow the `visual-review` skill in `.claude/skills/`: screenshots at 390, 768 and 1440 px, defects
listed and fixed.

## Both READMEs together

`README.md` (English) and `README.tr.md` (Turkish) carry the same structure and the same facts. Update both in the
same pull request. CI fails when their structure drifts apart (`scripts/check-readme-parity.mjs`).

## Truth in data

Never invent a number. Every value shown to users, written in a fixture or quoted in a document must come from a real
dataset, a cited published source or the engine's computation on real data, and every data response carries
`provenance[]`. Caveats are shown as returned. See the `content-truth` skill.

## Review process

1. Open a pull request using the template; CI must pass (web and contract, engine tests).
2. CODEOWNERS requests a review from the owner of the touched area. Branch protection does not require approvals,
   but the owner is expected to look before merge.
3. Squash-merge into `main`. Production deploys automatically from `main`.

## Releases

Releases follow [Semantic Versioning](https://semver.org). To cut one: move the `[Unreleased]` entries in
`CHANGELOG.md` under a new version heading with today's date, merge that pull request, then push a tag `vX.Y.Z` on
`main`. The release workflow creates the GitHub release with that version's changelog section as its notes.

## Secrets

No secrets in the repository, ever. Only `.env.example` is committed. If a secret is committed by mistake, tell a
maintainer immediately; it must be rotated.

## Code of conduct

Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
