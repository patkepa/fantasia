import { describe, expect, it } from "vitest";
import {
  buildCoastalAssignmentEdges,
  buildCoastalAssignmentScene,
  buildCoastalAssignmentSceneFromEdges,
  type CoastalAssignmentSource
} from "./coastal-assignment-scene";

const source: CoastalAssignmentSource = {
  cells: {
    f: Uint8Array.from([0, 1, 0]),
    h: Uint8Array.from([30, 10, 30]),
    i: [0, 1, 2],
    v: [
      [0, 1, 2, 3],
      [1, 4, 5, 2],
      [3, 2, 6, 7]
    ]
  },
  features: [{ type: "island" }, { type: "ocean" }],
  vertices: {
    c: [
      [0, -1, -1],
      [0, 1, -1],
      [0, 1, 2],
      [0, 2, -1],
      [1, -1, -1],
      [1, -1, -1],
      [2, -1, -1],
      [2, -1, -1]
    ] as [number, number, number][],
    p: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [2, 0],
      [2, 1],
      [1, 2],
      [0, 2]
    ] as [number, number][]
  }
};

describe("coastal assignment scene", () => {
  it("emits assigned land-water edges but excludes internal land edges and unassigned coasts", () => {
    const scene = buildCoastalAssignmentScene(source, Uint8Array.from([4, 0, 0]), "provinces", "provinces:2");

    expect(scene.paths.some(path => path.domainId === "provinces:4:1:2")).toBe(true);
    expect(scene.paths.some(path => path.domainId === "provinces:4:2:3")).toBe(false);
    expect(scene.paths.every(path => path.role === "4")).toBe(true);
    expect(scene.revision).toBe("provinces:2");
  });

  it("keeps different thematic assignments on the same shoreline geometry", () => {
    const scene = buildCoastalAssignmentScene(source, Uint8Array.from([7, 0, 8]), "states");

    expect(scene.paths.some(path => path.role === "7")).toBe(true);
    expect(scene.paths.some(path => path.role === "8")).toBe(true);
  });

  it("does not extend assignments into lakes", () => {
    const lakeSource: CoastalAssignmentSource = {
      ...source,
      features: [{ type: "island" }, { type: "lake" }]
    };

    const scene = buildCoastalAssignmentScene(lakeSource, Uint8Array.from([7, 0, 8]), "states");

    expect(scene.paths.some(path => path.domainId === "states:7:1:2")).toBe(false);
  });

  it("reuses topology-derived shoreline edges across assignment changes", () => {
    const edges = buildCoastalAssignmentEdges(source);
    const assignments = Uint8Array.from([7, 0, 8]);

    expect(buildCoastalAssignmentSceneFromEdges(edges, assignments, "states", "states:2")).toEqual(
      buildCoastalAssignmentScene(source, assignments, "states", "states:2")
    );
  });
});
