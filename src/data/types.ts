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

export type FlightStatus = 'on-time' | 'delayed' | 'boarding' | 'gate-changed' | 'cancelled';

export interface AirportRef {
  code: string;
  city: string;
}

export interface FlightLookup {
  flight: string;
  status: FlightStatus;
  scheduledDeparture: string;
  gate: string;
  terminal: string;
  retrievedAt: string;
  isRecorded: boolean;
  /**
   * Not in the real SFO API's documented fields (CLAUDE.md §11) — a
   * front-end convenience for the dashboard route display. Confirm with the
   * backend teammate before wiring to the real lookup.
   */
  origin: AirportRef;
  destination: AirportRef;
}

export interface CheckpointWait {
  checkpoint: string;
  waitMinutes: number;
  queueStatus: 'low' | 'moderate' | 'high';
  retrievedAt: string;
}

export type DetailLevel = 'standard' | 'detailed';

export interface Profile {
  noise: 'low' | 'medium' | 'high' | null;
  crowds: 'low' | 'medium' | 'high' | null;
  lights: 'low' | 'medium' | 'high' | null;
  helps: string[];
  firstFlight: boolean;
  detailLevel: DetailLevel;
}
