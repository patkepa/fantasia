# Domain Workspace and Global-Decoupling Plan

## Status

Proposed. This plan coordinates two continuing migrations:

1. make the workspace an editor organized around world domains rather than legacy dialogs and implementation terms;
2. retire ambient global coupling incrementally without breaking supported browser APIs, legacy map loading, or `.map`
   compatibility.

It builds on, and does not replace:

- [UI migration plan](ui_migration_plan.md) for shared Kantzen UI and individual panel work;
- [Workspace View and Edit Mode plan](workspace-view-edit-mode-plan.md) for capabilities, view-session state, and
  document-mutation semantics;
- [Legacy Code and Compatibility Policy](legacy-code.md) for the removal rules of runtime and saved-map seams;
- [Runtime Compatibility Inventory](runtime-compatibility-inventory.md) for deliberate remaining globals.

## Desired outcome

Users can keep the map in view while they search, inspect, and edit the world. The workspace gives them a consistent
way to find commands and a contextual inspector for the selected cell, burg, state, or route. It does not put map
state in React, and it does not make React components responsible for rendering Pixi scenes.

Contributors invoke typed commands and typed controller APIs. New bundled TypeScript does not read or mutate ambient
`pack`, `grid`, `style`, or `options` state. A `window.*` access remains only when it is a browser platform API, a
third-party integration, a tested external API, or a documented temporary compatibility bridge.

```text
map input / hotkey / toolbar / overview row
                 |
                 v
          command registry and capability guard
                 |
       +---------+----------+
       v                    v
inspect command        edit/generate command
       |                    |
       v                    v
selection session     typed controller mutation
       |                    |
       v                    +--> renderer invalidation
inspector view model   +--> map:mutated --> dirty/autosave
       |
       v
workspace panel; map stays visible
```

## Scope and constraints

### In scope

- Complete and apply the shared workspace foundation: fields, tables, confirmation, feedback, loading and empty
  states, focus behavior, and toasts.
- Evolve the current typed tool registry into the single discoverable command catalog for workspace, map, and entity
  actions.
- Add a transient selection session and contextual inspectors for cells, burgs, states, and routes.
- Give controller calls explicit typed inputs and outputs, including whether a document mutation committed.
- Inventory, classify, migrate, and remove inappropriate globals in small, independently releasable changes.
- Replace broad dirty signals with committed mutation notifications as workflows are migrated.

### Out of scope

- Rewriting `pack`, `grid`, or their typed arrays into immutable state.
- Replacing every editor or every legacy dialog in one program.
- Removing a global merely because no in-repository caller is found; integrations and user scripts may depend on it.
- Changing the `.map` schema or deleting versioned load migrations.
- Introducing a general-purpose event bus, state-management library, or new production dependency.
- Adding undo/redo as a side effect of this plan. Mutation metadata should make a future history feature possible, but
  history remains a separate product decision.

## Current baseline

The project has useful starting points:

- `src/components/ui/` already contains workspace panel, field, confirmation, dialog, feedback, tab, and data-table
  compositions. The remaining task is to exercise every composition in real domain workflows and keep the API small.
- `src/components/tool-registry.ts` already provides stable IDs, domain groups, shortcuts, search terms, capability
  metadata, and typed controller invocation for tools.
- `src/application/workspace-mode.ts` and `src/application/view-session-state.ts` own capability policy and transient
  workspace state. Map document state must not move into either module.
- `src/services/map-mutation.ts` and `src/controllers/editor-mutations.ts` establish a semantic `map:mutated` event
  and change results for some editors. Autosave still has a temporary DOM input/change compatibility path.
- `src/application/application-state.ts` owns the mutable application state and intentionally installs compatibility
  accessors. `src/types/global.ts` records many remaining ambient types.

The previous audit counted 1,158 `window.` or `globalThis.` usages in TypeScript. That is an inventory signal, not a
success metric by itself: it includes platform operations (`window.addEventListener`), tests, and documented bridges.
Progress is measured by classifying and removing *inappropriate application coupling*, not by making the raw text
count reach zero.

## Architecture decisions

### 1. The workspace uses domain vocabulary

The primary navigational domains remain:

| Domain | Includes |
| --- | --- |
| World | heightmap, climate, biomes, population, units, name bases |
| Politics | states, provinces, diplomacy, cultures, religions, emblems, military |
| Settlements | burgs, markets, goods, production, trade |
| Geography | coastlines, rivers, routes, zones, markers, labels, notes, relief |
| Analysis | cell details, charts, profiles, comparisons, diagnostics |
| Create and Regenerate | explicitly destructive or generative actions |

The command catalog owns this vocabulary. Navigation labels, panel headings, command search, keyboard help, context
menus, and inspector action labels consume the same metadata. Do not reintroduce one-off lists inside sidebar,
toolbar, overview, or guided-tour components.

### 2. Extend the command catalog; do not build a second registry

Keep `ToolCommand` as the starting point, then generalize it only when an action cannot be expressed accurately. A
command must have a stable ID, label, description, icon, domain, search terms, required capability, and invocation
function. Add explicit metadata for:

- `kind`: `"inspect" | "edit" | "create" | "generate" | "document" | "view"`;
- selection requirements, such as `"cell"`, `"burg"`, `"state"`, or `"route"`;
- confirmation requirements and destructive copy;
- availability/disabled reasons; and
- preferred presentation (`panel`, `dialog`, `placement`, or `map mode`).

Command execution is the one place that checks workspace capability, active customization, selection requirements,
and confirmation. It returns an explicit result such as `executed`, `blocked`, `unavailable`, `missing-selection`,
or `cancelled`. Presentation components display those outcomes but never bypass the executor.

Existing compatibility `controlId`s may remain in command metadata while a workflow is being ported. They are not a
new API: remove each ID and the `executeLegacyCommand` path in the same PR that makes its typed controller action
authoritative.

### 3. Shared UI components stay data- and renderer-agnostic

Project-level compositions live under `src/components/ui/`. They may accept values, callbacks, and explicit view
models, but may not import `pack`, `grid`, `style`, Pixi display objects, or SVG selectors.

The supported foundation is deliberately narrow:

- panel header, section, action row, search, empty, loading, and inline feedback;
- text, number, select, range, toggle, color, and action field compositions;
- modal, confirmation, prompt, toast, tooltip, and focus-return behavior;
- tabs and accessible data tables with stable row focus; and
- responsive panel and bottom-sheet placement primitives.

Use Kantzen primitives where available. Add a project composition only for a repeated Fantasia-specific pattern; do
not wrap every primitive pre-emptively.

### 4. Selection is transient application state

Add no selection data to `pack`, `grid`, saved style, or `.map` serialization. The selection session owns a stable
domain reference and ephemeral presentation state, for example:

```ts
type MapSelection =
  | { kind: "cell"; id: number }
  | { kind: "burg"; id: number }
  | { kind: "state"; id: number }
  | { kind: "route"; id: number };
```

It also owns open/closed inspector state and temporary highlight intent. Pixi picking and map context menus publish a
selection; renderers consume the highlight as an interaction-overlay input. The selection session must clear or
revalidate references after map load, regeneration, deletion, and mode transitions.

### 5. Inspectors consume view models, not live entities

Each domain exposes a typed adapter that derives an immutable inspector view model from the current world state. The
adapter performs validation and relationship lookup, but no mutation or renderer work. The React inspector receives
only that model and sends user actions back through commands/controllers.

Every inspector has:

1. a stable title, type, map-location action, and close action;
2. key facts and relationships useful for a writer, GM, or cartographer;
3. links to related entities and analysis views;
4. a capability-aware edit action; and
5. loading, removed, and unavailable states.

The first four inspector slices are deliberately small:

| Slice | Read-only content | First edit handoff |
| --- | --- | --- |
| Cell | coordinates, height, biome, population, culture/state/province, feature, river/route and burg references | Cell Info or relevant domain editor |
| Burg | population, state/culture, market, production, port, labels and nearby routes | Burg editor |
| State | capital, population, culture, provinces, diplomacy, treasury and military summary | States editor |
| Route | type, endpoints/linked cells, length, group and connected burgs | Route editor |

An inspector is read-only in View mode. In Edit mode its buttons may open the appropriate controller, but inline
editing is deferred until that controller exposes a tested typed mutation API.

### 6. Mutations have a common commit boundary

A mutation helper must not be a generic proxy around all writes. It should be a small controller-facing contract that
records a *committed* document change only after the controller has validated and applied it.

The standard result includes at least:

- `changed`, `source`, and affected domain/cell IDs;
- affected renderer layers or a typed invalidation request; and
- whether it is document, semantic style/configuration, or transient session state.

For a committed document mutation, the controller sequence is:

1. check the command capability before lazy-loading or opening the editor;
2. validate and apply the typed state change;
3. invalidate the affected renderer scenes;
4. publish exactly one `map:mutated` event when `changed` is true; and
5. update selection/inspector data if the selected entity changed or was removed.

Temporary brush assignments, drag previews, hover state, dialog field values, and View-mode overrides must not emit
`map:mutated`. The final Apply/Commit action does. Existing `EditorMutationResult` can be evolved toward this shape;
do not create a parallel mutation-event convention.

### 7. Global removal follows an explicit classification

Before changing a global, add or update an inventory row with one of these classifications:

| Class | Examples | Policy |
| --- | --- | --- |
| Browser platform | `window.addEventListener`, `document`, `localStorage` | Keep where the browser API is the right dependency; wrap only when it clarifies ownership or improves tests. |
| Third-party integration | Dropbox, JSZip, TinyMCE, RgbQuant | Keep behind an owning service/controller and document load/lifecycle behavior. |
| Supported external API | documented `window.*` integration surface | Treat as public; version or deprecate before removal. |
| Temporary compatibility bridge | `window.Controllers`, state accessors, an old renderer helper | Give it an owner, callers, removal condition, and focused test. |
| Inappropriate bundled coupling | migrated TypeScript calling an imported module through `window`, or reading bare ambient `pack` | Replace with a legal typed import, injected dependency, selector, or controller API. |
| Test-only shim | globals created solely by Vitest setup | Keep out of production counts; improve the test environment when it masks browser behavior. |

`runtime-compatibility-inventory.md` is the source of truth for bridge classes, owners, and removal conditions. It
must not become a list of every legitimate DOM call.

## Sequenced implementation plan

Each phase is a separately reviewable PR or small PR series. Complete the stated exit criteria before starting a
dependent phase. The sequence deliberately completes foundation and commands before adding new workspace panels.

### Phase 0 — Baseline, ownership inventory, and guardrails

**Scope**

- Produce a machine-readable report of `window.`/`globalThis.` use split by production source, tests, platform calls,
  third-party integrations, compatibility bridges, and inappropriate application coupling.
- Add owner, current callers, and removal proof for every temporary bridge touched by this program.
- Inventory all command entry points: sidebar, toolbar, hotkeys, map context menu, map click, overview rows, inline
  HTML, dialogs, guided tour, and public compatibility APIs.
- Record whether each action is inspect, edit, create, generate, document, or view; whether it needs a selection; and
  its capability.
- Establish a representative current-map fixture and a canonical serializable snapshot helper for mutation tests.

**Exit criteria**

- Every selected pilot workflow has an owner and path through the command executor.
- The report separates legitimate browser use from migration debt.
- A new inappropriate bundled global access fails a focused lint/test gate or is explicitly waived in the inventory.

**Suggested branch:** `chore/workspace-global-baseline`

### Phase 1 — Finish the shared UI foundation

**Scope**

- Stabilize the existing shared panel, field, dialog, feedback, tabs, and data-table APIs; document examples beside
  `ui_conventions.md`.
- Exercise number, range, select, and color fields in one focused, existing workflow; exercise tabs and the table in
  one focused overview. Prefer migration work already planned over synthetic demos.
- Add a single application toast host with queueing, polite/error announcements, duplicate suppression, and focus-safe
  action buttons. Replace only new/migrated workflow notifications first; do not mass-replace legacy `tip` calls.
- Define responsive behavior: a resizable side panel on wide screens, a non-obscuring overlay/bottom sheet on narrow
  screens, and a visible map interaction escape route.
- Verify focus trapping, Escape, focus restoration, labels, disabled reasons, loading, and error states.

**Exit criteria**

- Every foundation primitive is used in a production workflow and covered by focused tests.
- No shared UI component imports world state, renderer code, or direct DOM IDs outside its own mounted subtree.
- The workspace sidebar is split into panel modules before another substantial feature is added to it.

**Suggested branch:** `feat/workspace-ui-foundation-complete`

### Phase 2 — Unify the command catalog and entry points

**Scope**

- Generalize the existing tool registry with command kind, selection requirement, presentation, availability, and
  confirmation metadata.
- Add the missing Analysis domain without duplicating command arrays in the sidebar or toolbar.
- Create typed lookup and execution APIs, for example `getCommand(id)`, `getAvailableCommands(context)`, and
  `executeCommand(id, context)`. Keep static command IDs as literal types.
- Route toolbar actions, map-context actions, entity inspector actions, and migrated overview-row actions through this
  executor. Preserve existing shortcuts and record intentional changes.
- Move registration of command search terms, labels, and shortcut help into the catalog.
- Use compatibility `controlId` only as an adapter while an old controller owns an action. Add a test that proves the
  typed command remains reachable before removing that adapter.

**Exit criteria**

- All pilot workflow entry points share capability, customization, confirmation, and disabled-reason handling.
- A blocked command does not load an editor chunk or mutate state.
- Search finds commands by domain noun and action verb; keyboard help comes from the same metadata.
- No new sidebar/tool/inspector component defines a local command catalog.

**Suggested branch:** `feat/workspace-command-catalog`

### Phase 3 — Selection session and inspector contracts

**Scope**

- Extend the existing view-session state with typed `MapSelection`, subscription, clear, revalidation, and transient
  highlight APIs. Keep selection non-serialized.
- Connect Pixi `MapHit` results, tooltip/context-menu selection, and Escape to the session. Do not expose Pixi display
  objects outside renderers.
- Define `CellInspectorModel`, `BurgInspectorModel`, `StateInspectorModel`, and `RouteInspectorModel`, plus pure
  selector functions that return unavailable/removed states safely.
- Build a generic inspector shell with title, breadcrumbs/relationships, map-location action, status, close, and a
  capability-aware primary action.
- Define load, regeneration, deletion, and View/Edit transition behavior for selection and open inspectors.

**Exit criteria**

- Selecting a supported entity opens or updates one inspector without modifying the canonical map snapshot.
- Selection highlight uses the interaction overlay and clears deterministically.
- Inspector rendering contains no direct `pack`, `grid`, `window`, SVG, or Pixi access.

**Suggested branch:** `feat/workspace-selection-inspector-foundation`

### Phase 4 — Ship the four pilot inspectors

Ship one inspector per PR, with a shared QA checklist. Use read-only information first; handing off to an established
editor is safer than duplicating incomplete mutation UI.

1. **Cell inspector:** establish the map-click-to-inspection flow and relationship navigation.
2. **Burg inspector:** exercise point selection, derived economy data, and an overview-row-to-map-to-inspector loop.
3. **State inspector:** exercise rich relationships, typed summary aggregation, and selection revalidation after
   regeneration.
4. **Route inspector:** exercise line selection, route geometry references, and editor handoff.

For every inspector, test missing/removed entities, View versus Edit action availability, keyboard navigation, narrow
layout, map pan/zoom preservation, and no mutation while inspecting.

**Exit criteria**

- The map remains visible and interactive around the panel at supported viewport widths.
- An inspector can be opened, switched to a related entity, closed, reopened, and survive benign renderer redraws
  without duplicate listeners or stale data.
- The corresponding controller action is invoked through a typed command, not a hidden button click, when a typed API
  exists.

**Suggested branches:** `feat/inspector-cell`, `feat/inspector-burg`, `feat/inspector-state`, and
`feat/inspector-route`

### Phase 5 — Migrate overview tables around selection

**Scope**

- Move Burgs, States, and Routes overviews first to the shared table and inspector navigation pattern.
- Give rows stable domain IDs, accessible roving focus, search/sort/filter state, empty/filtered-empty states, and
  explicit actions: inspect, locate, and edit when allowed.
- Keep table state in the workspace session. Derive row data as typed view models rather than holding world entities in
  React state.
- Measure large-map row rendering before adding virtualization or pagination.

**Exit criteria**

- Selecting a row, map feature, or related inspector link resolves to the same domain identity.
- Table edits use a controller command and refresh only affected view models.
- The overview remains responsive on documented large-map fixtures.

**Suggested branches:** `feat/overview-burgs`, `feat/overview-states`, `feat/overview-routes`

### Phase 6 — Convert domain panels in value order

Once the foundation, command catalog, and inspector pilots work, migrate the remaining workspace in this order:

1. Style and Options, using serializable semantic style/configuration adapters.
2. New Map, Save, Load, and Export, using the shared progress, validation, confirmation, and toast system.
3. The remaining settlement and geography overviews/editors.
4. Politics editors and denser analysis surfaces.
5. Specialized full-workspace tools such as heightmap editing.

Each migration must remove one legacy dependency or document why it remains. Do not mix a UI redesign with generator
or renderer logic changes unless a typed boundary is necessary to make the UI safe.

**Exit criteria**

- Each migrated panel is domain-named, command-reachable, capability-aware, lifecycle-owned, and map-preserving.
- It has deliberate empty, loading, validation, error, destructive, and keyboard behavior.
- Legacy static markup becomes removable only after runtime parity is tested.

### Phase 7 — Standardize mutation commit boundaries

**Scope**

- Audit each migrated controller for direct writes to document state, style, configuration, notes, and persisted layer
  settings.
- Reuse/evolve `EditorMutationResult` instead of introducing a second result type. Require `changed: false` for no-op
  operations and one source identifier per actual commit.
- Make renderer invalidation explicit at controller boundaries; renderers never decide that a document mutation
  occurred.
- Publish `map:mutated` once per commit and migrate dirty tracking away from the broad DOM `input`/`change` fallback
  as corresponding controls are moved.
- Add document-snapshot tests for inspector use, table filtering, selection, dialog cancel, drag preview, apply,
  regenerate, load, save, and export.

**Exit criteria**

- A no-op, preview, or cancelled dialog does not mark the document dirty.
- A committed mutation invalidates the correct renderer data and marks dirty exactly once.
- Save and export leave the live canonical document snapshot unchanged.
- The DOM dirty fallback has a shrinking, documented list of remaining legacy owners.

**Suggested branch:** `refactor/mutation-commit-boundary`

### Phase 8 — Remove inappropriate globals from migrated workflows

Work domain by domain, starting where coupling is densest and currently being modified: style, options, IO, then
state/province/culture editors and remaining generators. For each workflow:

1. classify every ambient access in scope;
2. add a typed owner API or legal downward import;
3. migrate bundled TypeScript callers first;
4. retain a compatibility bridge only for known classic/external callers;
5. add a focused unit/integration test; and
6. update the compatibility inventory and remove the bridge/type only after its final caller is proven gone.

Do not make generators import controllers or renderers merely to remove a global; pass a narrow dependency or retain a
documented bridge at that layer boundary. Do not replace every `window` platform call with an abstraction.

**Exit criteria**

- Newly migrated modules have no inappropriate application-state globals.
- Each retained bridge has an owner, category, caller set, and removal condition.
- The production-only debt report falls monotonically for migrated domains; tests and browser APIs are reported
  separately.

**Suggested branches:** `refactor/style-state-boundary`, `refactor/options-state-boundary`,
`refactor/io-state-boundary`, and `refactor/<domain>-global-boundary`

### Phase 9 — Retire bridges and legacy UI by dependency

**Scope**

- Remove one compatibility bridge, its `Window` declaration, its static markup/hidden control, and its test fixtures
  together only when the last supported caller has moved.
- Update guided-tour targets, hotkeys, command catalog metadata, and documentation in the same PR.
- Keep old-map deserialization and preset adapters until a versioned compatibility policy explicitly retires them.
- Measure bundle and lifecycle effects after removing static panels and eager imports.

**Exit criteria**

- Repository searches, compatibility inventory, tests, and manual browser evidence agree that the bridge is gone.
- No removed bridge is silently restored as a workaround in a different module.
- The `.map` round-trip and relevant historical fixture remain compatible.

**Suggested branch:** `refactor/remove-legacy-<feature>`

### Phase 10 — Release hardening and operating model

**Scope**

- Run an accessibility and responsive audit of the workspace, inspector pilots, and destructive flows.
- Capture browser evidence for wide/narrow layouts, keyboard-only navigation, focus restoration, selection/pan/zoom,
  and large-map table behavior.
- Add developer diagnostics in non-production builds for a document mutation reported in View mode, selection of a
  removed entity, duplicate controller subscriptions, and unclassified newly added bridges.
- Publish contributor guidance: where a command, inspector model, controller mutation, view-session value, and
  compatibility bridge belong; include a short migration checklist in `migration_guide.md`.

**Exit criteria**

- The pilot journey—search command → inspect map feature → open related entity → enter editor → commit → see update →
  save/reload—works with mouse and keyboard and keeps the map visible.
- All changed documentation points to typed APIs rather than legacy selectors/globals.
- Remaining debt is explicitly inventoried, owned, and prioritized rather than accidental.

## Test and verification matrix

| Layer | Required evidence |
| --- | --- |
| Command catalog | metadata completeness, search, availability, selection requirement, blocked/no-lazy-load behavior, confirmation and shortcut routing |
| Shared UI | field semantics, disabled states, feedback/toast behavior, dialog focus containment/restoration, table row focus and empty states |
| Selection and inspectors | no document mutation, stale-ID handling, relationship navigation, View/Edit action gating, cleanup after load/regeneration/deletion |
| Mutations | changed/no-op/cancelled behavior, one dirty event per commit, correct renderer invalidation, canonical snapshot equality where appropriate |
| Compatibility bridge | full caller search, owner/inventory update, focused regression test, external API decision, type removal with bridge removal |
| Browser integration | narrow and wide workspace layout, keyboard-only interaction, map gesture preservation, command/inspector flow, large-map responsiveness |
| Serialization | current and representative legacy `.map` load/save round trips, save/export purity, persisted style/layer state where changed |

Run `npm run lint`, `npm run build`, and `npm run test -- --run` for every phase. Add targeted Playwright coverage as a
change is made; run the full end-to-end suite only when explicitly requested. Establish a clean unit-test baseline
before using the test suite as a migration gate.

## Metrics and milestones

Track outcomes, not vanity counts:

| Metric | Baseline | Target |
| --- | --- | --- |
| Shared UI primitives exercised in real workflows | foundation partly exercised | every supported primitive has a production consumer and test |
| Command entry points for pilot workflows | mixed registry/direct/legacy paths | one typed executor with documented compatibility adapters |
| Pilot entity inspectors | none | cell, burg, state, and route inspect safely in View and Edit modes |
| Direct ambient state use in newly migrated modules | currently permitted by legacy | zero inappropriate uses; legal bridges inventoried |
| Dirty tracking | semantic event plus DOM fallback | semantic commits for migrated workflows; fallback owner list only shrinks |
| Compatibility bridges | partial inventory | every retained bridge has owner, classification, test, and removal condition |
| Map visibility while working | dialog-dependent | pilot inspector and overview workflows preserve usable map interaction |

The raw `window`/`globalThis` count may be reported by class as a trend, but must never be a release gate on its own.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A registry becomes a new giant sidebar-specific abstraction | Keep metadata declarative, put executor policy in one module, and split panel rendering by domain. |
| Inspectors duplicate editor logic and drift | Start read-only; derive view models from pure selectors and hand off edits to typed controllers. |
| React retains stale world objects | Store stable IDs in selection/session state and recompute view models from current state after mutations. |
| A global removal breaks external users | Treat documented/public globals as APIs; inventory, deprecate, and test before removal. |
| Removing globals violates layering | Prefer legal downward imports; pass narrow dependencies or retain a documented bridge when the alternative couples a generator to UI/rendering. |
| Dirty state fires on previews or UI exploration | Require explicit `changed` commit results and canonical snapshot tests; keep session state non-serialized. |
| Workspace panel hides too much map on small screens | Define side-panel/bottom-sheet placement, preserve map gesture space, and test narrow viewports early. |
| Migration work grows without user-visible benefit | Ship the four inspectors and first overview loop before converting lower-value dialogs. |

## Definition of done

- [ ] Shared workspace compositions are stable, accessible, and exercised by real workflows.
- [ ] One command catalog supplies domain navigation, search, shortcuts, capability checks, confirmations, and pilot
      inspector actions.
- [ ] Cell, burg, state, and route inspectors are selection-driven, non-serialized, map-visible, and capability-aware.
- [ ] Migrated controllers commit typed mutations, issue correct invalidations, and publish one semantic dirty event.
- [ ] New bundled TypeScript contains no unclassified ambient application-state coupling.
- [ ] Every remaining compatibility bridge has an owner, reason, caller audit, test, and removal condition.
- [ ] Retired bridges are removed with their type declarations, static UI dependencies, tests, and documentation updates.
- [ ] Current and supported historical maps preserve their save/load behavior.
