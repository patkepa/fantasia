// Curated worlds shown in the main menu's Showcase. Each one is a generation seed rather than a stored
// `.map` file: the world is regenerated on demand, so presets never go stale across save-format versions.

export interface ShowcaseMap {
  id: string;
  name: string;
  tagline: string;
  description: string;
  seed: string;
  /** Accent used by the menu card art. */
  accent: string;
}

export const SHOWCASE_MAPS: readonly ShowcaseMap[] = [
  {
    id: "sundered-crowns",
    name: "The Sundered Crowns",
    tagline: "A continent of feuding realms",
    description: "Old kingdoms crowd a broken coastline, each one claiming the throne of a fallen empire.",
    seed: "180725341",
    accent: "#b0413e"
  },
  {
    id: "emerald-reach",
    name: "The Emerald Reach",
    tagline: "Forest kingdoms and river trade",
    description: "Great rivers carry merchants between wooded duchies and the free cities of the delta.",
    seed: "602914877",
    accent: "#3f7f4f"
  },
  {
    id: "salt-and-storm",
    name: "Salt & Storm",
    tagline: "Islands under a restless sea",
    description: "Seafaring peoples scatter across storm-lashed isles where every harbour is a fortress.",
    seed: "934458112",
    accent: "#2f5f8f"
  }
];

export function getShowcaseMap(id: string): ShowcaseMap | undefined {
  return SHOWCASE_MAPS.find(map => map.id === id);
}
