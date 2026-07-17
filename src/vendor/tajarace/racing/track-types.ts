export type TileLayer = 'ground' | 'road';

export interface TileSymbolDef {
  asset: string;
  rotation?: number;
  layer: TileLayer;
}

export interface PlacedTile {
  symbol: string;
  asset: string;
  col: number;
  row: number;
  rotation: number;
  layer: TileLayer;
}

export interface TrackDefinition {
  id: string;
  name: string;
  tileSize: number;
  cols: number;
  rows: number;
  symbols: Record<string, TileSymbolDef>;
  layout: string[][];
  route: [number, number][];
  start: [number, number];
  finish: [number, number];
  tiles: PlacedTile[];
}

export interface TrackPosition {
  x: number;
  y: number;
  angle: number;
}
