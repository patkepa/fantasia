// Reusable UI building blocks: web components, shared widgets, and the persistent map chrome.
// Importing registers the custom elements and mounts the chrome
import "./app-info";
import "./tooltips";
import "./map-tooltip";
import "./zoom";
import "./viewbox-events";
import "./tools";
import "./hotkeys";
import { destroyDialog, updateDialog } from "./dialog/dialog-helpers";
import { initializeLayerControlsRuntime } from "./layers/layer-controls-runtime";
import { mountOptionsPanel } from "./options/options-panel";
import { initializeMapStyleControls } from "./style/map-style-controls";
import { mountStylePanel } from "./style/style-panel";
import "./dialog/sorting";
import { enableVerticalSortable } from "./dialog/vertical-sortable";
import { enableElementDragging } from "./element-dragging";
import "./fill-box";
import "./slider-input";
import { svgDefinitionsReady } from "./svg-definitions-loader";

void svgDefinitionsReady;

Object.assign(window, {
  destroyDialog,
  enableElementDragging,
  enableVerticalSortable,
  showDomDialog: (options: import("./ui/dom-dialog").DomDialogOptions) =>
    import("./ui/dom-dialog").then(({ showDomDialog }) => showDomDialog(options)),
  showMessageDialog: (options: import("./ui/message-dialog").MessageDialogOptions) =>
    import("./ui/message-dialog").then(({ showMessageDialog }) => showMessageDialog(options)),
  updateDialog
});
mountStylePanel();
mountOptionsPanel();
initializeLayerControlsRuntime();
initializeMapStyleControls();

// Load the workspace as soon as the DOM is available. Waiting for `window.load`
// can leave the map without its controls when an unrelated asset stalls.
const loadWorkspace = () => void import("./workspace-sidebar");
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadWorkspace, { once: true });
else loadWorkspace();

// These runtimes only bind editor dialogs and controls. Deferring their module evaluation keeps map generation and the
// first Pixi frame ahead of UI code that is not needed until the user opens an editor.
const loadEditorRuntimes = () =>
  Promise.all([
    import("./options/options-runtime"),
    import("./style/style-editor-loader"),
    import("./style/style-presets-runtime")
  ]);
const scheduleEditorRuntimes = () => void loadEditorRuntimes();
const requestIdle = (window as Partial<Window>).requestIdleCallback;
if (requestIdle) requestIdle.call(window, scheduleEditorRuntimes, { timeout: 1_500 });
else window.setTimeout(scheduleEditorRuntimes, 250);
