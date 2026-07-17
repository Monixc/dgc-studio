import {
  DEFAULT_RACE_LAPS,
  applyLaneOffset,
  getTrackDimensions,
  getTrackLaneOffset,
  getTrackStartPosition,
  progressOnTrack,
  type RaceParticipant,
  type TrackDefinition,
} from '@tajarace/racing';

export interface F1TrackProps {
  participants: RaceParticipant[];
  track: TrackDefinition;
  width?: number;
  height?: number;
  assetBaseUrl?: string;
  laps?: number;
  myParticipantId?: string;
}

const CAR_SPRITE_W = 128;
const CAR_SPRITE_H = 192;
const CAR_COUNT = 4;

function tileTransform(col: number, row: number, rotation: number, tileSize: number): string {
  const x = col * tileSize;
  const y = row * tileSize;
  const cx = x + tileSize / 2;
  const cy = y + tileSize / 2;
  if (rotation === 0) return `translate(${x}, ${y})`;
  return `translate(${cx}, ${cy}) rotate(${rotation}) translate(${-tileSize / 2}, ${-tileSize / 2})`;
}

function markerPosition([col, row]: [number, number], tileSize: number) {
  return { x: (col + 0.5) * tileSize, y: (row + 0.5) * tileSize };
}

/** 기본 가로형 라인 에셋을 해당 지점의 진행 방향에 수직으로 회전한다. */
function markerRotation(track: TrackDefinition, cell: [number, number]): number {
  const index = track.route.findIndex(([col, row]) => col === cell[0] && row === cell[1]);
  if (index < 0 || track.route.length < 2) return 0;
  const current = markerPosition(track.route[index]!, track.tileSize);
  const next = markerPosition(track.route[(index + 1) % track.route.length]!, track.tileSize);
  const isVertical = Math.abs(next.y - current.y) > Math.abs(next.x - current.x);
  return isVertical ? 0 : 90;
}

function TrackTile({
  asset,
  col,
  row,
  rotation,
  tileSize,
  baseUrl,
}: {
  asset: string;
  col: number;
  row: number;
  rotation: number;
  tileSize: number;
  baseUrl: string;
}) {
  return (
    <image
      href={`${baseUrl}${asset}.png`}
      x={0}
      y={0}
      width={tileSize}
      height={tileSize}
      transform={tileTransform(col, row, rotation, tileSize)}
      preserveAspectRatio="none"
    />
  );
}

function CarSprite({
  carIndex,
  x,
  y,
  angleRad,
  isGhost,
  isMe,
  rank,
  baseUrl,
  tileSize,
}: {
  carIndex: number;
  x: number;
  y: number;
  angleRad: number;
  isGhost?: boolean;
  isMe?: boolean;
  rank: number;
  baseUrl: string;
  tileSize: number;
}) {
  const angleDeg = (angleRad * 180) / Math.PI + 90;
  const spriteX = (carIndex % CAR_COUNT) * CAR_SPRITE_W;
  const displayW = tileSize * (34 / 128);
  const displayH = tileSize * (51 / 128);

  return (
    <g transform={`translate(${x}, ${y}) rotate(${angleDeg})`} opacity={isGhost ? 0.55 : 1}>
      <svg
        x={-displayW / 2}
        y={-displayH / 2}
        width={displayW}
        height={displayH}
        viewBox={`${spriteX} 0 ${CAR_SPRITE_W} ${CAR_SPRITE_H}`}
        overflow="hidden"
      >
        <image href={`${baseUrl}f1_car_set.png`} width={CAR_SPRITE_W * CAR_COUNT} height={CAR_SPRITE_H} />
      </svg>
      {isGhost && (
        <circle cx={0} cy={0} r={18} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
      {isMe && (
        <circle cx={0} cy={0} r={11} fill="none" stroke="#facc15" strokeWidth={1.5} />
      )}
      <text
        x={0}
        y={-14}
        textAnchor="middle"
        fill={isMe ? '#facc15' : '#fff'}
        fontSize="6"
        fontWeight="700"
        stroke="#000"
        strokeWidth={1}
        paintOrder="stroke"
      >
        {isMe ? '나' : isGhost ? '👻' : `P${rank}`}
      </text>
    </g>
  );
}

export function F1Track({
  participants,
  track,
  width,
  height,
  assetBaseUrl = '/racing/',
  laps = DEFAULT_RACE_LAPS,
  myParticipantId,
}: F1TrackProps) {
  const baseUrl = assetBaseUrl.endsWith('/') ? assetBaseUrl : `${assetBaseUrl}/`;
  const { width: trackWidth, height: trackHeight } = getTrackDimensions(track);
  const renderWidth = width ?? '100%';
  const renderHeight = height ?? 'min(58vh, 640px)';
  const hasFinished = participants.some((p) => p.isFinished || p.progress >= 1);
  const startPos = getTrackStartPosition(track);
  const finishPos = markerPosition(track.finish, track.tileSize);
  const startRotation = markerRotation(track, track.start);
  const finishRotation = markerRotation(track, track.finish);
  const ts = track.tileSize;
  const startMarkW = ts * (172 / 128);
  const startMarkH = ts * (95 / 128);
  const finishMarkW = ts * (192 / 128);
  const finishMarkH = ts * (93 / 128);
  const roadTiles = track.tiles.filter((t) => t.layer === 'road');

  return (
    <div
      className="tj-f1-track"
      data-laps={laps}
      style={{
        width: renderWidth,
        maxWidth: '100%',
        height: renderHeight,
        overflow: 'hidden',
        backgroundColor: '#080b10',
        backgroundImage:
          'radial-gradient(circle at 50% 42%, #202630 0%, #11161d 48%, #080b10 100%)',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 ${-track.tileSize} ${trackWidth} ${trackHeight + track.tileSize * 2}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${track.name} race track`}
      >
        <g>
          {roadTiles.map((tile, i) => (
            <TrackTile
              key={`road-${i}`}
              asset={tile.asset}
              col={tile.col}
              row={tile.row}
              rotation={tile.rotation}
              tileSize={track.tileSize}
              baseUrl={baseUrl}
            />
          ))}

          {!hasFinished ? (
            <image
              href={`${baseUrl}start_line_mark.png`}
              x={startPos.x - startMarkW / 2}
              y={startPos.y - startMarkH / 2}
              width={startMarkW}
              height={startMarkH}
              opacity={0.95}
              transform={`rotate(${startRotation} ${startPos.x} ${startPos.y})`}
            />
          ) : (
            <image
              href={`${baseUrl}finish_line_mark.png`}
              x={finishPos.x - finishMarkW / 2}
              y={finishPos.y - finishMarkH / 2}
              width={finishMarkW}
              height={finishMarkH}
              opacity={0.95}
              transform={`rotate(${finishRotation} ${finishPos.x} ${finishPos.y})`}
            />
          )}

          {participants.map((p, i) => {
            const lane = getTrackLaneOffset(i, participants.length, track.tileSize);
            const pos = applyLaneOffset(progressOnTrack(track, p.progress * laps), lane);
            return (
              <CarSprite
                key={p.id}
                carIndex={i}
                x={pos.x}
                y={pos.y}
                angleRad={pos.angle}
                isGhost={p.isGhost}
                isMe={p.id === myParticipantId}
                rank={p.rank}
                baseUrl={baseUrl}
                tileSize={track.tileSize}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
