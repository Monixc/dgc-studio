import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { F1Track } from "@tajarace/ui";
import { trackRegistry } from "@/vendor/tajarace/tracks";

type Direction = "N" | "E" | "S" | "W";

const EXPECTED_SYMBOL: Record<string, string[]> = {
  "E,W": ["h"],
  "N,S": ["v", "V"],
  "E,S": ["L"],
  "S,W": ["R"],
  "N,W": ["L2"],
  "E,N": ["R2"],
};

const LONG_TRACK_IDS = ["marathon", "switchback", "canyon", "double-chicane", "endurance"] as const;
const NEW_TRACK_IDS = ["apex-gp", "dragon-s", "harbor-street", "alpine-spa", "corkscrew"] as const;
const MAX_LEGACY_AREA = 11 * 8; // grand-prix
const MIN_LONG_ROUTE = 68;

function direction(from: [number, number], to: [number, number]): Direction {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  if (dx === 1 && dy === 0) return "E";
  if (dx === -1 && dy === 0) return "W";
  if (dx === 0 && dy === 1) return "S";
  if (dx === 0 && dy === -1) return "N";
  throw new Error(`route cells are not adjacent: ${from} -> ${to}`);
}

function turnCount(route: [number, number][]) {
  let turns = 0;
  for (let i = 0; i < route.length; i++) {
    const previous = route[(i - 1 + route.length) % route.length]!;
    const current = route[i]!;
    const next = route[(i + 1) % route.length]!;
    if (direction(previous, current) !== direction(current, next)) turns += 1;
  }
  return turns;
}

describe("typing race track maps", () => {
  it("contains sixteen closed tracks with matching road assets and routes", () => {
    const tracks = trackRegistry.list();
    expect(tracks).toHaveLength(16);
    expect(tracks.slice(0, 5).map((track) => track.id)).toEqual(NEW_TRACK_IDS);
    expect(tracks.some((track) => track.id === "tower")).toBe(false);

    for (const track of tracks) {
      expect(track.route).toContainEqual(track.start);
      expect(track.route).toContainEqual(track.finish);
      expect(new Set(track.route.map(([col, row]) => `${col},${row}`)).size).toBe(track.route.length);

      track.route.forEach((cell, index) => {
        const previous = track.route[(index - 1 + track.route.length) % track.route.length]!;
        const next = track.route[(index + 1) % track.route.length]!;
        const directions = [direction(cell, previous), direction(cell, next)].sort().join(",");
        const symbol = track.layout[cell[1]]?.[cell[0]];
        expect(EXPECTED_SYMBOL[directions], `${track.id} [${cell}] ${directions}`).toContain(symbol);
      });
    }
  });

  it("adds five long circuits at least 2x the previous max map size", () => {
    for (const id of LONG_TRACK_IDS) {
      const track = trackRegistry.get(id);
      expect(track.cols * track.rows).toBeGreaterThanOrEqual(MAX_LEGACY_AREA * 2);
      expect(track.route.length).toBeGreaterThanOrEqual(MIN_LONG_ROUTE);
      expect(turnCount(track.route)).toBeGreaterThanOrEqual(20);
    }
  });

  it("places five complex horizontal circuits first", () => {
    for (const id of NEW_TRACK_IDS) {
      const track = trackRegistry.get(id);
      expect(track.cols).toBeGreaterThan(track.rows);
      expect(track.route.length).toBeGreaterThanOrEqual(78);
      expect(turnCount(track.route)).toBeGreaterThanOrEqual(20);
    }
  });

  it("rotates start lines to match each route direction", () => {
    const participant = [{
      id: "me",
      name: "나",
      progress: 0,
      wpm: 0,
      speed: 0,
      rank: 1,
      isReady: true,
      isFinished: false,
    }];
    const oval = renderToStaticMarkup(createElement(F1Track, {
      participants: participant,
      track: trackRegistry.get("oval"),
      myParticipantId: "me",
    }));
    const doglegTrack = trackRegistry.get("dogleg");
    const dogleg = renderToStaticMarkup(createElement(F1Track, {
      participants: participant,
      track: doglegTrack,
      myParticipantId: "me",
    }));
    const doglegReversed = renderToStaticMarkup(createElement(F1Track, {
      participants: participant,
      track: { ...doglegTrack, route: [doglegTrack.route[0]!, ...doglegTrack.route.slice(1).reverse()] },
      myParticipantId: "me",
    }));

    expect(oval).toContain("rotate(90 ");
    expect(dogleg).toContain("rotate(0 ");
    expect(doglegReversed).toContain("rotate(0 ");
    expect(oval).toContain("width:100%");
    expect(oval).toContain("height:min(58vh, 640px)");
    expect(oval).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(oval).toContain('viewBox="0 -32 192 192"');
    expect(oval).toContain('data-laps="3"');
    expect(oval).not.toMatch(/(?:dry|green)_ground\.png/);
    expect(oval).toContain("background-color:#080b10");
    expect(oval).toContain("background-image:radial-gradient(");
    expect(oval).toContain('font-size="6"');
    expect(oval).toContain(">나</text>");
  });

  it("uses a dark UI background without grass tiles", () => {
    for (const track of trackRegistry.list()) {
      const markup = renderToStaticMarkup(createElement(F1Track, {
        participants: [],
        track,
      }));
      expect(markup, track.id).not.toMatch(/(?:dry|green)_ground\.png/);
      expect(markup, track.id).toContain("background-color:#080b10");
    }
  });
});
