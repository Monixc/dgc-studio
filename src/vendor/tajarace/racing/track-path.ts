import type { TrackDefinition, TrackPosition } from './track-types.js';

interface PathSegment {
  length: number;
  sample: (t: number) => TrackPosition;
}

function cellCenter(col: number, row: number, tileSize: number): { x: number; y: number } {
  return {
    x: (col + 0.5) * tileSize,
    y: (row + 0.5) * tileSize,
  };
}

function lineSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): PathSegment {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return {
    length,
    sample: (t) => ({
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t,
      angle,
    }),
  };
}

function buildClosedRouteSegments(track: TrackDefinition): PathSegment[] {
  const { route, tileSize } = track;
  const points = route.map(([col, row]) => cellCenter(col, row, tileSize));
  const segments: PathSegment[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    segments.push(lineSegment(a.x, a.y, b.x, b.y));
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (first.x !== last.x || first.y !== last.y) {
    segments.push(lineSegment(last.x, last.y, first.x, first.y));
  }

  return segments;
}

function getTrackPathLength(track: TrackDefinition): number {
  return buildClosedRouteSegments(track).reduce((sum, seg) => sum + seg.length, 0);
}

export function progressOnTrack(track: TrackDefinition, progress: number): TrackPosition {
  const segments = buildClosedRouteSegments(track);
  const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
  if (totalLength === 0) {
    const [col, row] = track.start;
    const center = cellCenter(col, row, track.tileSize);
    return { ...center, angle: 0 };
  }

  const clamped = ((progress % 1) + 1) % 1;
  let remaining = clamped * totalLength;

  for (const segment of segments) {
    if (remaining <= segment.length) {
      const t = segment.length === 0 ? 0 : remaining / segment.length;
      return segment.sample(t);
    }
    remaining -= segment.length;
  }

  return segments[0]!.sample(0);
}

export function getTrackStartPosition(track: TrackDefinition): { x: number; y: number } {
  const [col, row] = track.start;
  return cellCenter(col, row, track.tileSize);
}

export function getTrackDimensions(track: TrackDefinition): { width: number; height: number } {
  return {
    width: track.cols * track.tileSize,
    height: track.rows * track.tileSize,
  };
}

export function getTrackLaneOffset(index: number, total: number, tileSize = 32): number {
  const laneWidth = tileSize * (12 / 128);
  return (index - (total - 1) / 2) * laneWidth;
}

export function applyLaneOffset(
  pos: TrackPosition,
  offset: number,
): TrackPosition {
  return {
    x: pos.x - Math.sin(pos.angle) * offset,
    y: pos.y + Math.cos(pos.angle) * offset,
    angle: pos.angle,
  };
}

export { getTrackPathLength };
