# CLAUDE.md — rules for every agent in this repo

Travertine is a crop-rotation decision-support tool for the NASA Space Apps Challenge 2026 ("Field Shift: Adapting
Farms with NASA Data"). Two developers each run a Claude Code agent in this monorepo. Read this file fully before you
change anything. These rules override defaults; if a rule blocks you, stop and ask your human.

## 1. Ownership — who may edit what

| Agent | May edit | Must never edit |
|---|---|---|
| **Web agent** | `apps/web/**`, `packages/contract/**`, `.claude/**`, root config (`package.json`, `pnpm-workspace.yaml`, `.github/**`, `README.md`, `CLAUDE.md`, `docs/AI_USE.md`) | `services/engine/**` |
| **Engine agent** | `services/engine/**`, `docs/METHODOLOGY.md`, `docs/AI_USE.md` (append only) | `apps/web/**`, `packages/contract/**`, `.claude/**`, `.github/**` |

- **Change of ownership, 15 November 2026 (final hours of the hackathon):** the web agent ran out of usage and
  stopped (handover in issue #75). One agent now owns the whole repository: `apps/web`, `packages/contract`,
  `.claude`, `.github` and `services/engine`. Contract changes still go in their own `contract:` PR. The table above
  applies again if a second agent joins.
- If you need a change in an area you do not own, open an issue (or tell your human) describing exactly what and why.
  Do not make the change yourself, not even a one-line fix.
- The engine agent may add an engine CI job by asking the web agent; the root workflow already runs engine tests when
  `services/engine` contains them.

## 2. Contract first

- `packages/contract/openapi.yaml` is the single source of truth for every endpoint, field, type and unit.
- The engine implements it exactly. The web app consumes it through generated types (`pnpm contract:gen`).
- Every endpoint has exactly one realistic fixture in `packages/contract/fixtures/`. Fixtures must validate against the
  schema (`pnpm contract:lint` + the fixture test).
- **Any contract change is its own PR**, titled `contract: <what changed>`, with the reason in the description and no
  other changes in it. The web agent makes the edit; the engine agent requests it via an issue.
- Breaking changes need a new version path (`/v2`) or explicit agreement from both humans.

## 3. Git workflow

- `main` is protected. No direct pushes. Every change lands by pull request with passing CI.
- Branch names: `web/<short-topic>` for the web agent, `engine/<short-topic>` for the engine agent,
  `contract/<short-topic>` for contract PRs.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org): `feat(web): ...`, `fix(engine): ...`,
  `docs: ...`, `chore(ci): ...`, `test(web): ...`. Scope is `web`, `engine`, `contract`, `ci` or `docs`.
- Keep PRs small and single-purpose. Describe what changed, why, and how it was verified (tests, screenshots).
- Rebase on `main` before opening a PR. Never force-push `main`.

## 4. Secrets

- No secrets in the repo, ever: no API keys, tokens, Earthdata passwords, `.env` files or credentials in fixtures,
  tests, screenshots or commit messages.
- Only `.env.example` is committed, with empty values and a comment per variable.
- If a secret is committed by mistake, tell your human immediately; rotating it is required, deleting the commit is not
  enough.

## 5. Truth in data — non-negotiable

- **Never invent data.** Every number shown to a user, written in a fixture, or quoted in copy must come from a real
  dataset, a cited published source (e.g. FAO-56 Kc tables), or the engine's computation on real data.
- Fixtures must be realistic and traceable: values plausible for the stated location and, wherever possible, copied
  from a real engine or dataset response. Mark anything illustrative in the fixture's provenance `note`.
- Every response that carries data carries a `provenance[]` array. Every dataset shown in the UI shows its provenance.
- Show uncertainty and caveats as returned. Never hide, round away or soften a caveat or a weak correlation.
- No forecasts or projections that the engine does not compute from historical data.

## 6. Branding

- Do not use NASA logos, the NASA "meatball" or "worm", mission patches, or any NASA visual branding anywhere — not in
  the UI, favicon, Open Graph images, README or slides.
- Naming datasets factually is fine ("NASA POWER", "SMAP L4"). Do not imply endorsement. The standard disclaimer lives
  in the README and the app footer.

## 7. Language

- All repository content is in English: code, comments, commit messages, PRs, docs, fixtures.
- UI default language is English. Every user-facing string lives in locale files (`apps/web/src/i18n/*.json`); Turkish
  is a supported toggle. No hard-coded UI strings in components.

## 8. AI use

- `docs/AI_USE.md` records how AI tools are used. Update it in the same PR whenever you introduce a new AI-assisted
  workflow, tool or model. Humans review every change before merge.

## 9. Project skills — follow them

The web agent must follow every skill in `.claude/skills/` for all web work:

| Skill | Use when |
|---|---|
| `design-system` | Building or styling any UI |
| `visual-review` | After building or changing any screen — a screen is not done until its screenshots pass |
| `accessibility` | Any interactive element, colour or motion |
| `content-truth` | Any number, label, claim or copy shown to users |
| `data-viz` | Any chart, bar, gauge or map legend |

## 10. Definition of done (web)

A change is done only when all of these hold:

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass locally.
2. The `visual-review` skill was run for every touched screen at 390, 768 and 1440 px and its defects were fixed.
3. Empty, loading and error states exist for every request on the screen.
4. Every displayed number traces to the API or a contract fixture (`content-truth`).
5. Strings are in both locale files.

## 11. Commands

```bash
pnpm install          # once, at the repo root
pnpm dev              # web app on http://localhost:3000 (fixtures unless NEXT_PUBLIC_ENGINE_URL is set)
pnpm lint | pnpm typecheck | pnpm test | pnpm build
pnpm contract:lint    # validate openapi.yaml
pnpm contract:gen     # regenerate packages/contract/src/schema.d.ts
```

Engine commands are documented in `services/engine/README.md` by the engine agent.

## 12. Notes for Next.js

`apps/web` uses Next.js 16. Its APIs differ from older versions. Read `apps/web/AGENTS.md` and the guides in
`apps/web/node_modules/next/dist/docs/` before writing framework code.

## 13. Design — the teammate's design is the design

The interface adopted from `feat/travertine-ui-cosmo-tour` (styles in `apps/web/src/app/travertine-ui.css`, the header
with the section rail, the card frame, the Cosmo guide) is **the** design of Travertine. Every existing page moves to
it, and every new page, or page without a design, is built in it. The prototype under `design-reference/` (for example
the rotation-plan and field-summary screens) is the visual reference. Truth-in-data, accessibility and brand rules
still apply: no stock photography, no navigation to features without a data source, the logo is never recoloured.
