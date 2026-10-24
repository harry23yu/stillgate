// Shared Stillgate types. One template per airport: adding an airport means filling this in.
// Dates are ISO 8601 strings (YYYY-MM-DD) so they serialize cleanly through JSON and the backend.

export type VerifiedStatus = "verified" | "basic";
export type Confidence = "low" | "medium" | "high";

export interface Source {
  label: string;
  url: string;
}

export interface Airport {
  code: string; // IATA, e.g. "SFO"
  name: string;
  terminals: Terminal[];
  lastVerified: string;
  verifiedStatus: VerifiedStatus; // "basic" = basic info only tier
  quietSpots: QuietSpot[];
  loudZones: LoudZone[];
  services: Service[];
  walkthrough: WalkthroughStep[];
  links: ExternalLink[];
}

export interface Terminal {
  id: string; // e.g. "T1"
  name: string; // e.g. "Harvey Milk Terminal 1"
  gates: string[]; // e.g. ["C1", "C2"]
}

export interface Location {
  terminalId: string;
  nearGate?: string; // landmark/gate picker; we do not use live indoor positioning
  postSecurity: boolean;
  description?: string;
  lat?: number;
  lng?: number;
}

export type QuietSpotKind = "sensory_room" | "quiet_area" | "other";

export interface QuietSpot {
  id: string;
  kind: QuietSpotKind;
  name: string;
  location: Location;
  hours?: string; // free text, e.g. "5:00 a.m. to 11:00 p.m."
  notes?: string;
  verifiedDate: string;
  source: Source;
}

export type LoudZoneType =
  | "food_court"
  | "security_checkpoint"
  | "train_station"
  | "announcement_area"
  | "other";

export interface LoudZone {
  id: string;
  type: LoudZoneType;
  name: string;
  location: Location;
  // Always shown to users as "typically busy (estimate)".
  estimatedBusyTimes?: string;
  confidence: Confidence;
}

export type ServiceKind =
  | "tsa_cares_meeting_point"
  | "special_assistance_desk"
  | "family_accessible_lane"
  | "restroom"
  | "water"
  | "low_stimulation_food";

export interface Service {
  id: string;
  kind: ServiceKind;
  name: string;
  location: Location;
  hours?: string;
  notes?: string;
  verifiedDate: string;
  source: Source;
}

export type WalkthroughPhase = "check_in" | "security" | "boarding";

export interface WalkthroughStep {
  phase: WalkthroughPhase;
  order: number;
  text: string;
  // Extra detail shown only when the profile's detailLevel is "detailed" (first-time flyers).
  detailedText?: string;
  photoUrl?: string;
  verifiedDate: string;
  source: Source;
}

export interface ExternalLink {
  label: string;
  url: string;
  provider: "magnuscards" | "kulturecity" | "airport" | "tsa" | "other";
}

// Lives on-device only. Defined here so mobile and backend (e.g. gate-change rules)
// agree on the shape; the backend must never persist it.
export type Level = "low" | "medium" | "high";

export interface SensoryProfile {
  noise: Level; // how much noise bothers you
  crowds: Level;
  lighting: Level;
  whatHelps: string[]; // e.g. ["headphones", "quiet room", "step-by-step"]
  firstFlight: boolean;
  detailLevel: "brief" | "detailed";
}
