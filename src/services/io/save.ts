// Save the whole .map project to storage, machine or cloud

import { getDocumentLayerOrder, getDocumentLayerVisibility } from "@/application/view-session-state";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { LayerControls } from "@/components/layers/layer-controls";
import { tip } from "@/components/tooltips";
import { Services } from "@/services";
import { documentDirtyState } from "@/services/document-dirty-state";
import { getUsedFonts } from "@/services/fonts";
import { LocalMapStorage } from "@/services/io/local-map-storage";
import { VERSION } from "@/services/versioning";
import { ensureEl, getFileName, link, parseError } from "@/utils";
import { createLegacyMapSaveSource } from "./legacy-map-save-source";
import { serializeMapSectionsInWorker } from "./map-data-serializer-client";
import { captureMapDocument } from "./map-document";
import { createMapSaveSections } from "./map-save-snapshot";
import { createSerializedMapStyle } from "./serialized-map-style";

type SaveMethod = "storage" | "machine" | "dropbox";

async function saveMap(method: SaveMethod): Promise<void> {
  if (customization) return tip("Map cannot be saved in EDIT mode, please complete the edit and retry", false, "error");
  closeDialogs();

  const revision = documentDirtyState.getRevision();
  try {
    const mapData = await prepareMapData();
    const filename = `${getFileName()}.map`;

    if (method === "storage") await saveToStorage(mapData, true);
    if (method === "machine") saveToMachine(mapData, filename);
    if (method === "dropbox") await saveToDropbox(mapData, filename);
    documentDirtyState.markSaved(revision);
    window.dispatchEvent(new Event("map:saved"));
  } catch (error) {
    ERROR && console.error(error);
    const messageHtml = /* html */ `An error occurred while saving the map. If the issue persists, please copy the message below and report it on ${link(
      "https://github.com/patkepa/fantasia/issues",
      "GitHub"
    )}. <p id="errorBox">${parseError(error as Error)}</p>`;
    const { showMessageDialog } = await import("@/components/ui/message-dialog");
    showMessageDialog({
      actions: [{ label: "Retry", onClick: () => void saveMap(method) }, { label: "Close" }],
      id: "saveErrorDialog",
      messageHtml,
      title: "Saving error",
      width: "28em"
    });
  }
}

async function prepareMapData(): Promise<string> {
  await waitForMainThreadIdle();
  const date = new Date();
  const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const license = "File can be loaded in patkepa.github.io/fantasia";
  const fonts = getUsedFonts(ensureEl("map") as Element as SVGSVGElement);

  // The SVG slot is retained temporarily for unmigrated overlay data. Pixi-owned layers are intentionally absent.
  const cloneEl = ensureEl("map").cloneNode(true) as SVGSVGElement;

  // reset transform values to default
  cloneEl.setAttribute("width", String(graphWidth));
  cloneEl.setAttribute("height", String(graphHeight));
  cloneEl.querySelector("#viewbox")?.removeAttribute("transform");
  cloneEl
    .querySelector("#labels")
    ?.setAttribute(
      "data-layer-active",
      String(getDocumentLayerVisibility("toggleLabels", window.LayerControls.isLayerOn("toggleLabels")))
    );
  for (const [controlId, selector] of [
    ["toggleRulers", "#ruler"],
    ["toggleScaleBar", "#scaleBar"],
    ["toggleVignette", "#vignette"]
  ] as const) {
    const layer = cloneEl.querySelector<SVGElement>(selector);
    if (layer)
      layer.style.display = getDocumentLayerVisibility(controlId, window.LayerControls.isLayerOn(controlId))
        ? ""
        : "none";
  }
  cloneEl.querySelector("#mapInteractionOverlay")?.remove();
  cloneEl.querySelector("#mapInteractionSurface")?.remove();

  // relief icons are stored in pack.relief, the layer holds only the currently visible ones
  const cloneTerrain = cloneEl.querySelector("#terrain");
  if (cloneTerrain) cloneTerrain.innerHTML = "";

  const cloneRuler = cloneEl.querySelector("#ruler");
  if (cloneRuler) cloneRuler.innerHTML = ""; // always remove rulers
  cloneEl.querySelector("#emblems")?.replaceChildren();
  cloneEl.querySelector("#coas")?.replaceChildren();
  cloneEl.querySelector("#defs-emblems")?.replaceChildren();
  const serializedSVG = new XMLSerializer().serializeToString(cloneEl);

  const serializedStyle = createSerializedMapStyle(
    style,
    getDocumentLayerOrder(LayerControls.getLayerOrder()),
    controlId => getDocumentLayerVisibility(controlId, window.LayerControls.isLayerOn(controlId))
  );

  // store custom good icons
  const goodIconsEl = ensureEl("good-icons");
  const customGoodIcons = Array.from(goodIconsEl.querySelectorAll('[id^="good-custom-"]') || [])
    .map(el => el.outerHTML)
    .join("")
    .replace(/[\r\n]+/g, " "); // map data is split by CRLF on load

  const snapshot = captureMapDocument({
    seed,
    mapId,
    graphWidth,
    graphHeight,
    grid,
    pack,
    mapCoordinates,
    notes,
    options,
    style: serializedStyle,
    nameBases: Names.nameBases,
    settings: {
      distanceUnit: distanceUnitInput.value,
      distanceScale,
      areaUnit: areaUnit.value,
      heightUnit: heightUnit.value,
      heightExponent: heightExponentInput.value,
      temperatureScale: temperatureScale.value,
      populationRate,
      urbanization,
      urbanDensity,
      growthRate: ensureEl<HTMLInputElement>("growthRate").value,
      mapName: mapName.value,
      stylePreset: stylePreset.value
    }
  });
  return serializeMapSectionsInWorker(
    createMapSaveSections(
      createLegacyMapSaveSource(snapshot, {
        version: VERSION,
        license,
        date: dateString,
        defaultNameBases: Names.getNameBases(),
        serializedSVG,
        customGoodIcons,
        fonts
      })
    )
  );
}

function waitForMainThreadIdle(): Promise<void> {
  if (!("requestIdleCallback" in window)) return Promise.resolve();
  return new Promise(resolve => window.requestIdleCallback(() => resolve(), { timeout: 250 }));
}

// save map file to indexedDB
async function saveToStorage(mapData: string, showTip = false): Promise<void> {
  const blob = new Blob([mapData], { type: "text/plain" });
  await LocalMapStorage.set("lastMap", blob);
  showTip && tip("Map is saved to the browser storage", false, "success");
}

// download map file
function saveToMachine(mapData: string, filename: string): void {
  const blob = new Blob([mapData], { type: "text/plain" });
  const URL = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = filename;
  link.href = URL;
  link.click();

  tip('Map is saved to the "Downloads" folder (CTRL + J to open)', true, "success", 8000);
  setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
}

async function saveToDropbox(mapData: string, filename: string): Promise<void> {
  await Services.Cloud.save(filename, mapData);
  tip("Map is saved to your Dropbox", true, "success", 8000);
}

export const Save = { saveMap, prepareMapData, saveToStorage };
