import {
  type CultureGenerationSettings,
  type CultureGenerationWarning,
  Cultures
} from "@/generators/cultures-generator";
import { ensureEl } from "@/utils/nodeUtils";

/** Reads culture controls at the UI boundary for generator calls. */
export function getCultureGenerationSettings(): CultureGenerationSettings {
  return {
    emblemShape: ensureEl<HTMLSelectElement>("emblemShape").value
  };
}

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed for the classic generation pipeline
  var getCultureGenerationSettings: () => CultureGenerationSettings;
}

window.getCultureGenerationSettings = getCultureGenerationSettings;

/** Placement inputs are read only for generation and adding cultures, not expansion. */
export function getCulturePlacementSettings(): CultureGenerationSettings {
  const cultureSet = ensureEl<HTMLSelectElement>("culturesSet");
  return {
    ...getCultureGenerationSettings(),
    cultureSet: cultureSet.value,
    count: +ensureEl<HTMLInputElement>("culturesInput").value,
    maxCount: +(cultureSet.selectedOptions[0].dataset.max ?? "0"),
    sizeVariety: ensureEl<HTMLInputElement>("sizeVariety").valueAsNumber
  };
}

export function showCultureGenerationWarnings(warnings: readonly CultureGenerationWarning[]): void {
  if (!warnings.length) return;
  const messageHtml = warnings
    .map(warning =>
      warning.kind === "uninhabitable"
        ? `The climate is harsh and people cannot live in this world.<br />
       No cultures, states and burgs will be created.<br />
       Please consider changing climate settings in the World Configurator`
        : `There are only ${warning.populatedCells} populated cells and it's insufficient livable area.<br />
       Only ${warning.generated} out of ${warning.requested} requested cultures will be generated.<br />
       Please consider changing climate settings in the World Configurator`
    )
    .join("<br />");
  void import("@/components/ui/message-dialog").then(({ showMessageDialog }) => {
    showMessageDialog({ id: "extremeClimateWarning", messageHtml, title: "Extreme climate warning" });
  });
}

// Supported browser API: no-argument calls keep reading UI controls and showing warnings.
// Bundled callers import the generator and pass settings explicitly.
window.Cultures = {
  getRandomShield: () => Cultures.getRandomShield(),
  getDefault: (count, settings = getCulturePlacementSettings()) => Cultures.getDefault(count, settings),
  add: (center, settings = getCulturePlacementSettings()) => Cultures.add(center, settings),
  expand: (settings = getCultureGenerationSettings()) => Cultures.expand(settings),
  generate: (settings = getCulturePlacementSettings()) => {
    const warnings = Cultures.generate(settings);
    showCultureGenerationWarnings(warnings);
    return warnings;
  },
  regenerate: (settings = getCulturePlacementSettings()) => {
    const warnings = Cultures.regenerate(settings);
    showCultureGenerationWarnings(warnings);
    return warnings;
  }
};
