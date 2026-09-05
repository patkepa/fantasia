// Reusable UI building blocks: web components, shared widgets, and the persistent map chrome.
// Importing registers the custom elements and mounts the chrome
import "./app-info";
import "./tooltips";
import "./map-tooltip";
import "./zoom";
import "./viewbox-events";
import "./tools";
import "./hotkeys";
// Startup restores preferences and selects the heightmap through this runtime before generation can begin.
import "./options/options-runtime";
import { destroyDialog, updateDialog } from "./dialog/dialog-helpers";
import { initializeLayerControlsRuntime } from "./layers/layer-controls-runtime";
import { mountOptionsPanel } from "./options/options-panel";
import { mountStylePanel } from "./style/style-panel";
import { initializeStylePresetsRuntime } from "./style/style-presets-controller";
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
void initializeStylePresetsRuntime();

// Load the workspace as soon as the DOM is available. Waiting for `window.load`
// can leave the map without its controls when an unrelated asset stalls.
const loadWorkspace = () => void import("./workspace-sidebar");
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadWorkspace, { once: true });
else loadWorkspace();

// The style editor is not needed until the user opens it; generation options above are required during startup.
const scheduleEditorRuntimes = () => void import("./style/style-editor-loader");
const requestIdle = (window as Partial<Window>).requestIdleCallback;
if (requestIdle) requestIdle.call(window, scheduleEditorRuntimes, { timeout: 1_500 });
else window.setTimeout(scheduleEditorRuntimes, 250);
