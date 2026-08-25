Fantasia is a web application for procedurally generating, editing, and visualizing fantasy maps. It is a fork of Azgaar's Fantasy Map Generator (FMG); preserve upstream attribution and compatibility where applicable.

Before making architectural decisions, read the root `CONTEXT.md`. Use the documentation that matches the task:

- `docs/architecture/architecture.md` before architectural or layer-boundary changes.
- `docs/architecture/data_model.md` before changing serialization or `grid` / `pack` data.
- `docs/domain/glossary.md` when domain terminology is unclear.

Before handoff, run the narrowest relevant verification and report what you ran (and what you did not run). Do not automatically run Playwright tests.
