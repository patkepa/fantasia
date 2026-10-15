Fantasia is a web application for procedurally generating, editing, and visualizing fantasy maps. It is a fork of Azgaar's Fantasy Map Generator (FMG); preserve upstream attribution and compatibility where applicable.

Before making architectural decisions, read the root `CONTEXT.md`. Use the documentation that matches the task:

- `docs/architecture/architecture.md` before architectural or layer-boundary changes.
- `docs/architecture/data_model.md` before changing serialization or `grid` / `pack` data.
- `docs/domain/glossary.md` when domain terminology is unclear.

Do not write new tests by default. Add tests only when the user explicitly requests them or when a high-risk change needs coverage that existing tests cannot provide (for example, save/load compatibility, migrations, or world-state integrity). Keep any necessary test changes focused; do not expand test coverage as routine cleanup.

Before handoff, run the narrowest relevant verification, preferring existing checks, and report what you ran (and what you did not run). Do not automatically run Playwright tests.
