import type { PackedGraph } from "@/types/PackedGraph";
import type { LinePathPrimitive, PolygonPathPrimitive, SceneRevision } from "../primitives";
import { buildBorderScene } from "./border-paths";

export interface StateHaloGroup {
  paths: readonly LinePathPrimitive[];
  polygons: readonly PolygonPathPrimitive[];
  stateId: number;
}

export interface StateHaloScene {
  groups: readonly StateHaloGroup[];
  revision: SceneRevision;
}

/** Builds one clipped, inner-border stroke for each state. */
export function buildStateHaloScene(
  source: Pick<PackedGraph, "cells" | "vertices">,
  revision: SceneRevision = 0
): StateHaloScene {
  const groups = new Map<number, { paths: LinePathPrimitive[]; polygons: PolygonPathPrimitive[] }>();
  const getGroup = (stateId: number) => {
    let group = groups.get(stateId);
    if (!group) {
      group = { paths: [], polygons: [] };
      groups.set(stateId, group);
    }
    return group;
  };

  for (const cellId of source.cells.i) {
    const stateId = source.cells.state[cellId];
    const vertexIds = source.cells.v[cellId];
    if (source.cells.h[cellId] < 20 || !stateId || !vertexIds?.length) continue;

    const points = vertexIds.map(vertexId => source.vertices.p[vertexId]);
    if (points.length < 3 || points.some(point => !isFinitePoint(point))) continue;
    getGroup(stateId).polygons.push({
      domainId: `states-halo:${stateId}:cell:${cellId}`,
      points,
      role: String(stateId)
    });
  }

  for (const path of buildBorderScene(source, revision).state.paths) {
    const stateIds = getStateIds(path.domainId);
    if (!stateIds) continue;
    for (const stateId of stateIds) getGroup(stateId).paths.push({ ...path, role: String(stateId) });
  }

  return {
    groups: [...groups]
      .filter(([, group]) => group.paths.length && group.polygons.length)
      .map(([stateId, group]) => ({ ...group, stateId })),
    revision
  };
}

function getStateIds(domainId: string | number): readonly [number, number] | null {
  const match = String(domainId).match(/^state:(\d+):(\d+):/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function isFinitePoint(point: readonly [number, number] | undefined): point is readonly [number, number] {
  return Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}
