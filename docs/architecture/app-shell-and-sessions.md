# App shell, sessions, and Play mode

Status: implemented foundation, 2026-11-18.

The app opens on a main menu (`src/components/app-shell/`) instead of generating a map at startup. Deep links
(`?maplink=`, `?seed=`) still skip the menu and open straight into an Editor session.

## Session kinds

`src/application/app-session.ts` owns the top-level screen (`menu` | `workspace`) and the running session.
Each session kind maps onto one workspace capability mode (`src/application/workspace-mode.ts`):

| Session  | Workspace mode | Map source                          | Document writes                         |
| -------- | -------------- | ----------------------------------- | --------------------------------------- |
| Editor   | `edit`         | new random map, `.map` import, library entry | saves and autosaves mirror into the library |
| Showcase | `view`         | seeded preset (`src/data/showcase-maps.ts`)  | none                                    |
| Play     | `play`         | library entry or showcase preset    | none; campaign state only               |

`play` has `map:inspect` + `simulation:command` and no `map:edit`/`map:generate`. Code that asks "may the
document change?" uses `isWorkspaceReadOnly()`, not `mode === "view"`. View and Play share one view session,
which starts and ends only when crossing the Edit boundary (`workspace-lifecycle.ts`).

Maps are always loaded or generated in `edit` mode, then the session switches to its own mode. Returning to
the menu saves a dirty Editor document into its library entry first. The loaded map stays behind the menu as its
backdrop.

## Map library

`src/services/io/map-library.ts` is a separate IndexedDB database (`fantasia-map-library`), so the legacy
`lastMap` quick-save slot is untouched. Every Editor session edits exactly one entry (the *active entry*).
`Save.saveToStorage` mirrors into it, which covers both manual and autosave. A map generated, loaded, or resampled
from inside the Editor becomes a new entry. Thumbnails come from `map-thumbnail.ts`, which renders a Pixi
raster frame; showcase thumbnails are cached in `localStorage` after the first visit.

Showcase worlds are seeds, not stored `.map` files, so they never go stale across save-format versions.

## Play mode layering

Follows [the grand strategy plan](../prd/grand-strategy-implementation-plan.md):

- `src/types/campaign/`: serializable `CampaignSetup` / `CampaignState` contracts.
- `src/generators/campaign/`: pure simulation (`createCampaign`, `advanceDay`). New systems plug into
  `advanceDay` in a fixed order. No DOM, Pixi, storage, or globals.
- `src/application/play-session.ts`: owns the campaign, the phase (`choosing-country` → `running`), and the
  clock driver (speeds 0–3, paused on start and when the tab is hidden).
- `src/components/app-shell/play-hud.tsx`: nation picker and campaign top bar. It reads `pack`, never writes it.

The campaign never mutates the source map. Ownership changes, armies, and the economy belong in `CampaignState`.
Not yet built: campaign save files, commands, AI, and any gameplay system beyond the calendar.
