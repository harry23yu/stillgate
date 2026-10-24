import type { AirportCode, Place } from '@/data/types';

export type AirportMapFocus = 'all' | 't1' | 't2' | 't3' | 'intl' | 'concourse-a' | 'concourse-b';

export type MapPoint = { x: number; y: number };

export const SFO_MAP_IMAGE_SIZE = { width: 1678, height: 1603 };
export const CHS_MAP_IMAGE_SIZE = { width: 2300, height: 1196 };
export const MAP_IMAGE_SIZE: Record<AirportCode, { width: number; height: number }> = {
  SFO: SFO_MAP_IMAGE_SIZE,
  CHS: CHS_MAP_IMAGE_SIZE,
};

const CHS_GATE_POSITIONS: Record<string, { x: number; y: number }> = {
  A1: { x: 0.64, y: 0.42 },
  A2: { x: 0.59, y: 0.35 },
  A2A: { x: 0.59, y: 0.39 },
  A3: { x: 0.66, y: 0.41 },
  A4: { x: 0.62, y: 0.27 },
  A5: { x: 0.76, y: 0.31 },
  A6: { x: 0.71, y: 0.29 },
  A7: { x: 0.75, y: 0.33 },
  B1: { x: 0.40, y: 0.33 },
  B2: { x: 0.31, y: 0.40 },
  B3: { x: 0.36, y: 0.28 },
  B4: { x: 0.30, y: 0.33 },
  B5: { x: 0.37, y: 0.17 },
  B6: { x: 0.27, y: 0.22 },
  B7: { x: 0.32, y: 0.12 },
  B8: { x: 0.26, y: 0.17 },
  B9: { x: 0.30, y: 0.10 },
  B10: { x: 0.27, y: 0.12 },
};

export function focusForGate(gate: string, airportCode: AirportCode = 'SFO'): AirportMapFocus | null {
  const prefix = gate.trim().charAt(0).toUpperCase();
  if (airportCode === 'CHS') {
    if (prefix === 'A') return 'concourse-a';
    if (prefix === 'B') return 'concourse-b';
    return null;
  }
  if (prefix === 'B' || prefix === 'C') return 't1';
  if (prefix === 'D') return 't2';
  if (prefix === 'E' || prefix === 'F') return 't3';
  if (prefix === 'A' || prefix === 'G') return 'intl';
  return null;
}

export function mapPointForPlace(place: Place, airportCode: AirportCode = 'SFO'): MapPoint {
  if (airportCode === 'CHS') {
    return {
      x: place.x * CHS_MAP_IMAGE_SIZE.width,
      y: place.y * CHS_MAP_IMAGE_SIZE.height,
    };
  }

  const x = place.x * 4050;
  const y = place.y * 420;

  switch (place.terminal) {
    case 't1': {
      if (y < 205 && x >= 160) {
        const progress = clamp((x - 160) / 310);
        return { x: 1010 + progress * 260, y: 470 - progress * 190 };
      }
      if (y > 215) {
        const progress = clamp((x - 200) / 720);
        return { x: 1040 + progress * 380, y: 590 + progress * 260 };
      }
      return { x: 970, y: 530 };
    }
    case 't2': {
      const progress = clamp((x - 1060) / 540);
      return { x: 810 + progress * 24, y: 330 - progress * 220 };
    }
    case 't3': {
      if (y < 205) {
        const progress = clamp((x - 1960) / 190);
        return { x: 625 - progress * 180, y: 410 - progress * 150 };
      }
      const progress = clamp((x - 1960) / 540);
      return { x: 620 - progress * 300, y: 585 + progress * 220 };
    }
    case 'intl-g': {
      const progress = clamp((x - 2860) / 340);
      return { x: 750 - progress * 350, y: 930 + progress * 180 };
    }
    case 'intl-a': {
      const progress = clamp((x - 3760) / 190);
      return { x: 920 + progress * 300, y: 930 + progress * 180 };
    }
    default:
      return { x: 820, y: 620 };
  }
}

export function mapPointForGate(gate: string, airportCode: AirportCode = 'SFO'): MapPoint | null {
  if (airportCode === 'CHS') {
    const position = CHS_GATE_POSITIONS[gate.trim().toUpperCase()];
    return position
      ? { x: position.x * CHS_MAP_IMAGE_SIZE.width, y: position.y * CHS_MAP_IMAGE_SIZE.height }
      : null;
  }
  const prefix = gate.trim().charAt(0).toUpperCase();
  const number = Number(gate.trim().slice(1));
  if (!number) return null;

  if (prefix === 'C') {
    const progress = clamp((number - 2) / 9);
    return { x: 1010 + progress * 260, y: 470 - progress * 190 };
  }
  if (prefix === 'B') {
    const progress = clamp((number - 6) / 21);
    return { x: 1040 + progress * 380, y: 590 + progress * 260 };
  }
  if (prefix === 'D') {
    const progress = clamp((number - 1) / 17);
    return { x: 810 + progress * 24, y: 330 - progress * 220 };
  }
  if (prefix === 'E') {
    const progress = clamp((number - 1) / 12);
    return { x: 625 - progress * 180, y: 410 - progress * 150 };
  }
  if (prefix === 'F') {
    const progress = clamp((number - 1) / 21);
    return { x: 620 - progress * 300, y: 585 + progress * 220 };
  }
  if (prefix === 'G') {
    const progress = clamp((number - 1) / 13);
    return { x: 750 - progress * 350, y: 930 + progress * 180 };
  }
  if (prefix === 'A') {
    const progress = clamp((number - 1) / 14);
    return { x: 920 + progress * 300, y: 930 + progress * 180 };
  }
  return null;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
