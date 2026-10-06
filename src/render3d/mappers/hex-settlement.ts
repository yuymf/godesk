import type { Terrain } from "../../runtime/adapters/hex-settlement";
import type { SceneModel, SceneNode, SceneVec3 } from "../scene-model";
import { NUMBER_TOKEN_SCALE, TILE_RADIUS } from "../tokens";
import { diceAnchorFor, diceLayout } from "../dice";

/** Match topology-stub / hex-settlement flat-top pixel size, then scale to world units. */
const HEX_PIXEL_SIZE = 100;
const WORLD_SCALE = 0.01;

const TERRAIN_COLOR: Record<Terrain, string> = {
  wood: "wood",
  brick: "brick",
  sheep: "sheep",
  wheat: "wheat",
  ore: "ore",
  desert: "desert",
};

function toWorld(x: number, y: number, z = 0): SceneVec3 {
  return [x * WORLD_SCALE, z, y * WORLD_SCALE];
}

function hexCenter(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_PIXEL_SIZE * (1.5 * q),
    y: HEX_PIXEL_SIZE * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
  };
}

function parseVertex(id: string): { x: number; y: number } | null {
  const [xs, ys] = id.split(":");
  const x = Number(xs);
  const y = Number(ys);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function edgeEndpoints(edgeId: string): [{ x: number; y: number }, { x: number; y: number }] | null {
  const [a, b] = edgeId.split("|");
  const pa = parseVertex(a);
  const pb = parseVertex(b);
  if (!pa || !pb) return null;
  return [pa, pb];
}

function tileId(tile: { q: number; r: number }): string {
  return `tile:${tile.q},${tile.r}`;
}

function numberId(tile: { q: number; r: number }): string {
  return `num:${tile.q},${tile.r}`;
}

/**
 * Pure mapper: hex-settlement Kernel public state → SceneModel (§3.4).
 * Tidewell scene mapping; G3D-13 loads GLB templates in SceneHost.
 */
/** Structural subset accepted from Room session JSON / HexSettlementBoardState. */
export type HexSettlementSceneInput = {
  tiles: readonly { q: number; r: number; terrain: string; number: number | null }[];
  robberHex: string;
  ports: readonly { vertices: readonly string[]; kind: string }[];
  players: readonly {
    settlements: readonly string[];
    cities: readonly string[];
    roads: readonly string[];
  }[];
  lastDice: readonly [number, number] | null;
  /** G3D-09: a change into "roll_dice" marks a roll even when the faces repeat. */
  lastAction?: string | null;
};

/** Tile top surface (tile extrude depth); pieces stand on it. */
export const TILE_TOP_Y = 0.28;
/** Robber stands beside the number token on numbered tiles (desert: centre). */
export const ROBBER_TOKEN_OFFSET: readonly [number, number] = [0.42, -0.32];

export type HexSceneOptions = {
  /** Canvas orientation: the dice tray sits right of (landscape) or below (portrait) the island. */
  layout?: "landscape" | "portrait";
};

/** Framed island radius: farthest tile centre + tile radius + harbour margin. */
export function islandFrameRadius(tiles: HexSettlementSceneInput["tiles"]): number {
  let far = 0;
  for (const tile of tiles) {
    const c = hexCenter(tile.q, tile.r);
    far = Math.max(far, Math.hypot(c.x, c.y) * WORLD_SCALE);
  }
  return far + TILE_RADIUS + 0.4;
}

export function mapHexSettlementToScene(genre: HexSettlementSceneInput, options: HexSceneOptions = {}): SceneModel {
  const nodes: SceneNode[] = [];

  for (const tile of genre.tiles) {
    const center = hexCenter(tile.q, tile.r);
    nodes.push({
      id: tileId(tile),
      kind: "tile",
      position: toWorld(center.x, center.y, 0),
      tag: TERRAIN_COLOR[(tile.terrain as Terrain)] ?? tile.terrain,
    });
    // Lightweight decor placeholder per terrain (same id rule as §3.4 decor:{terrain}
    // but per-tile so InstancedMesh groups can still form later).
    nodes.push({
      id: `decor:${tile.q},${tile.r}`,
      kind: "decor",
      position: toWorld(center.x, center.y, 0.35),
      tag: tile.terrain,
      scale: [0.35, 0.35, 0.35],
    });
    if (tile.number !== null) {
      nodes.push({
        id: numberId(tile),
        kind: "number-token",
        position: toWorld(center.x, center.y, 0.42),
        number: tile.number,
        tag: tile.number === 6 || tile.number === 8 ? "hot" : "normal",
        // G3D-ART-2：筹码放大到约 37% 六角宽，数字贴花才读得出（见 number-labels.ts）。
        scale: [NUMBER_TOKEN_SCALE, 1, NUMBER_TOKEN_SCALE],
      });
    }
  }

  const robberTile = genre.tiles.find((tile) => `${tile.q},${tile.r}` === genre.robberHex);
  if (robberTile) {
    const center = hexCenter(robberTile.q, robberTile.r);
    const [ox, oz] = robberTile.number !== null ? ROBBER_TOKEN_OFFSET : [0, 0];
    const at = toWorld(center.x, center.y, TILE_TOP_Y);
    nodes.push({
      id: "robber",
      kind: "robber",
      position: [at[0] + ox, at[1], at[2] + oz],
      tag: "fog-lantern",
    });
  }

  genre.ports.forEach((port, index) => {
    const [v0] = port.vertices;
    const point = parseVertex(v0);
    if (!point) return;
    nodes.push({
      id: `port:${index}`,
      kind: "port",
      position: toWorld(point.x * 1.08, point.y * 1.08, 0.05),
      tag: port.kind,
      scale: [1, 1, 1],
    });
    nodes.push({
      id: `ship:${index}`,
      kind: "ship",
      position: toWorld(point.x * 1.22, point.y * 1.22, 0.12),
      tag: index % 2 === 0 ? "ship-a" : "ship-b",
      scale: [1, 1, 1],
    });
  });

  genre.players.forEach((player, seat) => {
    for (const vertexId of player.settlements) {
      const point = parseVertex(vertexId);
      if (!point) continue;
      nodes.push({
        id: `settle:${vertexId}`,
        kind: "settlement",
        position: toWorld(point.x, point.y, TILE_TOP_Y - 0.01),
        seat,
        tag: `seat${seat}`,
        scale: [1, 1, 1],
      });
    }
    for (const vertexId of player.cities) {
      const point = parseVertex(vertexId);
      if (!point) continue;
      nodes.push({
        id: `city:${vertexId}`,
        kind: "city",
        position: toWorld(point.x, point.y, TILE_TOP_Y - 0.01),
        seat,
        tag: `seat${seat}`,
        scale: [1, 1, 1],
      });
    }
    for (const edgeId of player.roads) {
      const ends = edgeEndpoints(edgeId);
      if (!ends) continue;
      const [a, b] = ends;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      nodes.push({
        id: `road:${edgeId}`,
        kind: "road",
        position: toWorld(mid.x, mid.y, TILE_TOP_Y - 0.012),
        rotationY: -angle,
        seat,
        tag: `seat${seat}`,
        scale: [1, 1, 1],
      });
    }
  });

  const radius = islandFrameRadius(genre.tiles);
  const layout = diceLayout(diceAnchorFor(options.layout === "portrait" ? 0.6 : 1.6, radius));
  nodes.push({
    id: "dice-tray",
    kind: "dice-tray",
    position: layout.tray.position,
    rotationY: layout.tray.rotationY,
    tag: "tray",
  });
  const dice = genre.lastDice ?? ([1, 1] as const);
  layout.dice.forEach((die, index) => {
    nodes.push({
      id: `die:${index}`,
      kind: "die",
      position: die.position,
      rotationY: die.rotationY,
      number: dice[index],
    });
  });
  // G3D-08: water plane in SceneHost. G3D-13: island cliff base ring.
  nodes.push({
    id: "cliff",
    kind: "cliff",
    position: [0, -0.35, 0],
    scale: [5.2, 0.7, 5.2],
    tag: "stone",
  });

  return { nodes };
}
