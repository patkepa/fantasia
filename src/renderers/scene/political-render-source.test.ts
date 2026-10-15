import { expect, it } from "vitest";
import { STATIC_VIEWER_WORLD } from "@/viewer/static-map-fixture";
import { MapPickingIndex } from "../pixi/map-picking-index";
import { buildBorderScene } from "./layers/border-paths";
import { buildCellFillScene } from "./layers/cell-fill-scene";
import { buildLabelScene, type LabelRenderState } from "./layers/label-scene";
import { buildRetainedCellTopology } from "./layers/retained-cell-topology";
import { getMapPoliticalSource, projectPoliticalRenderWorld } from "./political-render-source";

it("projects ownership consistently for fills, borders, labels and picking without editing the map", () => {
  const map = structuredClone(STATIC_VIEWER_WORLD);
  const before = structuredClone(map);
  const labels: LabelRenderState = {
    groups: [{ name: "state", type: "state", zoom: { min: null, max: null } }],
    styles: {},
    resizeOnZoom: true,
    showAll: false,
    labels: [{ id: "stateLabel2", entityId: 2, type: "state", group: "state", text: "New owner", anchor: [50, 30] }]
  };
  const projected = projectPoliticalRenderWorld(map, {
    ...getMapPoliticalSource(map),
    stateByCell: new Uint16Array([2, 2]),
    provinceByCell: new Uint16Array([2, 1]),
    states: map.states.map((state, i) => ({ ...state, color: i === 2 ? "#ff0000" : "#00ff00" })),
    provinces: Array.from({ length: 3 }, (_, i) => ({
      i,
      state: 2,
      center: 0,
      burg: 0,
      name: `Province ${i}`,
      fullName: `Province ${i}`,
      formName: "Province",
      color: "#ff0000",
      coa: {}
    })),
    labelRenderState: labels,
    sourceStateIds: { 2: 1 },
    sourceProvinceIds: { 2: 1, 1: 2 }
  });
  const topology = buildRetainedCellTopology({
    revision: 1,
    cellIds: map.cells.i,
    cellVertices: map.cells.v,
    vertexPoints: map.vertices.p
  });
  const fill = buildCellFillScene(
    topology,
    {
      assignments: projected.cells.state,
      colors: projected.states,
      heights: projected.cells.h,
      fallbackColor: "#000000"
    },
    "states"
  );
  expect([...fill.colors.slice(0, 4)]).toEqual([1, 0, 0, 1]);
  expect(buildBorderScene(map).state.paths.length).toBeGreaterThan(0);
  expect(buildBorderScene(projected).state.paths).toHaveLength(0);
  expect(buildLabelScene(projected.labelRenderState!, 1).groups[0].labels[0]).toMatchObject({
    entityId: 2,
    text: "New owner"
  });
  const index = new MapPickingIndex();
  index.replaceEntries([], projected);
  const query = { cameraScale: 1, isLayerVisible: (layer: string) => layer === "states", tolerance: 8 };
  expect(index.pick({ x: 33, y: 30 }, query)).toMatchObject({ domainId: 2, layer: "states" });
  expect(index.pick({ x: 33, y: 30 }, { ...query, isLayerVisible: layer => layer === "provinces" })).toMatchObject({
    domainId: 2,
    layer: "provinces"
  });
  expect(projected.politicalSourceIds?.states?.[2]).toBe(1);
  expect(projected.vertices).toBe(map.vertices);
  expect(projected.cells.c).toBe(map.cells.c);
  expect(map).toEqual(before);
});

it("preserves live editor assignments and rejects incompatible projection topology", () => {
  const map = structuredClone(STATIC_VIEWER_WORLD);
  const projected = projectPoliticalRenderWorld(map, getMapPoliticalSource(map));
  expect(projected.cells).toBe(map.cells);
  map.cells.state = new Uint16Array([2, 1]);
  expect(projected.cells.state[0]).toBe(2);
  expect(() =>
    projectPoliticalRenderWorld(map, { ...getMapPoliticalSource(map), stateByCell: new Uint16Array(1) })
  ).toThrow("cell count");
});
