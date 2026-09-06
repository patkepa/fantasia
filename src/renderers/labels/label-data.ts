import type { AddedLabel } from "@/generators/added-labels";
import type { Burg } from "@/generators/burgs-generator";
import type { Label } from "@/generators/labels-generator";
import type { Province } from "@/generators/provinces-generator";
import type { State } from "@/generators/states-generator";
import type { LabelData } from "@/renderers/labels/labels";
import type { Point } from "@/types/global";
import { fitStateLabel } from "./fit-state-label";

export function getLabelsData(): LabelData[] {
  return [
    collect(pack.states, buildStateLabel),
    collect(pack.provinces, buildProvinceLabel),
    collect(pack.addedLabels, buildAddedLabel),
    collect(pack.burgs, buildBurgLabel)
  ].flat();
}

function collect<T extends { i: number }>(
  entities: readonly T[] | undefined,
  build: (entity: T) => LabelData | undefined
): LabelData[] {
  const labels: LabelData[] = [];
  for (const entity of entities ?? []) {
    if (!entity.i) continue; // index 0 is a placeholder in every entity array
    const label = build(entity);
    if (label) labels.push(label);
  }
  return labels;
}

function buildBurgLabel(burg: Burg): LabelData | undefined {
  if (burg.removed) return undefined;
  return {
    ...burg.label,
    id: `burgLabel${burg.i}`,
    entityId: burg.i,
    text: burg.label?.text ?? burg.name ?? "",
    type: "burg",
    group: burg.label?.group || burg.group || "burg",
    anchor: [burg.x, burg.y],
    pathPoints: getCustomPath(burg.label)
  };
}

function buildProvinceLabel(province: Province): LabelData | undefined {
  if (province.removed) return undefined;
  return {
    ...province.label,
    id: `provinceLabel${province.i}`,
    entityId: province.i,
    text: province.label?.text ?? province.name,
    type: "province",
    group: province.label?.group || "province",
    anchor: province.pole || pack.cells.p[province.center],
    pathPoints: getCustomPath(province.label)
  };
}

function buildStateLabel(state: State): LabelData | undefined {
  if (state.removed) return undefined;
  const group = "state";
  const fitted = fitStateLabel(state, group);
  if (fitted && !fitted.pathPoints.length) return undefined; // state has no cells to fit the label into

  const text = fitted?.text ?? getStateName(state, group);
  if (!text) return undefined;

  return {
    id: `stateLabel${state.i}`,
    entityId: state.i,
    type: "state",
    group,
    text,
    fontSize: fitted?.fontSize,
    anchor: state.pole || pack.cells.p[state.center],
    pathPoints: fitted?.pathPoints
  };
}

function buildAddedLabel(addedLabel: AddedLabel): LabelData {
  return {
    ...addedLabel.label,
    id: `addedLabel${addedLabel.i}`,
    entityId: addedLabel.i,
    text: addedLabel.label.text ?? "",
    type: "added",
    group: addedLabel.label.group || "added",
    anchor: [addedLabel.x, addedLabel.y],
    pathPoints: getCustomPath(addedLabel.label)
  };
}

/** Path drawn for this particular label, if any */
function getCustomPath(label?: Label): Point[] | undefined {
  return label?.pathPoints?.length ? label.pathPoints : undefined;
}

// name mode is resolved by group name, the same way fitStateLabel resolves it
function getStateName(state: State, group: string): string {
  const mode = options.labels.groups.find(option => option.name === group)?.mode || "auto";
  return mode === "short" ? state.name : state.fullName || state.name;
}
