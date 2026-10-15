# Legacy Runtime and `index.html` Modernization Plan

## Current baseline

Application code has moved from `public/modules/` into bundled TypeScript under `src/`.
Pixi owns persistent map rendering; SVG remains for viewport decorations, definitions,
and transient interaction controls. See [architecture.md](./architecture.md) for layer ownership
and [legacy-code.md](./legacy-code.md) for compatibility removal rules.

Completed runtime migrations:

- Alea is imported from npm; the public script and global load are gone.
- `src/utils/priority-queue.ts` replaces the global FlatQueue dependency.
- `src/utils/simplify.ts` owns geometry simplification.
- `src/services/io/local-map-storage.ts` owns IndexedDB access.
- Shared React/native dialogs replace the jQuery UI layer.
- Options and style panels are mounted from their component modules.
- Alert/prompt, font, style-preset, units, and IO dialog markup is no longer embedded in the root HTML.

Do not repeat these migrations or restore their old startup scripts. Remaining public libraries
are deliberate optional integrations: JSZip, Dropbox, RGBQuant, and TinyMCE. `public/sw.js`
is a service-worker asset, not an application module.

## Remaining work

### Audit compatibility globals one symbol at a time

Inventory classic/inline callers, bundled callers, tests, and supported external browser APIs.
Replace internal calls with legal imports. Remove each unused registration together with its
global type only after checking its compatibility obligations. No repository caller alone does
not establish that a supported browser API can be removed.

### Finish controller-owned UI lifecycle

The root HTML still contains workspace infrastructure and static editor markup. Move each
remaining dialog with its owning controller when that feature changes:

1. Build and mount its UI on open using the shared dialog toolkit.
2. Own listeners, timers, observers, and object URLs in that lifecycle.
3. Destroy the subtree and release those resources on close.
4. Remove the replaced root markup in the same change.
5. Verify open, interaction, close, and reopen without duplicated listeners or stale state.

Audit already extracted panels for teardown behavior; moving markup into TypeScript does not
by itself establish lifecycle ownership. Keep map configuration in state, independent of whether
its editor is mounted. Keep IO operations in `services/io` and presentation in components/controllers.

### Modernize optional libraries independently

Before replacing a vendor, record its load sites, callers, affected user workflow, licensing,
bundle impact, and fallback behavior. Preserve lazy loading. New production dependencies need
explicit approval. Remove a vendor as a unit after its final loader is gone; do not edit individual
compatibility branches inside minified bundles.

### Keep shell and SVG definitions stable

Do not rewrite `src/index.html` in one pass. Preserve the root map SVG, loading shell, workspace
chrome, file-input infrastructure, and `#defElements` while extracting individual controllers.
The Vite plugin reads `#defElements` to emit `def-elements.svg`; moving it needs a separate
build-pipeline change and generated-asset verification.

## Migration-friendly verification

Test observable behavior and architectural boundaries rather than exact source strings,
import spellings, or historical SVG output. The obsolete SVG layer snapshots and one-off
cutover source checks have been retired. Current coverage includes:

- renderer ownership, scene generation, visibility, ordering, and lifecycle unit tests;
- Pixi hit routing for repeated burg-label clicks;
- generated-frame health and layer toggling in `tests/e2e/layers.spec.ts`;
- seeded world reproducibility and route naming in `tests/e2e/generation-regression.spec.ts`;
- current and historical map loading in `tests/e2e/load-map.spec.ts`.

Saved-map migrations and old-map fixtures remain required while their versions are supported.
Do not remove positional serialization placeholders or change minimum supported versions as
incidental cleanup. Preserve upstream attribution.

For each change, run the narrowest relevant unit tests, type checking, lint for files in its
configured scope, and a build when dependencies or assets change. Do not automatically run
Playwright; report browser scenarios that remain unverified. For changes to save/load, also
verify current and historical round trips when browser verification is authorized.
