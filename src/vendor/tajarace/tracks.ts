import {
  createTrackRegistry,
  parseSymbolsYaml,
  parseTrackYaml,
  setGlobalTrackRegistry,
  type TrackDefinition,
} from "@tajarace/racing";
import symbolsYaml from "./tracks/symbols.yml?raw";
import apexGpYaml from "./tracks/apex-gp.yml?raw";
import dragonSYaml from "./tracks/dragon-s.yml?raw";
import harborStreetYaml from "./tracks/harbor-street.yml?raw";
import alpineSpaYaml from "./tracks/alpine-spa.yml?raw";
import corkscrewYaml from "./tracks/corkscrew.yml?raw";
import ovalYaml from "./tracks/oval.yml?raw";
import wideYaml from "./tracks/wide.yml?raw";
import doglegYaml from "./tracks/dogleg.yml?raw";
import chicaneYaml from "./tracks/chicane.yml?raw";
import hairpinYaml from "./tracks/hairpin.yml?raw";
import grandPrixYaml from "./tracks/grand-prix.yml?raw";
import marathonYaml from "./tracks/marathon.yml?raw";
import switchbackYaml from "./tracks/switchback.yml?raw";
import canyonYaml from "./tracks/canyon.yml?raw";
import doubleChicaneYaml from "./tracks/double-chicane.yml?raw";
import enduranceYaml from "./tracks/endurance.yml?raw";

const symbolDefaults = parseSymbolsYaml(symbolsYaml);

function loadTrack(yaml: string): TrackDefinition {
  return parseTrackYaml(yaml, symbolDefaults);
}

export const trackRegistry = createTrackRegistry([
  loadTrack(apexGpYaml),
  loadTrack(dragonSYaml),
  loadTrack(harborStreetYaml),
  loadTrack(alpineSpaYaml),
  loadTrack(corkscrewYaml),
  loadTrack(ovalYaml),
  loadTrack(wideYaml),
  loadTrack(doglegYaml),
  loadTrack(chicaneYaml),
  loadTrack(hairpinYaml),
  loadTrack(grandPrixYaml),
  loadTrack(marathonYaml),
  loadTrack(switchbackYaml),
  loadTrack(canyonYaml),
  loadTrack(doubleChicaneYaml),
  loadTrack(enduranceYaml),
]);

setGlobalTrackRegistry(trackRegistry);

export const defaultTrackId = "apex-gp";
