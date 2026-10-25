/**
 * Internal data contract for Stillgate. These shapes are our own, not SFO's
 * API response formats. See CLAUDE.md §5.
 */

export type PlaceType = 'quiet' | 'loud' | 'service' | 'food';
export type AirportCode = 'SFO' | 'CHS';

export type Confidence = 'low' | 'medium' | 'high';

export interface Place {
  id: string;
  type: PlaceType;
  name: string;
  terminal: string;
  /** Fraction 0–1 across the floor plan image, left to right. */
  x: number;
  /** Fraction 0–1 across the floor plan image, top to bottom. */
  y: number;
  hours: string;
  notes: string;
  confidence: Confidence;
  lastVerified: string;
  source: string;
}

export interface Terminal {
  id: string;
  name: string;
  floorPlanImage: string | null;
  boardingAreas: string[];
}

export interface Airport {
  code: string;
  name: string;
  verified: boolean;
  lastVerified: string;
  terminals: Terminal[];
  places: Place[];
  /** Gate -> boarding area id, used by the quiet-spot rule. */
  gateAreas: Record<string, string>;
  /** Boarding area id -> approximate schematic position, used to find the nearest quiet spot. */
  areaCenters: Record<string, { x: number; y: number }>;
  /** Security checkpoint lanes with live wait estimates, used by the arrival-time and checkpoint rules. */
  checkpointLanes: CheckpointWait[];
}

export type FlightStatus = 'on-time' | 'delayed' | 'boarding' | 'gate-changed' | 'cancelled' | 'unknown';

export interface AirportRef {
  code: string;
  city: string;
}

export interface FlightLookup {
  flight: string;
  status: FlightStatus;
  scheduledDeparture: string;
  gate: string | null;
  terminal: string | null;
  retrievedAt: string;
  /** True for local demonstration data; backend results will set this false. */
  isRecorded: boolean;
  origin: AirportRef;
  destination: AirportRef | null;
}

export interface CheckpointWait {
  checkpoint: string;
  waitMinutes: number;
  queueStatus: 'low' | 'moderate' | 'high';
  retrievedAt: string;
}

export type DetailLevel = 'brief' | 'detailed';

// Field names match shared/schema.ts SensoryProfile so the profile serializes
// straight into the Convex gate-change queries (nearestQuietSpots / gateChangeSteps)
// without translation. Keep these in sync with that shape.
export interface Profile {
  noise: 'low' | 'medium' | 'high' | null;
  crowds: 'low' | 'medium' | 'high' | null;
  lighting: 'low' | 'medium' | 'high' | null;
  whatHelps: string[];
  firstFlight: boolean;
  detailLevel: DetailLevel;
}
