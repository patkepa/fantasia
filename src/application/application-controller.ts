import type { RegenerateOptions } from "@/components/options/options-controller";
import { requireWorkspaceCapability } from "./workspace-mode";

export interface ApplicationControllerApi {
  focusOn: () => void;
  generateMapOnLoad: () => Promise<void>;
  /** Generate a world (seeded when given) behind the loading screen; resolves once it is rendered. */
  openGeneratedMap: (seed?: string) => Promise<void>;
  /** Load a `.map` file behind the loading screen; rejects when the file cannot be loaded. */
  openMapFile: (file: Blob) => Promise<void>;
  regenerateMap: (config?: string | RegenerateOptions) => void;
  undraw: () => void;
}

let target: ApplicationControllerApi | null = null;

export function bindApplicationController(nextTarget: ApplicationControllerApi): () => void {
  target = nextTarget;
  return () => {
    if (target === nextTarget) target = null;
  };
}

export const ApplicationController: ApplicationControllerApi = {
  focusOn: () => target?.focusOn(),
  generateMapOnLoad: () => target?.generateMapOnLoad() ?? Promise.resolve(),
  openGeneratedMap: seed => target?.openGeneratedMap(seed) ?? Promise.reject(new Error("Runtime is not ready")),
  openMapFile: file => target?.openMapFile(file) ?? Promise.reject(new Error("Runtime is not ready")),
  regenerateMap: config => {
    if (!requireWorkspaceCapability("map:generate")) return;
    target?.regenerateMap(config);
  },
  undraw: () => target?.undraw()
};
