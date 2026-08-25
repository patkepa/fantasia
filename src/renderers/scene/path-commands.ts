export type PathCommand =
  | { type: "bezierCurveTo"; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }
  | { type: "closePath" }
  | { type: "lineTo"; x: number; y: number }
  | { type: "moveTo"; x: number; y: number }
  | { type: "quadraticCurveTo"; cpx: number; cpy: number; x: number; y: number };

/**
 * A renderer-agnostic D3 curve target. Scene builders retain commands instead of serializing SVG markup only to
 * parse it back into Pixi graphics during every rebuild.
 */
export class PathCommandContext {
  readonly commands: PathCommand[] = [];

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.commands.push({ cp1x, cp1y, cp2x, cp2y, type: "bezierCurveTo", x, y });
  }

  closePath(): void {
    this.commands.push({ type: "closePath" });
  }

  lineTo(x: number, y: number): void {
    this.commands.push({ type: "lineTo", x, y });
  }

  moveTo(x: number, y: number): void {
    this.commands.push({ type: "moveTo", x, y });
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.commands.push({ cpx, cpy, type: "quadraticCurveTo", x, y });
  }
}
