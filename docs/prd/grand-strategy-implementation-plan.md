# Grand strategy implementation plan

Status: proposed implementation roadmap, 2026-10-15.

Fantasia should grow into a single-player, browser-based grand-strategy game through a playable conquest campaign.
The first priority is warfare and territorial expansion: recruit, maneuver, fight, occupy, negotiate peace, and
consolidate acquired territory. Economy and diplomacy initially provide the constraints that make those decisions
interesting. Deeper trade, politics, and naval systems follow after that loop works.

This plan preserves the map editor and Azgaar/FMG attribution. It supersedes the implementation sequencing and current
renderer assumptions in [the exploratory feasibility note](grand-strategy-game.md). It is a plan, not a statement
that the proposed game systems already exist. Single-player, desktop-first play and the numerical scope below are
planning assumptions; warfare and expansion are the selected product priority.

## Product scope

### First playable campaign

- A generated or imported world with 100–200 strategic provinces and 8–16 countries.
- One player country, with all remaining countries controlled by AI.
- A connected land theater; inaccessible islands are excluded from campaign objectives until transport exists.
- A paused start, daily calendar, and three speeds, provisionally 1, 5, and 20 game days per real second.
- Recruitment, army composition, movement, field combat, retreat, supply, occupation, and simple sieges.
- War declaration, one explicit territorial objective, peace terms, ownership transfer, and truces.
- Monthly income, maintenance, manpower recovery, and a defined response to insolvency.
- A regional conquest objective or a score evaluated at a fixed campaign date, with defeat and continued sandbox play.
- Save/load during movement, battle, and siege, followed by reproducible continuation.
- A target session of 60–120 minutes, to be revised through playtesting rather than enforced by simulation assumptions.

The first campaign must provide choices about where to attack, when to retreat, how much military spending is
sustainable, and whether to accept peace. More mechanics are useful only if they strengthen those choices.

### Scope after the first campaign

Develop a stronger strategy game in this order: diplomatic consequences of expansion; internal control of conquered
territory; military progression and country specialization; fleets and transport; persistent regional trade;
procedural events and scenario tools. Revisit this order after campaign playtests.

Multiplayer, historical Earth content, a general scripting language, and broad EU4 feature parity are outside the
first release. Keep future networking possible through command/state boundaries, without building a networking
stack now. Original rules, presentation, and content should express Fantasia's procedural-world identity.

## Existing foundation and reuse limits

| Area | Current foundation | Required game work |
| --- | --- | --- |
| Geography | Voronoi topology, terrain, rivers, routes, burgs | Compile a validated strategic graph and movement costs |
| Politics | States, provinces, cultures, religions | Stable campaign territories, legal ownership, occupation, country lifecycle |
| Rendering | Production Pixi renderer, domain picking, scene builders | Campaign projections, unit orders, occupation overlays, incremental updates |
| Workspace | View/Edit capabilities, transient view state, tool commands | Play capability, campaign inspectors, orders, and safe mode transitions |
| Economy | Production, markets, deals, taxes | Persistent monthly ledgers, expenses, manpower, later persistent inventories |
| Military | Generated regiments and manual battle UI | Recruitment, autonomous movement, deterministic combat, retreat, supply |
| Diplomacy | Generated relationships and campaign history | Live wars, validated diplomatic actions, peace transactions, AI decisions |
| Persistence | Map IO, migrations, document snapshots | Versioned campaign envelope, simulation state, RNG state, continuation tests |

Important source-level constraints:

- `src/generators/production-generator.ts` clears deals and market goods on regeneration. It is not a monthly tick.
- `src/generators/states-generator.ts` resets state treasury in `collectTaxes()`. Calling it every month would erase
  accumulated campaign finances.
- `src/controllers/battle-screen.ts` owns manual combat behavior and uses `Math.random()`. Extract or replace formulas
  behind explicit simulation inputs; do not invoke the screen as a campaign combat engine.
- `src/application/application-state.ts` centralizes application state but still installs compatibility globals.
  New campaign modules must not depend on those globals.
- `src/renderers/pixi/map-picking-index.ts` already supports province/state area picking. Extend existing picking
  rather than rebuilding it as a new project prerequisite.

The older feasibility note describes Pixi as a limited prototype. That is historical context, not today's baseline.
Likewise, the future JSON data-model document is a target direction, not evidence that current `.map` storage already
uses that schema.

## Architecture

### Separate map definition, campaign state, and presentation

```text
Fantasia generation or imported map
                 |
        scenario compiler and validator
                 |
       CampaignDefinition + initial CampaignState
                 |
player orders --> command validation <-- AI orders
                 |
        deterministic daily simulation
                 |
        committed state + changes + events
                 |
       +---------+-------------------+
       |                             |
campaign render projection     inspector view models
       |                             |
      Pixi                      HTML / React
```

Use three distinct ownership boundaries:

1. **Campaign definition:** geography, province membership, adjacency, settlement locations, initial scenario data,
   and resolved rules. Fixed for a running campaign.
2. **Campaign state:** date, countries, owner/controller assignments, armies, orders, wars, economy, pending actions,
   and simulation RNG state. Owned and mutated only by the simulation.
3. **Session and presentation:** camera, hover, selection, open panels, interpolation, caches, GPU resources, and speed
   preference. Disposable and outside canonical campaign state.

Keep the source map intact. Campaign ownership must not compete with `pack.cells.state` as a second authority.
Build campaign-specific render assignments from province ownership and the fixed cell-to-province mapping. Exporting
the campaign's political situation into an editable map is a separate explicit conversion.

Initially, starting Play takes a scenario snapshot. Returning to Edit ends or suspends that campaign; it does not
silently allow topology edits underneath active army paths. Editing a campaign map creates a new scenario/campaign.

### Provinces are the simulation unit

Cells remain geographic and rendering primitives. Armies travel on a province adjacency graph. Countries own
provinces; provinces own local strategic values. A province's owner and military controller are separate fields.

Compile existing administrative provinces into stable campaign province IDs. Validate and handle missing province
assignments, removed entities, disconnected province pieces, enclaves, unowned land, and provinces without burgs.
Split or fill invalid territories in the campaign definition with a recorded mapping; do not silently modify the
source map. Preserve mappings back to original cell, province, state, and burg IDs for inspection and export.

Province membership stays fixed when territory changes hands. Do not rerun political/province generation after a war.
Normalize map population and distance units once during compilation so campaign rules do not depend on UI settings.
State 0 and removed states do not become ordinary playable countries.

### Module placement and dependencies

Use the existing layer structure, with small campaign subfolders:

| Location | Responsibility |
| --- | --- |
| `src/types/campaign/` | Serializable definitions, state, command and event contracts |
| `src/generators/campaign/` | Scenario compilation, ticks, movement, combat, economy, diplomacy, AI |
| `src/application/` | Campaign session ownership, clock driver, execution host, workspace lifecycle |
| `src/controllers/campaign/` | Translate input into commands and present campaign panels |
| `src/components/` | Persistent campaign controls and reusable presentation |
| `src/renderers/scene/` and `src/renderers/pixi/` | Campaign projections, overlays, units, changed-territory rendering |
| `src/services/io/` | Campaign codecs, migrations, storage, snapshot capture |
| `src/data/` | Initial rules, unit definitions, and scenario presets |

Simulation modules accept explicit state and rules, with no DOM, React, Pixi, browser storage, or application-global
imports. The application host owns scheduling; simulation determines game outcomes. Keep rule validation in the
simulation even when the UI also disables unavailable actions.

Continue using the workspace command catalog for discoverable UI actions. Serializable simulation commands are the
payloads those actions submit, not a competing UI registry. Add `simulation:command` to workspace capability policy;
Play permits inspection and orders, while denying map editing and regeneration.

Start with concrete modules and explicit system ordering. Avoid an ECS, plugin container, general event bus, or
immutable full-world store until an actual requirement justifies one. No new production dependency is required by
this plan; any later addition follows the repository's permission policy.

### Commands, time, and deterministic execution

Commands include actor, sequence, execution tick, type, and payload. Examples are `RecruitArmy`, `MoveArmy`,
`DeclareWar`, and `OfferPeace`. Validate authority, costs, legal targets, current state, and duplicate command IDs
when executing, not only when the user first clicks. Rejected commands return stable reason codes.

Process a day in a documented order: queued commands; scheduled completions; movement and encounters; battles and
retreats; occupation and sieges; daily attrition; monthly finances/reinforcement when due; AI decisions for future
ticks; victory evaluation; publication of committed changes. Fix simultaneous-arrival and tie-breaking rules.

Allow planning while paused, but queue gameplay mutations for the next simulation boundary. Speed changes alter
throughput, not game rules. Pause when the browser tab is hidden in the first release; avoid unbounded catch-up after
returning. Bound work per browser task and slow the effective speed if necessary rather than skipping simulation days.
Fixed-step execution separates rules from rendering cadence; see [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/).

Use explicit serializable RNG streams for combat and AI, stable iteration order, and deterministic pathfinding ties.
Use integer minor currency units and documented rounding for accounting. Store future-affecting AI plans and pending
work, or make their reconstruction deterministic. Camera operations must never consume gameplay randomness.

Require deterministic replay for the same simulation/rules version. Cross-version and cross-browser bit-identical
replay are separate guarantees that must be tested before being promised. Snapshot migration is not replay migration.

### Saving and compatibility

Introduce a separately versioned campaign file containing one JSON-compatible envelope: schema version, simulation
version, resolved rules and content version, self-contained map/scenario payload, campaign state, RNG states, and
pending commands. Do not rely on an external map URL or the latest built-in balance constants to resume a campaign.
Typed arrays use explicit symmetric codecs.

Capture snapshots at committed tick boundaries. Save halfway through a movement or siege by persisting its logical
progress, not animation coordinates. Rebuild adjacency caches, lookup indexes, and GPU resources after loading.
Reject unsupported future schemas clearly; retain the original file on migration failure.

Keep current `.map` loading/migrations working. A `.map` can initialize a new campaign; it is not an implicit campaign
save. Preserve exact authoritative values during campaign round trips and verify continuation against an uninterrupted
run. Use snapshots plus a bounded command history for debugging; full event sourcing is unnecessary.

## Delivery milestones

Effort ranges below are engineering weeks for one experienced full-time developer, including focused tests and
iteration. They are estimates rather than commitments. Re-estimate after M2 using measured integration difficulty.
Art, broad content production, and extensive external playtesting can add substantial time.

### M0 — Establish the campaign contract and baseline

Dependencies: none. Estimate: 1–2 weeks.

- Record architecture decisions for state ownership, province identity, calendar, file format, and Play capabilities.
- Fix first-campaign scope and explicit exclusions; define recruitment cost, upkeep, supply, and basic war rules.
- Create deterministic tiny, normal, and stress scenarios, including islands, enclaves, missing provinces, and removed IDs.
- Inventory reusable APIs and hidden mutations along start, inspect, save, and exit paths.
- Record renderer, load, memory, and topology-compilation baselines on named hardware/browser profiles.
- Update architecture/data-model documentation with the approved boundaries as implementation lands.

Exit gate: a short rules specification and reproducible scenario fixtures exist; each state field has one owner;
performance measurements can be reproduced. Do not spend this milestone refactoring unrelated editors.

### M1 — Compile a scenario and enter Play safely

Dependencies: M0. Estimate: 3–5 weeks.

- Build scenario normalization, stable ID mapping, province adjacency, and terrain/route movement summaries.
- Add country selection and a Play session with read-only map inspection.
- Extend existing capability guards and picking; show province owner, terrain, supply, and country facts.
- Add campaign map projections, selection highlights, and a minimal date/treasury/manpower bar.
- Validate that objectives and starting countries are reachable in the initial land theater.

Exit gate: generated maps and legacy fixtures initialize consistently; every playable land cell maps to a valid
campaign province; inspection and Play entry do not mutate the source map. Invalid scenarios fail with actionable
diagnostics rather than starting a broken campaign.

### M2 — Deterministic runtime and reliable saves

Dependencies: M1. Estimate: 3–5 weeks.

- Implement command execution, daily ticks, pause/speed, seeded RNG, ordered system execution, and changed-ID output.
- Add a headless runner using the same simulation entry point as the browser.
- Implement campaign save/load, version validation, tick-boundary snapshots, and basic autosave recovery.
- Add a command inspector and state checksums for development debugging.
- Introduce the execution-host interface with an in-process implementation first.

Exit gate: the same scenario and scheduled commands produce the same canonical checksum; save/reload continuation
matches uninterrupted execution; render frequency and selected speed do not change the result at a given game date.
Commands issued in an invalid mode or by the wrong country are rejected by the simulation itself.

### M3 — Sustainable armies and movement

Dependencies: M2. Estimate: 4–6 weeks.

- Add recurring country income, army upkeep, recruitment costs, recruitment queues, manpower, and recovery.
- Define insolvency behavior explicitly, initially recruitment/reinforcement restrictions and military penalties.
- Add armies with a small unit roster, merge/split, movement queues, arrival dates, and cancellation rules.
- Implement province-graph pathfinding, access constraints, terrain/road costs, and path previews.
- Add basic supply capacity and attrition so concentration and travel impose meaningful costs.
- Render movement using interpolation between authoritative positions; introduce a simple scripted opponent.

Exit gate: the player can recruit, move, split, merge, and disband armies; inaccessible orders fail clearly; costs and
manpower reconcile; saving during movement preserves arrival dates; no army teleports or obtains free units.

This milestone deliberately puts minimal finances before full warfare so military decisions are constrained from
their first playable form. Rich production chains remain deferred.

### M4 — Complete a war against an opponent

Dependencies: M3. Estimate: 5–8 weeks.

- Add live war participants, attacker/defender roles, a territorial objective, legal declarations, and truces.
- Implement automatic combat using strength, morale, terrain, a limited unit matchup model, and bounded randomness.
- Define simultaneous arrivals, reinforcement of battles, retreat destinations, elimination, and retreat protection.
- Add occupation and simple fort sieges; distinguish controller changes from legal ownership changes.
- Compute explainable war score from objective control, occupations, and battles with bounded contributions.
- Implement white peace and limited territorial demands, validated and applied atomically.
- Handle capital loss, country elimination, exiled/stranded armies, and cleanup of orders after peace.
- Extend the opponent to defend, attack, retreat, and accept or offer peace through ordinary commands.

Exit gate: from a fresh campaign, the player can declare war, win or lose battles, occupy territory, conclude peace,
and see correct ownership and financial consequences. The opponent can also win. Save/load works during every phase.

This is the first war prototype suitable for focused external playtests. Run playtests before expanding the roster or
adding a broad diplomatic system.

### M5 — Autonomous countries and a complete campaign

Dependencies: M4. Estimate: 5–8 weeks.

- Separate AI into strategic goals, war/theater planning, and army orders; begin with explicit utility scores.
- Add budgets, reserves, target assessment, defensive concentration, recruitment, retreat, and peace evaluation.
- Stagger planning on deterministic schedules; restrict candidate targets to relevant neighbors/fronts.
- Store plans and commitments to prevent armies changing their mind every day.
- Add victory/defeat, notifications, battle summaries, an outliner, and reasons for unavailable actions.
- Add a small guided opening that teaches recruitment, movement, war goals, and peace.

Exit gate: all countries can run the complete loop without privileged mutations; a human can finish a campaign;
AI-only runs terminate wars and avoid permanent deadlocks. Review campaigns for challenge and legibility, not merely
the absence of crashes. Any difficulty advantage is explicit and configurable.

### M6 — Campaign reliability and performance release gate

Dependencies: M5; measurement and optimization begin in M0 and continue throughout. Estimate: 4–6 weeks.

- Run deterministic long campaigns across seed and size matrices with invariants and economic reports.
- Profile simultaneous wars, monthly updates, mass path changes, ownership transfers, saves, and repeated reloads.
- Move simulation to a dedicated Worker if the measured budgets below require it; keep a single authoritative owner.
- Coalesce render invalidations, bound logs/history, fix retained resources, and verify autosave recovery.
- Test keyboard orders, focus management, reduced motion, readable overlays, and narrow-window usability.
- Conduct a deliberate browser smoke test of start, war, peace, save, reload, defeat, and exit.

Exit gate: the normal scenario meets agreed budgets; stress scenarios degrade gracefully; long campaigns preserve
invariants and bounded memory; old maps still load; the campaign loop passes hands-on acceptance testing.

### M7 — Strategic depth in independently playable increments

Dependencies: M6. Estimate: 4–8 weeks per substantial system, revised after design spikes.

| Order | Increment | Acceptance criterion |
| --- | --- | --- |
| 1 | Claims, alliances, military access, expansion penalties | Attacking a neighbor changes other countries' incentives; AI anticipates intervention |
| 2 | Autonomy, unrest, integration, rebellion | New territory imposes temporary costs and creates a choice between expansion and consolidation |
| 3 | Buildings, military technology, doctrines | At least two viable military/economic strategies emerge; AI can choose and use them |
| 4 | Fleets, ports, transport, blockades | Both player and AI can conduct an overseas war; island countries become viable |
| 5 | Persistent regional production and trade | War affects supply/income through explicit flows; inventories and money remain bounded and explainable |
| 6 | Events, decisions, scenario customization | Versioned data can add meaningful situations without changing the engine for each event |

Each increment includes rules, AI behavior, UI explanation, save migration, profiling, and playtests. Shipping a
mechanic only for the player does not complete the milestone. Add fantasy-specific differences after the shared
military/economic rules can express their costs and counterplay.

## Performance plan

### Workload and provisional budgets

These are acceptance targets to calibrate in M0, not achieved benchmark results. Reuse the
[existing reference profiles](../performance/pixi-reference-profiles.md), recording exact hardware, browser,
resolution, backend, fixture, and active layers. Measure warm steady-state and cold initialization separately.

| Scenario | Cells | Provinces | Countries | Armies |
| --- | --- | --- | --- | --- |
| Tiny correctness fixture | 1k–5k | 10–20 | 3–4 | 10–20 |
| Normal campaign | 20k–50k | 100–200 | 8–16 | Up to 200 |
| Stress campaign | 100k | 1,000 | 64 | Up to 2,000 |

| Metric | Initial normal-campaign target |
| --- | --- |
| Pan/zoom while running | p95 frame interval at or below 20 ms; investigate sustained drops below 50 FPS |
| Input acknowledgement | p95 below 100 ms, including explicit queued feedback for simulation commands |
| Ordinary daily simulation | p95 below 5 ms on the reference desktop |
| Full monthly boundary including scheduled AI | p95 below 25 ms total compute; chunk or offload to avoid blocking input |
| Main-thread simulation slice | At most 4 ms before yielding during normal play |
| Fast speed | Sustain 20 days/second on normal fixture without skipped days |
| Save/load | Target below 2 s save and 3 s load on the normal fixture; separately report snapshot pause |
| Retained campaign memory | Target below 100 MB beyond the loaded map/renderer baseline |
| Memory stability | After warmup and collection, less than 10% retained growth over an equivalent 30-minute workload |

Report p50, p95, worst case, throughput, and memory. Averages alone conceal monthly stalls. Track stress scaling and
constrained-profile responsiveness; stress worlds need not meet normal-world speed. Establish their supported speed
and memory ceiling from measurements before advertising them.

### Algorithms and data flow

- Compile cell-to-province membership, adjacency, and terrain summaries once. Daily simulation must not scan all cells.
- Keep country/province/army objects simple; use typed arrays for dense geographic and ownership indexes where useful.
- Update active armies, battles, sieges, and scheduled completions rather than every inactive object.
- Use a priority queue for pathfinding; cache paths with access/graph revision keys and invalidate affected routes.
- Avoid all-country-pairs and all-army-pairs searches. Query neighbors, fronts, and province occupants.
- Aggregate monthly economy at country/province level initially. Rich trade later operates over regional markets,
  with bounded trading candidates and explicit inventory accounting.
- Update geometry only when required. A unit moving should not rebuild terrain, labels, or political borders.
- Recolor changed provinces, invalidate affected boundary segments, and refresh only subscribed inspector data.
- Bound battle reports, deal history, command logs, and notifications; keep aggregates and deliberate checkpoints.
- Keep gameplay statistics independent of animated trade flows and other decorative rendering.

If profiling requires a Worker, initialize compact static campaign data once and send commands in and changed-state
batches out. Do not clone `pack` every tick. Attach sequence/revision IDs, detect missing revisions, support a full
resync, and apply backpressure when the renderer falls behind. Coalesce intermediate visual changes while retaining
all authoritative simulation transitions.

Workers use structured cloning for ordinary messages; transferable buffers change ownership and detach at the sender.
Therefore, do not transfer buffers still owned by the map renderer. Use separate compact campaign data or an explicit
ownership scheme. See [MDN worker messaging](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
and [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects).
Shared memory, WASM, and multiple simulation workers are later profiling-driven options.

## Verification and release discipline

### Required simulation invariants

- Every active province has valid owner/controller references, including an explicit unowned representation.
- Every army has a valid country and location/transit edge; unit counts and manpower never become negative.
- Treasury changes reconcile with a monthly ledger. Insolvency follows rules rather than silently clamping money.
- Peace changes ownership, war state, armies, and truces consistently in one committed operation.
- Eliminated countries cannot issue orders; obsolete paths and orders cannot revive deleted entities.
- Recruitment and reinforcement cannot spend the same resources twice.
- Derived indexes agree with authoritative state after load and ownership changes.
- No gameplay result depends on camera, open panels, frame rate, or rendering backend.

### Test layers

1. **Focused unit tests:** command rejection, cost rounding, adjacency, access, combat, retreat, peace, and AI scoring.
2. **Scenario tests:** river crossing, simultaneous arrival, encirclement, no retreat route, fort siege, capital loss,
   last-province annexation, insolvency, and peace while armies are moving.
3. **Determinism tests:** repeated seeds/commands, different render schedules, and save/resume equality.
4. **Soak tests:** a small fixed seed set in routine checks; larger scheduled/manual batches spanning at least 100
   game years, logging the seed and command sequence for failures. Track unfinished wars and economy distributions.
5. **Integration tests:** Play capability guards, map isolation, incremental ownership rendering, IO migration,
   inspector updates, and Worker/in-process equivalence if a Worker is introduced.
6. **Explicit browser acceptance:** full campaign smoke flow, accessibility, resize, context recovery, and profiling.

Run the narrowest affected unit/scenario tests per change, plus relevant lint/type/build checks. Introduce headless
simulation benchmarks that can run without a browser. The existing `benchmark:renderer` command uses Playwright;
execute it and browser E2E suites only through explicitly authorized runs, consistent with repository instructions.

Every milestone is done only when its acceptance gate, save compatibility, AI obligations, and performance evidence
are satisfied. New long-run state needs a serialization test in the same change that introduces it.

## Delivery strategy and risks

M0–M4 total roughly 16–26 engineering weeks for a war prototype. M0–M6 total roughly 25–40 engineering weeks for the
constrained campaign, before substantial content expansion. For one developer, reserve an additional 30–50% for
integration discoveries, playtesting, balancing, and interruptions: approximately 8–14 calendar months of full-time
work for that constrained release. A deeper, polished grand-strategy game is a multi-year effort. These estimates
should replace neither milestone gates nor re-estimation after the runtime and first war are working.

The critical path is scenario ownership → deterministic runtime → sustainable armies → complete war → capable AI →
campaign hardening. More contributors can own UI, simulation, and verification independently after contracts settle,
but that does not remove the integration path.

| Risk | Early signal | Response |
| --- | --- | --- |
| Framework work displaces gameplay | Weeks of infrastructure without a playable order | Keep each PR tied to the next milestone's visible behavior |
| Existing province data is unsuitable | Disconnected or unassigned land breaks movement | Normalize at scenario compilation and retain source mappings |
| Legacy mutations leak into Play | Inspecting or saving changes map/campaign state | Guard capabilities and compare canonical snapshots |
| Economy grows or resets incorrectly | Treasury discontinuities or free reinforcement | Separate generation from recurring ledger transitions |
| AI becomes expensive or indecisive | Frame stalls, repeated replanning, endless wars | Deterministic staggered budgets, persistent plans, scoring diagnostics |
| Conquest is trivial or snowballs | One opening dominates across seeds | Tune supply, manpower, recovery, peace limits, and consolidation costs |
| Saves become fragile | Reload changes battle/arrival outcomes | Persist all future-affecting state and verify continuation early |
| Big maps dominate effort | Tiny campaign is unfinished while stress rendering is optimized | Meet the normal campaign gate first; maintain stress diagnostics throughout |

## First implementation backlog

Keep the first changes small and independently reviewable:

1. Approve campaign ownership/province/save decisions and add tiny scenario fixtures.
2. Add campaign definition/state types and a pure scenario compiler with normalization tests.
3. Extend workspace capabilities with Play and simulation commands; verify map mutation remains blocked.
4. Add fixed daily advancement, explicit RNG, command validation, and headless checksum tests.
5. Add campaign snapshots and save/resume equality before introducing warfare state.
6. Add province/country inspection and ownership projections using existing picking and rendering.
7. Add recurring treasury/manpower and recruitment, then province movement and path previews.
8. Implement the first deterministic battle, occupation, and peace scenario with a scripted defender.

The first product checkpoint is a complete war with consequences. Use its playtest results to decide what to deepen,
while retaining the simulation, persistence, and performance contracts established along the way.

## Related repository documentation

- [Architecture](../architecture/architecture.md)
- [Current data model](../architecture/data_model.md)
- [Domain and workspace decoupling](../architecture/domain-workspace-global-decoupling-plan.md)
- [Workspace capabilities](../architecture/workspace-view-edit-mode-plan.md)
- [Renderer operations](../architecture/pixi-renderer-operations.md)
- [Production model](../domain/production_schema.md)
- [Taxes and treasury](../domain/taxes.md)
- [Future multiplayer considerations](../architecture/multiplayer.md)
