# AI use statement

Travertine is built by a two-person team with AI coding assistance. This file records how AI is used so judges,
contributors and users can weigh our work accordingly. It is kept current: any new AI-assisted workflow is added here in
the same pull request that introduces it.

## Tools

| Tool | Provider | Used for |
|---|---|---|
| Claude Code (Claude Opus models) | Anthropic | Code generation, refactoring, tests, documentation drafts, data-fetching scripts, visual review of screenshots |
| OpenAI Codex | OpenAI | A teammate used it to build the current interface (layout, header, overview dashboard) and the Cosmo guide, under human review |

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
| 2026-11-14 | Container start fix and committed demo-field snapshot written with Claude Code (engine agent); verified offline as a non-root user before merge. Humans review every PR. |
| 2026-11-15 | Interface and Cosmo guide: a teammate used OpenAI Codex, alongside Claude Code, to build the new interface and the Cosmo guide (branch `feat/travertine-ui-cosmo-tour`), under human review. The 3D model `apps/web/public/cosmo.glb` was exported with three.js (its glTF header records `THREE.GLTFExporter r187`): 52 meshes and eight animation clips (idle, wave, point, cheer, jump, walk, think, sleep), no image textures. The SVG mascot is hand-written code. Cosmo answers only from fixed, reviewed text in the locale files; it uses no language model and generates no text. Claude Code merged the branch onto main, moved Cosmo's text into the locale files in English and Turkish, and added the glossary. |
| 2026-11-15 | Deployed-commit stamp on `/v1/health` and the farmer's current rotation as the baseline of `/v1/rotations/explore` (scored with the same model, rule violations listed, difference per score) written with Claude Code (a second engine agent session, Claude Fable 5.2). The additive contract change for it was made by the same agent with the humans' permission. The Turkish sentences were written by the model and need review by a Turkish-speaking agronomist. Humans review every PR. |
| 2026-11-15 | Structured reasoning per strategy (EN/TR) written with Claude Code (engine agent session). The sentences are templates filled with the engine's own numbers at run time; no AI model runs in the product. Turkish wording needs review by a Turkish-speaking agronomist. Humans review every PR. |
| 2026-11-15 | Climate hazards and crop calendar endpoints written with Claude Code (engine agent session, Claude Opus 5.5) under human review. |
