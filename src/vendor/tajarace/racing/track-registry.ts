import type { TrackDefinition } from './track-types.js';

export class TrackRegistry {
  private tracks = new Map<string, TrackDefinition>();
  private defaultId: string | null = null;

  register(track: TrackDefinition, options?: { default?: boolean }): this {
    this.tracks.set(track.id, track);
    if (options?.default || this.defaultId === null) {
      this.defaultId = track.id;
    }
    return this;
  }

  get(id: string): TrackDefinition {
    const track = this.tracks.get(id);
    if (!track) {
      throw new Error(`track not found: ${id}`);
    }
    return track;
  }

  getDefault(): TrackDefinition {
    if (!this.defaultId) {
      throw new Error('no tracks registered');
    }
    return this.get(this.defaultId);
  }

  list(): TrackDefinition[] {
    return [...this.tracks.values()];
  }

  setDefault(id: string): void {
    if (!this.tracks.has(id)) {
      throw new Error(`track not found: ${id}`);
    }
    this.defaultId = id;
  }
}

let globalRegistry = new TrackRegistry();
let activeTrackId: string | null = null;

export function createTrackRegistry(tracks: TrackDefinition[]): TrackRegistry {
  const registry = new TrackRegistry();
  tracks.forEach((track, index) => {
    registry.register(track, { default: index === 0 });
  });
  return registry;
}

export function getGlobalTrackRegistry(): TrackRegistry {
  return globalRegistry;
}

export function setGlobalTrackRegistry(registry: TrackRegistry): void {
  globalRegistry = registry;
  activeTrackId = registry.getDefault().id;
}

export function setActiveTrackId(id: string): void {
  globalRegistry.get(id);
  activeTrackId = id;
}

export function getActiveTrack(): TrackDefinition {
  if (activeTrackId) {
    return globalRegistry.get(activeTrackId);
  }
  return globalRegistry.getDefault();
}
