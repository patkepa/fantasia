export interface RendererFrameCandidate {
  batches: number;
  canvasHeight: number;
  canvasWidth: number;
  cells: number;
  commitSequence: number;
  contextLost: boolean;
  enabled: boolean;
  viewportHeight: number;
  viewportWidth: number;
}

export function getRendererFrameIssues(
  frame: RendererFrameCandidate,
  expectedCells: number,
  previousCommit: number
): string[] {
  const issues: string[] = [];
  if (!frame.enabled) issues.push("Pixi did not enable its rendering surface");
  if (frame.contextLost) issues.push("The WebGL context was lost before the map frame committed");
  if (frame.commitSequence <= previousCommit) issues.push("Pixi completed without committing a new map frame");
  if (frame.cells !== expectedCells)
    issues.push(`Pixi committed ${frame.cells} cells for a ${expectedCells}-cell world`);
  if (frame.batches < 2) issues.push("Pixi committed an empty map scene");
  if (frame.viewportHeight < 1 || frame.viewportWidth < 1) issues.push("Pixi committed a zero-sized viewport");
  if (frame.canvasHeight < 1 || frame.canvasWidth < 1) issues.push("Pixi committed without a drawable canvas");
  return issues;
}
