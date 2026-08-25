export interface AdaptiveQualityPolicy {
  readonly interactionResolutionCap: number;
  readonly settleDelayMs: number;
}

export type RenderQualityMode = "interactive" | "settled";

export const DEFAULT_ADAPTIVE_QUALITY_POLICY: Readonly<AdaptiveQualityPolicy> = {
  interactionResolutionCap: 1.25,
  settleDelayMs: 220
};

/**
 * Chooses the backing-canvas resolution for a map gesture. Scene geometry remains unchanged;
 * only the temporary raster density changes, so the final settled frame always uses full quality.
 */
export function selectAdaptiveResolution(
  targetResolution: number,
  mode: RenderQualityMode,
  policy: AdaptiveQualityPolicy = { ...DEFAULT_ADAPTIVE_QUALITY_POLICY }
): number {
  const target = Math.max(0.5, targetResolution);
  if (mode === "settled") return target;
  return Math.min(target, Math.max(0.5, policy.interactionResolutionCap));
}
