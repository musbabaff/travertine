# AI use statement

Travertine is built by a two-person team with AI coding assistance. This file records how AI is used so judges,
contributors and users can weigh our work accordingly. It is kept current: any new AI-assisted workflow is added here in
the same pull request that introduces it.

## Tools

| Tool | Provider | Used for |
|---|---|---|
| Claude Code (Claude Opus models) | Anthropic | Code generation, refactoring, tests, documentation drafts, data-fetching scripts, visual review of screenshots |

## How it is used

- Each developer runs one Claude Code agent in this repository. Agent responsibilities and boundaries are defined in
  [`CLAUDE.md`](../CLAUDE.md); project rules are in [`.claude/skills/`](../.claude/skills/).
- **Every change is reviewed by a human before merge.** `main` is protected; changes land only through pull requests
  with passing CI.
- AI does not produce data. Numbers in the product come from public datasets (NASA POWER, MODIS, SoilGrids and
  others listed in the app's Data view) processed by code in this repository. Fixture-building scripts are committed so
  every fixture value can be regenerated and checked.
- AI is not used to write the back-test caveats' conclusions on our behalf without review; caveats are written and
  approved by the team.
- The product itself does not call any AI model at runtime. Rotation scores come from a deterministic model in
  `services/engine`.

## Log

| Date | Change |
|---|---|
| 2026-11-14 | Repository scaffold, contract, fixtures-from-public-data script, CI and project skills generated with Claude Code under human review. |
| 2026-11-14 | Engine (services/engine) foundation written with Claude Code (engine agent): FastAPI service, FAO-56 ET0, SoilGrids soil processing, cited crop table, tests and docs. FAO table values were extracted from the FAO-56 online edition by script and checked against the tables by the agent; humans review every PR. |
| 2026-11-14 | Rotation exploration, MODIS NDVI history and the `/v1/validation` back-test written with Claude Code (engine agent). The validation protocol was committed before results were computed; citations (FAO-56 examples, DOIs) were checked against the source pages by the agent. Humans review every PR. |
| 2026-11-14 | Brand assets: the original logo and favicon set were supplied by the team. Claude Code wrote the scripts that trace the logo with potrace (a deterministic tracer, not a generative model), compose the lockups by translation and uniform scaling only, render the icons and social images, and check the trace against the original pixels (IoU 0.990 / 0.991). No AI image generation was used for derived assets. |
