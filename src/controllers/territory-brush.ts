import { type D3DragEvent, drag, select } from "d3";
import { updateDialog } from "@/components/dialog/dialog-helpers";
import { setModeHiddenColumns } from "@/components/dialog/table";
import { clearMainTip, showMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import { getPixiMapPointAtClient, updateMapInteractionOverlay } from "@/renderers/pixi/pixi-renderer-controller";
import type { PackedGraph } from "@/types/PackedGraph";
import { findAllCellsInRadius, findClosestCell, isLand } from "@/utils/graphUtils";
import { ensureEl } from "@/utils/nodeUtils";
import { selectTerritoryEditorRow, type TerritoryAssignmentSession } from "./territory-editor-utils";

type BrushDragEvent = D3DragEvent<SVGElement, unknown, unknown>;

interface TerritoryBrushOptions {
  domain: "cultures" | "religions";
  dialogId: string;
  position: Parameters<typeof updateDialog>[1]["position"];
  hiddenColumns: string[];
  restoredColumns: () => string[];
  graph: PackedGraph;
  assignment: TerritoryAssignmentSession;
  onSelect: (id: number) => void;
  onPaint: (cells: number[]) => void;
}

/** Shared manual-assignment UI and pointer lifecycle; domain commit rules remain in each editor. */
export function enterTerritoryBrush(options: TerritoryBrushOptions): () => void {
  const { domain, dialogId, position, graph, assignment } = options;
  const body = ensureEl(`${domain}Body`);
  const bottom = ensureEl(`${domain}Bottom`);
  const buttons = ensureEl(`${domain}ManuallyButtons`);
  const footer = ensureEl(`${domain}Footer`);
  const brush = ensureEl<HTMLInputElement>(`${domain}Brush`);
  const viewbox = select<SVGElement, unknown>("#viewbox");
  let active = true;

  bottom.querySelectorAll<HTMLElement>(":scope > *").forEach(el => {
    el.style.display = "none";
  });
  buttons.style.display = "inline-block";
  footer.style.display = "none";
  setModeHiddenColumns(dialogId, options.hiddenColumns);
  body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(el => {
    el.style.pointerEvents = "none";
  });
  updateMapInteractionOverlay({ handles: [] });
  updateDialog(dialogId, { position });
  const name = domain === "cultures" ? "culture" : "religion";
  tip(`Click on ${name} to select, drag the circle to change ${name}`, true);

  function selectOnMap(event: MouseEvent): void {
    const point = getPixiMapPointAtClient(event.clientX, event.clientY);
    if (!point) return;
    const cellId = findClosestCell(point.x, point.y, Infinity, graph);
    if (cellId === undefined || !isLand(cellId, graph)) return;
    const id = assignment.get(cellId);
    options.onSelect(id);
    // Selection survives pagination even when the corresponding row is not currently mounted.
    selectTerritoryEditorRow(body, body.querySelector(`div[data-id='${id}']`));
  }

  function beginStroke(event: BrushDragEvent): void {
    const radius = +brush.value;
    assignment.beginStroke();
    event.on("drag", (dragEvent: BrushDragEvent) => {
      if (!active || (!dragEvent.dx && !dragEvent.dy)) return;
      const point = getDragMapPoint(dragEvent);
      if (!point) return;
      moveCircle(point.x, point.y, radius);
      const found =
        radius > 5
          ? findAllCellsInRadius(point.x, point.y, radius, graph)
          : [findClosestCell(point.x, point.y, radius, graph)];
      const cells = found.filter((id): id is number => id !== undefined && isLand(id, graph));
      if (cells.length) options.onPaint(cells);
    });
  }

  viewbox
    .style("cursor", "crosshair")
    .on("click", selectOnMap)
    .call(drag<SVGElement, unknown>().on("start", beginStroke))
    .on("touchmove mousemove", (event: MouseEvent | TouchEvent) => {
      showMainTip();
      const point = getClientMapPoint(event);
      if (point) moveCircle(point.x, point.y, +brush.value);
    });

  const firstRow = body.querySelector<HTMLElement>(":scope > div.states");
  if (firstRow) {
    selectTerritoryEditorRow(body, firstRow);
    options.onSelect(+firstRow.dataset.id!);
  }

  return () => {
    if (!active) return;
    active = false;
    removeCircle();
    bottom.querySelectorAll<HTMLElement>(":scope > *").forEach(el => {
      el.style.display = "inline-block";
    });
    buttons.style.display = "none";
    footer.style.display = "block";
    setModeHiddenColumns(dialogId, options.restoredColumns());
    body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(el => {
      el.style.removeProperty("pointer-events");
    });
    selectTerritoryEditorRow(body, null);
    applyDefaultViewboxEvents();
    clearMainTip();
  };
}

function getDragMapPoint(event: BrushDragEvent): { x: number; y: number } | null {
  return getClientMapPoint(event.sourceEvent as MouseEvent | TouchEvent);
}

function getClientMapPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  const source = "touches" in event ? (event.touches[0] ?? event.changedTouches[0]) : event;
  if (!source) return null;
  const { clientX, clientY } = source;
  return Number.isFinite(clientX) && Number.isFinite(clientY) ? getPixiMapPointAtClient(clientX, clientY) : null;
}
