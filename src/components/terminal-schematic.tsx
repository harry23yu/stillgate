import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';

type TerminalSchematicProps = { style?: StyleProp<ViewStyle> };

const VIEWBOX_W = 4050;
const VIEWBOX_H = 420;
const SPINE_Y = 210;
const SPINE_HEIGHT = 30; // y 195–225
const HUB_W = 110;
const HUB_H = 100;
const HUB_RADIUS = 16;
const PIER_WIDTH = 70;
const PIER_HALF_WIDTH = 35;
const PIER_BORDER_WIDTH = 4;
const TICK_LENGTH = 16;
const TICK_LABEL_GAP = 8;
const T_START = 0.1;
const T_END = 0.96; // within spec's 0.08–0.12 / 0.95–0.97 allowance

const HUBS = [
  { id: 't1', cx: 160, cy: 210 },
  { id: 't2', cx: 1060, cy: 210 },
  { id: 't3', cx: 1960, cy: 210 },
  { id: 'intl-g', cx: 2860, cy: 210 },
  { id: 'intl-a', cx: 3760, cy: 210 },
] as const;

type Pier = {
  id: string;
  from: readonly [number, number];
  to: readonly [number, number];
  gatePrefix: string;
  firstGate: number;
  lastGate: number;
  labeledGates: number[];
};

const PIERS: Pier[] = [
  { id: 'C', from: [200, 180], to: [470, 70], gatePrefix: 'C', firstGate: 2, lastGate: 11, labeledGates: [2, 5, 8, 11] },
  { id: 'B', from: [200, 240], to: [920, 380], gatePrefix: 'B', firstGate: 6, lastGate: 27, labeledGates: [6, 9, 12, 15, 18, 21, 24, 27] },
  { id: 'D', from: [1100, 220], to: [1600, 350], gatePrefix: 'D', firstGate: 1, lastGate: 18, labeledGates: [1, 4, 7, 10, 13, 16, 18] },
  { id: 'E', from: [2000, 180], to: [2150, 90], gatePrefix: 'E', firstGate: 1, lastGate: 13, labeledGates: [1, 4, 7, 10, 13] },
  { id: 'F', from: [2000, 240], to: [2500, 380], gatePrefix: 'F', firstGate: 1, lastGate: 22, labeledGates: [1, 4, 7, 10, 13, 16, 19, 22] },
  { id: 'G', from: [2900, 240], to: [3200, 350], gatePrefix: 'G', firstGate: 1, lastGate: 14, labeledGates: [1, 4, 7, 10, 13, 14] },
  { id: 'A', from: [3800, 180], to: [3900, 90], gatePrefix: 'A', firstGate: 1, lastGate: 15, labeledGates: [1, 4, 7, 10, 13, 15] },
];

function pointAt(pier: Pier, t: number) {
  const [x0, y0] = pier.from;
  const [x1, y1] = pier.to;
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
}

function unitNormal(pier: Pier) {
  const [x0, y0] = pier.from;
  const [x1, y1] = pier.to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  return { nx: -dy / len, ny: dx / len };
}

// Ticks go on the edge farther from the horizontal spine (y=210) — resolve
// the sign at runtime rather than hand-picking it per pier.
function outwardNormal(pier: Pier, point: { x: number; y: number }) {
  const { nx, ny } = unitNormal(pier);
  const sideAY = point.y + ny * PIER_HALF_WIDTH;
  const sideBY = point.y - ny * PIER_HALF_WIDTH;
  return Math.abs(sideAY - SPINE_Y) >= Math.abs(sideBY - SPINE_Y) ? { nx, ny } : { nx: -nx, ny: -ny };
}

function tForGateIndex(pier: Pier, i: number, gateCount: number) {
  return T_START + (i * (T_END - T_START)) / (gateCount - 1);
}

/**
 * Pure decorative background art for the SFO Terminal 1 map screen: a
 * horizontal "spine" connecting five security-checkpoint hubs, with seven
 * concourse "piers" branching off at angles, gate tick marks, and a handful
 * of labeled gate numbers. No data props, no interactivity — later tasks
 * layer interactive pin markers on top inside the same canvas.
 */
export function TerminalSchematic({ style }: TerminalSchematicProps) {
  const pierLines = PIERS.flatMap((pier) => [
    <Line
      key={`pier-border-${pier.id}`}
      x1={pier.from[0]}
      y1={pier.from[1]}
      x2={pier.to[0]}
      y2={pier.to[1]}
      stroke={Colors.border}
      strokeWidth={PIER_WIDTH + PIER_BORDER_WIDTH * 2}
      strokeLinecap="square"
    />,
    <Line
      key={`pier-fill-${pier.id}`}
      x1={pier.from[0]}
      y1={pier.from[1]}
      x2={pier.to[0]}
      y2={pier.to[1]}
      stroke={Colors.neutralFillAlt}
      strokeWidth={PIER_WIDTH}
      strokeLinecap="square"
    />,
  ]);

  const gateMarks = PIERS.flatMap((pier) => {
    const gateCount = pier.lastGate - pier.firstGate + 1;
    return Array.from({ length: gateCount }, (_, i) => {
      const gateNumber = pier.firstGate + i;
      const center = pointAt(pier, tForGateIndex(pier, i, gateCount));
      const { nx, ny } = outwardNormal(pier, center);
      const edgeX = center.x + nx * PIER_HALF_WIDTH;
      const edgeY = center.y + ny * PIER_HALF_WIDTH;
      const tickEndX = edgeX + nx * TICK_LENGTH;
      const tickEndY = edgeY + ny * TICK_LENGTH;

      const tick = (
        <Line
          key={`tick-${pier.id}-${gateNumber}`}
          x1={edgeX}
          y1={edgeY}
          x2={tickEndX}
          y2={tickEndY}
          stroke={Colors.border}
          strokeWidth={2}
        />
      );

      if (!pier.labeledGates.includes(gateNumber)) {
        return [tick];
      }

      const label = (
        <SvgText
          key={`label-${pier.id}-${gateNumber}`}
          x={tickEndX + nx * TICK_LABEL_GAP}
          y={tickEndY + ny * TICK_LABEL_GAP}
          textAnchor="middle"
          fontSize={18}
          fill={Colors.text}
        >
          {pier.gatePrefix}
          {gateNumber}
        </SvgText>
      );

      return [tick, label];
    }).flat();
  });

  return (
    <Svg
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      width="100%"
      height="100%"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      style={style}
    >
      <Rect
        x={160}
        y={195}
        width={3760 - 160}
        height={SPINE_HEIGHT}
        fill={Colors.neutralFillAlt}
        stroke={Colors.border}
        strokeWidth={2}
      />

      {pierLines}

      {HUBS.map((hub) => (
        <Rect
          key={`hub-${hub.id}`}
          x={hub.cx - HUB_W / 2}
          y={hub.cy - HUB_H / 2}
          width={HUB_W}
          height={HUB_H}
          rx={HUB_RADIUS}
          ry={HUB_RADIUS}
          fill={Colors.neutralFillAlt}
          stroke={Colors.border}
          strokeWidth={2}
        />
      ))}

      {gateMarks}

      <Line x1={3900} y1={90} x2={3950} y2={100} stroke={Colors.border} strokeWidth={2} strokeDasharray="6,6" />
      <SvgText x={3955} y={95} textAnchor="start" fontSize={14} fill={Colors.text}>
        Walkway loops back
      </SvgText>
      <SvgText x={3955} y={112} textAnchor="start" fontSize={14} fill={Colors.text}>
        to Terminal 1
      </SvgText>
    </Svg>
  );
}
