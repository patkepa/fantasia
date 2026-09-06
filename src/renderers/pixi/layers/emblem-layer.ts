import { Container, Graphics, GraphicsContext, Sprite, type Texture } from "pixi.js";
import type { Emblem } from "@/generators/emblems/generator";
import type { RendererResourceHandle } from "@/renderers/core/resource-cache";
import type { EmblemScene } from "@/renderers/scene/layers/emblem-scene";
import { bucketSpatialItems } from "@/renderers/scene/spatial-buckets";

interface EmblemGroupDisplay {
  automaticVisibility: boolean;
  baseSize: number;
  container: Container;
}

interface EmblemBuildOptions {
  acquireTexture: (source: string) => Promise<RendererResourceHandle<Texture>>;
  assertAssetAvailable: (id: string) => void;
  isCurrent: () => boolean;
  resolveIcon?: (id: string, coa: Emblem, strokeWidth: number) => Promise<string | null> | string | null;
  strokeWidth: number;
}

/** Owns emblem display state and resource handles; the map renderer owns stage attachment and scheduling. */
export class PixiEmblemLayer {
  private groups: EmblemGroupDisplay[] = [];
  private sources = new Map<string, Promise<string | null>>();
  private textures = new Set<RendererResourceHandle<Texture>>();
  missingAssets: string[] = [];

  async build(scene: EmblemScene, options: EmblemBuildOptions): Promise<Container> {
    const container = new Container();
    container.label = "emblems";
    container.alpha = scene.opacity;
    const activeKeys = new Set(scene.groups.flatMap(group => group.items.map(item => item.textureKey)));
    for (const key of this.sources.keys()) if (!activeKeys.has(key)) this.sources.delete(key);

    const handles = new Set<RendererResourceHandle<Texture>>();
    const groups: EmblemGroupDisplay[] = [];
    const missing: string[] = [];
    let committed = false;
    try {
      for (const group of scene.groups) {
        const results = await Promise.allSettled(
          group.items.map(async item => {
            let handle: RendererResourceHandle<Texture> | null = null;
            try {
              const source = await this.getSource(item.textureKey, item.svgId, item.coa, options);
              if (source) {
                handle = await options.acquireTexture(source);
                handles.add(handle);
              }
            } catch {
              options.assertAssetAvailable(item.domainId);
            }
            if (!handle) {
              options.assertAssetAvailable(item.domainId);
              missing.push(item.domainId);
            }
            return {
              handle,
              item,
              height: item.size,
              width: item.size,
              x: item.x - item.size / 2,
              y: item.y - item.size / 2
            };
          })
        );
        if (!options.isCurrent()) return container;
        const displays = results.map(result => {
          if (result.status === "rejected") throw result.reason;
          return result.value;
        });
        const groupContainer = new Container();
        groupContainer.label = `emblems:${group.type}`;
        container.addChild(groupContainer);
        groups.push({
          automaticVisibility: scene.automaticVisibility,
          baseSize: group.baseSize,
          container: groupContainer
        });
        for (const bucket of bucketSpatialItems(displays, 256)) {
          const tile = new Container();
          tile.cullable = true;
          tile.label = `emblems:${group.type}:tile:${bucket.key}`;
          groupContainer.addChild(tile);
          for (const { handle, item } of bucket.items) {
            const display = handle
              ? new Sprite({ height: item.size, texture: handle.value, width: item.size })
              : createMissingEmblemGraphic(item.size);
            display.eventMode = "none";
            display.label = `emblem:${item.domainId}`;
            display.position.set(item.x, item.y);
            if (display instanceof Sprite) display.anchor.set(0.5);
            tile.addChild(display);
          }
        }
      }
      this.groups = groups;
      this.missingAssets = missing;
      for (const handle of handles) this.textures.add(handle);
      committed = true;
      return container;
    } catch (error) {
      container.destroy({ children: true });
      throw error;
    } finally {
      if (!committed) for (const handle of handles) handle.release();
    }
  }

  updateVisibility(scale: number): void {
    for (const group of this.groups) {
      const renderedSize = group.baseSize * scale;
      group.container.visible = !group.automaticVisibility || (renderedSize >= 25 && renderedSize <= 300);
    }
  }

  release(): void {
    this.groups = [];
    this.missingAssets = [];
    for (const handle of this.textures) handle.release();
    this.textures.clear();
  }

  clear(): void {
    this.release();
    this.sources.clear();
  }

  private getSource(key: string, id: string, coa: Emblem, options: EmblemBuildOptions): Promise<string | null> {
    const cached = this.sources.get(key);
    if (cached) return cached;
    const source = Promise.resolve(options.resolveIcon?.(id, coa, options.strokeWidth) ?? null).catch(() => null);
    this.sources.set(key, source);
    return source;
  }
}

function createMissingEmblemGraphic(size: number): Graphics {
  const radius = size / 2;
  return new Graphics(
    new GraphicsContext()
      .poly(
        [
          0,
          -radius,
          radius * 0.82,
          -radius * 0.45,
          radius * 0.68,
          radius * 0.5,
          0,
          radius,
          -radius * 0.68,
          radius * 0.5,
          -radius * 0.82,
          -radius * 0.45
        ],
        true
      )
      .fill({ alpha: 0.65, color: "#eeeeee" })
      .stroke({ color: "#c13119", width: Math.max(0.4, size / 24) })
      .moveTo(-radius * 0.4, -radius * 0.35)
      .lineTo(radius * 0.4, radius * 0.45)
      .moveTo(radius * 0.4, -radius * 0.35)
      .lineTo(-radius * 0.4, radius * 0.45)
      .stroke({ color: "#c13119", width: Math.max(0.4, size / 24) })
  );
}
