import { parse as parseYaml } from 'yaml';
import type { PlacedTile, TileSymbolDef, TrackDefinition } from './track-types.js';

interface RawTrackYaml {
  id: string;
  name: string;
  tileSize?: number;
  symbols?: Record<string, TileSymbolDef>;
  layout: string[];
  route: string | string[] | [number, number][];
  start: [number, number];
  finish?: [number, number];
}

function parseLayoutRows(rows: string[]): string[][] {
  return rows.map((row) => {
    const tokens = row.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      throw new Error('layout row is empty');
    }
    return tokens;
  });
}

function parseRoute(raw: RawTrackYaml['route'], layout: string[][], start: [number, number]): [number, number][] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) throw new Error('route is empty');
    if (typeof raw[0] === 'string') {
      const tokens = raw as string[];
      if (tokens.some((t) => /^\d/.test(t) || t.includes(','))) {
        return parseRouteString(tokens.join(' '));
      }
      return parseSymbolRoute(layout, start, tokens);
    }
    return raw as [number, number][];
  }

  if (/(\d+\s*,\s*\d+|\d+\s+\d+)/.test(raw)) {
    return parseRouteString(raw);
  }

  return parseSymbolRoute(layout, start, raw.trim().split(/\s+/).filter(Boolean));
}

function parseRouteString(raw: string): [number, number][] {
  const tokens = raw.trim().split(/[\s,>]+/).filter(Boolean);
  const points: [number, number][] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (/^\d+$/.test(token) && i + 1 < tokens.length && /^\d+$/.test(tokens[i + 1]!)) {
      points.push([Number(token), Number(tokens[i + 1]!)]);
      i += 1;
      continue;
    }
    const match = token.match(/^(\d+)[,\s]+(\d+)$/);
    if (match) {
      points.push([Number(match[1]), Number(match[2])]);
      continue;
    }
    throw new Error(`invalid route token: "${token}"`);
  }

  if (points.length < 2) {
    throw new Error('route must contain at least 2 points');
  }
  return points;
}

const NEIGHBOR_DELTAS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function parseSymbolRoute(
  layout: string[][],
  start: [number, number],
  symbols: string[],
): [number, number][] {
  const path: [number, number][] = [[...start]];
  let [col, row] = start;
  const visited = new Set<string>([`${col},${row}`]);
  let index = 0;
  let lastDir: [number, number] | null = null;

  if (symbols[0] === layout[row]?.[col]) {
    index = 1;
  }

  for (; index < symbols.length; index++) {
    const symbol = symbols[index]!;
    const candidates: [number, number][] = [];

    for (const [dc, dr] of NEIGHBOR_DELTAS) {
      const nc = col + dc;
      const nr = row + dr;
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;
      if (layout[nr]?.[nc] !== symbol) continue;
      candidates.push([nc, nr]);
    }

    let next: [number, number] | undefined;

    if (lastDir && candidates.length > 1) {
      const [ldx, ldy] = lastDir;
      const turnOrder: [number, number][] = [
        [ldx, ldy],
        [-ldy, ldx],
        [ldy, -ldx],
      ];
      for (const [tdx, tdy] of turnOrder) {
        next = candidates.find(([nc, nr]) => nc - col === tdx && nr - row === tdy);
        if (next) break;
      }
    }
    next ??= candidates[0];

    if (!next) {
      const neighbors = NEIGHBOR_DELTAS.map(([dc, dr]) => {
        const nc = col + dc;
        const nr = row + dr;
        const sym = layout[nr]?.[nc];
        return sym ? `[${nc},${nr}]=${sym}` : null;
      }).filter(Boolean);
      throw new Error(
        `route symbol "${symbol}" has no adjacent match from [${col}, ${row}]. ` +
        `Neighbors: ${neighbors.join(', ') || 'none'}. ` +
        `Check that layout and route symbols match.`,
      );
    }

    [col, row] = next;
    lastDir = [col - path[path.length - 1]![0], row - path[path.length - 1]![1]];
    visited.add(`${col},${row}`);
    path.push([col, row]);
  }

  return path;
}

function buildTiles(
  layout: string[][],
  symbols: Record<string, TileSymbolDef>,
): PlacedTile[] {
  const tiles: PlacedTile[] = [];

  layout.forEach((row, rowIndex) => {
    row.forEach((symbol, col) => {
      const def = symbols[symbol];
      if (!def) {
        throw new Error(`unknown tile symbol "${symbol}" at [${col}, ${rowIndex}]`);
      }
      tiles.push({
        symbol,
        asset: def.asset,
        col,
        row: rowIndex,
        rotation: def.rotation ?? 0,
        layer: def.layer,
      });
    });
  });

  return tiles;
}

function normalizeRows(layout: string[][]): string[][] {
  const width = layout[0]?.length ?? 0;
  if (width === 0) throw new Error('layout is empty');

  for (const row of layout) {
    if (row.length !== width) {
      throw new Error('all layout rows must have the same number of tiles');
    }
  }
  return layout;
}

function assertCellInLayout(
  trackId: string,
  label: string,
  [col, row]: [number, number],
  layout: string[][],
): void {
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    throw new Error(
      `track "${trackId}" ${label} [${col}, ${row}] is out of bounds ` +
      `(layout is ${cols} cols x ${rows} rows, rows/cols are 0-indexed)`,
    );
  }
}

export function parseTrackYaml(
  yamlSource: string,
  defaults?: { tileSize?: number; symbols?: Record<string, TileSymbolDef> },
): TrackDefinition {
  const raw = parseYaml(yamlSource) as RawTrackYaml;

  if (!raw.id || !raw.name) {
    throw new Error('track yaml requires id and name');
  }
  if (!raw.layout?.length) {
    throw new Error(`track "${raw.id}" requires layout`);
  }
  if (!raw.start) {
    throw new Error(`track "${raw.id}" requires start: [col, row]`);
  }

  const tileSize = raw.tileSize ?? defaults?.tileSize ?? 32;
  const symbols = { ...defaults?.symbols, ...raw.symbols };
  const layout = normalizeRows(parseLayoutRows(raw.layout));
  assertCellInLayout(raw.id, 'start', raw.start, layout);
  const route = parseRoute(raw.route, layout, raw.start);
  const finish = raw.finish ?? raw.start;
  assertCellInLayout(raw.id, 'finish', finish, layout);

  return {
    id: raw.id,
    name: raw.name,
    tileSize,
    cols: layout[0]!.length,
    rows: layout.length,
    symbols,
    layout,
    route,
    start: raw.start,
    finish,
    tiles: buildTiles(layout, symbols),
  };
}

export function parseSymbolsYaml(yamlSource: string): {
  tileSize: number;
  symbols: Record<string, TileSymbolDef>;
} {
  const raw = parseYaml(yamlSource) as {
    tileSize?: number;
    symbols?: Record<string, TileSymbolDef>;
  };

  if (!raw.symbols) {
    throw new Error('symbols yaml requires symbols map');
  }

  return {
    tileSize: raw.tileSize ?? 32,
    symbols: raw.symbols,
  };
}
