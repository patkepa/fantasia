import { Buffer, BufferUsage, Geometry, Mesh, Shader } from "pixi.js";
import type { RendererResourceTracker } from "../../core/resource-budget";
import { type CellFillAttributeSource, updateCellFillAttributes } from "../../scene/layers/cell-fill-attributes";
import { buildCellFillScene, type CellLayerId } from "../../scene/layers/cell-fill-scene";
import type { RetainedCellTopology } from "../../scene/layers/retained-cell-topology";

const vertex = /* glsl */ `
  in vec2 aPosition;
  in vec4 aColor;
  out vec4 vColor;

  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;
  uniform vec4 uWorldColorAlpha;
  uniform vec4 uColor;

  void main(void) {
    mat3 matrix = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((matrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vColor = aColor * uColor * uWorldColorAlpha;
  }
`;

const fragment = /* glsl */ `
  in vec4 vColor;
  out vec4 finalColor;

  void main(void) {
    finalColor = vColor;
  }
`;

const gpu = /* wgsl */ `
  struct GlobalUniforms {
    uProjectionMatrix: mat3x3<f32>,
    uWorldTransformMatrix: mat3x3<f32>,
    uWorldColorAlpha: vec4<f32>,
    uResolution: vec2<f32>
  }

  @group(0) @binding(0) var<uniform> globalUniforms: GlobalUniforms;

  struct LocalUniforms {
    uTransformMatrix: mat3x3<f32>,
    uColor: vec4<f32>,
    uRound: f32
  }

  @group(1) @binding(0) var<uniform> localUniforms: LocalUniforms;

  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>
  }

  @vertex
  fn mainVertex(@location(0) aPosition: vec2<f32>, @location(1) aColor: vec4<f32>) -> VertexOutput {
    var output: VertexOutput;
    let matrix =
      globalUniforms.uProjectionMatrix *
      globalUniforms.uWorldTransformMatrix *
      localUniforms.uTransformMatrix;
    output.position = vec4<f32>((matrix * vec3<f32>(aPosition, 1.0)).xy, 0.0, 1.0);
    output.color = aColor * localUniforms.uColor * globalUniforms.uWorldColorAlpha;
    return output;
  }

  @fragment
  fn mainFragment(input: VertexOutput) -> @location(0) vec4<f32> {
    return input.color;
  }
`;

interface SharedPositionBuffer {
  buffer: Buffer;
  references: number;
  resourceId: string;
  resources?: RendererResourceTracker;
}

export class RetainedCellMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  private readonly colorBuffer: Buffer;
  private readonly geometry: Geometry;
  private readonly shader: Shader;
  private readonly resourceIds: readonly string[];
  private readonly sharedPositionBuffer: SharedPositionBuffer;
  private static readonly positionBuffers = new WeakMap<RetainedCellTopology, SharedPositionBuffer>();
  private static sequence = 0;

  constructor(
    private readonly topology: RetainedCellTopology,
    source: CellFillAttributeSource,
    layer: CellLayerId,
    private readonly resources?: RendererResourceTracker
  ) {
    const scene = buildCellFillScene(topology, source, layer);
    const resourcePrefix = `retained-cells:${++RetainedCellMesh.sequence}`;
    this.resourceIds = [`${resourcePrefix}:colors`, `${resourcePrefix}:indices`];
    this.sharedPositionBuffer = RetainedCellMesh.acquirePositionBuffer(topology, resources);
    resources?.acquire(this.resourceIds[0], "geometry", scene.colors?.byteLength ?? 0);
    resources?.acquire(this.resourceIds[1], "geometry", scene.indices.byteLength);
    this.colorBuffer = new Buffer({
      data: scene.colors,
      label: "retained-cell-colors",
      shrinkToFit: false,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST
    });
    const indexBuffer = new Buffer({
      data: scene.indices,
      label: "retained-cell-indices",
      usage: BufferUsage.INDEX | BufferUsage.STATIC
    });
    this.geometry = new Geometry({
      attributes: {
        aColor: { buffer: this.colorBuffer, format: "float32x4" },
        aPosition: { buffer: this.sharedPositionBuffer.buffer, format: "float32x2" }
      },
      indexBuffer,
      topology: "triangle-list"
    });
    this.shader = Shader.from({
      gl: { fragment, name: "retained-cell-fill", vertex },
      gpu: {
        fragment: { entryPoint: "mainFragment", source: gpu },
        vertex: { entryPoint: "mainVertex", source: gpu }
      },
      resources: {}
    });
    this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader });
    this.mesh.cullable = true;
    this.mesh.eventMode = "none";
  }

  update(source: CellFillAttributeSource, cellIds: Iterable<number>): void {
    const update = updateCellFillAttributes(this.colorBuffer.data as Float32Array, this.topology, source, cellIds);
    if (update) this.colorBuffer.update();
  }

  destroy(): void {
    this.mesh.removeFromParent();
    this.mesh.destroy();
    this.geometry.destroy();
    this.colorBuffer.destroy();
    this.shader.destroy();
    RetainedCellMesh.releasePositionBuffer(this.topology, this.sharedPositionBuffer);
    for (const resourceId of this.resourceIds) this.resources?.release(resourceId);
  }

  private static acquirePositionBuffer(
    topology: RetainedCellTopology,
    resources?: RendererResourceTracker
  ): SharedPositionBuffer {
    let shared = RetainedCellMesh.positionBuffers.get(topology);
    if (!shared) {
      const resourceId = `retained-cells:positions:${++RetainedCellMesh.sequence}`;
      resources?.acquire(resourceId, "geometry", topology.positions.byteLength);
      shared = {
        buffer: new Buffer({
          data: topology.positions,
          label: "retained-cell-positions",
          usage: BufferUsage.VERTEX | BufferUsage.STATIC
        }),
        references: 0,
        resourceId,
        resources
      };
      RetainedCellMesh.positionBuffers.set(topology, shared);
    }
    shared.references++;
    return shared;
  }

  private static releasePositionBuffer(topology: RetainedCellTopology, shared: SharedPositionBuffer): void {
    if (--shared.references > 0) return;
    shared.buffer.destroy();
    shared.resources?.release(shared.resourceId);
    RetainedCellMesh.positionBuffers.delete(topology);
  }
}
