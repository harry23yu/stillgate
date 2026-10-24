import type { Airport, CheckpointWait, FlightLookup, Place, Profile } from '@/data/types';
import type { TripDetails } from '@/data/trip-details';

/**
 * The whole computed trip plan for Calm Guide. Built once per flight by
 * buildItinerary() from verified/estimate-labeled inputs only — no model
 * decides any of this. See CLAUDE.md §3 and
 * docs/superpowers/specs/2026-10-23-pre-security-planning-design.md.
 */
export interface Itinerary {
  recommendedArrival: { time: string; bufferMinutes: number };
  recommendedCheckpoint: CheckpointWait | null;
  tsaReminder: { text: string; links: { label: string }[] };
  visaReminder: { text: string; links: { label: string }[] } | null;
  postSecurity: {
    minutesUntilBoarding: number;
    quietOption: { place: Place; canMakeIt: boolean } | null;
    foodOption: { place: Place; canMakeIt: boolean } | null;
  };
}

const DOMESTIC_BASE_MINUTES = 120;
const INTERNATIONAL_BASE_MINUTES = 180;
const CHECKED_BAG_MINUTES = 30;
const PRECHECK_DISCOUNT_MINUTES = 15;
const BOARDING_PASS_DISCOUNT_MINUTES = 10;
const FIRST_FLIGHT_MINUTES = 20;
export const GATE_ARRIVAL_BUFFER_MINUTES = 10;

export function recommendCheckpointLane(
  checkpointLanes: CheckpointWait[],
  tripDetails: TripDetails,
): CheckpointWait | null {
  if (checkpointLanes.length === 0) return null;

  const preferred = tripDetails.hasPreCheck
    ? checkpointLanes.find(
        (lane) => lane.checkpoint.includes('PreCheck') || lane.checkpoint.includes('CLEAR'),
      )
    : checkpointLanes.find((lane) => lane.checkpoint.includes('General'));

  return preferred ?? checkpointLanes[0];
}

export function recommendArrivalTime(
  flight: FlightLookup,
  tripDetails: TripDetails,
  profile: Profile,
  checkpoint: CheckpointWait | null,
): { time: string; bufferMinutes: number } {
  let bufferMinutes = tripDetails.isInternational ? INTERNATIONAL_BASE_MINUTES : DOMESTIC_BASE_MINUTES;
  if (tripDetails.checkingBag) bufferMinutes += CHECKED_BAG_MINUTES;
  if (tripDetails.hasPreCheck) bufferMinutes -= PRECHECK_DISCOUNT_MINUTES;
  if (tripDetails.hasBoardingPass) bufferMinutes -= BOARDING_PASS_DISCOUNT_MINUTES;
  if (profile.firstFlight) bufferMinutes += FIRST_FLIGHT_MINUTES;
  if (checkpoint) bufferMinutes += checkpoint.waitMinutes;

  const departure = new Date(flight.scheduledDeparture);
  const arrival = new Date(departure.getTime() - bufferMinutes * 60_000);

  return { time: arrival.toISOString(), bufferMinutes };
}
