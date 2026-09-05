import { Buffer, BufferUsage, Container, Geometry, Mesh, Shader } from "pixi.js";
import type { RendererResourceTracker } from "../../core/resource-budget";
import {
  buildCellFillAttributes,
  type CellFillAttributeSource,
  type CellFillColorResolver,
  createCellFillColorResolver,
  updateCellFillAttributes
} from "../../scene/layers/cell-fill-attributes";
import {
  getCellGeometryRange,
  getRetainedCellTopologyTiles,
  type RetainedCellTopology
} from "../../scene/layers/retained-cell-topology";

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

interface CellMeshTile {
  colorBuffer: Buffer;
  geometry: Geometry;
  mesh: Mesh<Geometry, Shader>;
  resourceIds: readonly string[];
  sharedPositionBuffer: SharedPositionBuffer;
  topology: RetainedCellTopology;
}

export class RetainedCellMesh {
  readonly mesh: Container;
  private readonly shader: Shader;
  private readonly tiles: readonly CellMeshTile[];
  private static readonly positionBuffers = new WeakMap<RetainedCellTopology, SharedPositionBuffer>();
  private static sequence = 0;

  constructor(
    topology: RetainedCellTopology,
    source: CellFillAttributeSource,
    private readonly resources?: RendererResourceTracker
  ) {
    this.shader = Shader.from({
      gl: { fragment, name: "retained-cell-fill", vertex },
      gpu: {
        fragment: { entryPoint: "mainFragment", source: gpu },
        vertex: { entryPoint: "mainVertex", source: gpu }
      },
      resources: {}
    });
    this.mesh = new Container();
    this.mesh.eventMode = "none";
    const colorResolver = createCellFillColorResolver(source);
    this.tiles = getRetainedCellTopologyTiles(topology).map(tile => this.createTile(tile, source, colorResolver));
    for (const tile of this.tiles) this.mesh.addChild(tile.mesh);
  }

  update(source: CellFillAttributeSource, cellIds: Iterable<number>): void {
    const ids = [...new Set(cellIds)];
    if (!ids.length) return;
    const colorResolver = createCellFillColorResolver(source);
    const tileCellCount = this.tiles.reduce((count, tile) => count + tile.topology.cellRanges.length, 0);
    const shouldScanRequestedIds = ids.length * this.tiles.length <= tileCellCount;
    const requested = shouldScanRequestedIds ? null : new Set(ids);

    for (const tile of this.tiles) {
      const matchingIds = shouldScanRequestedIds
        ? ids.filter(cellId => getCellGeometryRange(tile.topology, cellId) !== undefined)
        : tile.topology.cellRanges.filter(range => requested!.has(range.cellId)).map(range => range.cellId);
      if (!matchingIds.length) continue;
      const update = updateCellFillAttributes(
        tile.colorBuffer.data as Float32Array,
        tile.topology,
        source,
        matchingIds,
        colorResolver
      );
      if (update) tile.colorBuffer.update();
    }
  }

  destroy(): void {
    this.mesh.removeFromParent();
    for (const tile of this.tiles) {
      tile.mesh.removeFromParent();
      tile.mesh.destroy();
      tile.geometry.destroy();
      tile.colorBuffer.destroy();
      RetainedCellMesh.releasePositionBuffer(tile.topology, tile.sharedPositionBuffer);
      for (const resourceId of tile.resourceIds) this.resources?.release(resourceId);
    }
    this.mesh.destroy({ children: false });
    this.shader.destroy();
  }

  private createTile(
    topology: RetainedCellTopology,
    source: CellFillAttributeSource,
    colorResolver: CellFillColorResolver
  ): CellMeshTile {
    const colors = buildCellFillAttributes(topology, source, colorResolver);
    const resourcePrefix = `retained-cells:${++RetainedCellMesh.sequence}`;
    const resourceIds = [`${resourcePrefix}:colors`, `${resourcePrefix}:indices`];
    const sharedPositionBuffer = RetainedCellMesh.acquirePositionBuffer(topology, this.resources);
    this.resources?.acquire(resourceIds[0], "geometry", colors.byteLength);
    this.resources?.acquire(resourceIds[1], "geometry", topology.indices.byteLength);
    const colorBuffer = new Buffer({
      data: colors,
      label: "retained-cell-colors",
      shrinkToFit: false,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST
    });
    const indexBuffer = new Buffer({
      data: topology.indices,
      label: "retained-cell-indices",
      usage: BufferUsage.INDEX | BufferUsage.STATIC
    });
    const geometry = new Geometry({
      attributes: {
        aColor: { buffer: colorBuffer, format: "float32x4" },
        aPosition: { buffer: sharedPositionBuffer.buffer, format: "float32x2" }
      },
      indexBuffer,
      topology: "triangle-list"
    });
    const mesh = new Mesh({ geometry, shader: this.shader });
    mesh.cullable = true;
    mesh.eventMode = "none";
    return { colorBuffer, geometry, mesh, resourceIds, sharedPositionBuffer, topology };
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
