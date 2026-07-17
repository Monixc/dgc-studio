import type { TrackDefinition } from './track-types.js';
import { progressOnTrack } from './track-path.js';
import { getActiveTrack } from './track-registry.js';

export const TRACK_TILE_SIZE = 32;

export function progressToTrackPosition(
  progress: number,
  track: TrackDefinition = getActiveTrack(),
) {
  return progressOnTrack(track, progress);
}

export {
  applyLaneOffset,
  getTrackLaneOffset,
  getTrackStartPosition,
  progressOnTrack,
  getTrackDimensions,
} from './track-path.js';

export function getTrackWidth(track: TrackDefinition = getActiveTrack()): number {
  return track.cols * track.tileSize;
}

export function getTrackHeight(track: TrackDefinition = getActiveTrack()): number {
  return track.rows * track.tileSize;
}

/** @deprecated use getTrackWidth(getActiveTrack()) */
export const TRACK_WIDTH = 768;
/** @deprecated use getTrackHeight(getActiveTrack()) */
export const TRACK_HEIGHT = 512;
export const TRACK_COLS = 6;
export const TRACK_ROWS = 4;
export const TRACK_START = { x: 448, y: 64 };
