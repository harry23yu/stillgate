import type { Airport, CheckpointWait, FlightLookup, Place, Profile } from '@/data/types';
import type { TripDetails } from '@/data/trip-details';
import { estimateWalkMinutes, getNearestPlace, YOU_POSITION } from '@/data/client';

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

export function recommendPostSecurityOptions(
  airport: Airport,
  flight: FlightLookup,
  now: Date,
): Itinerary['postSecurity'] {
  const gateAreaId = airport.gateAreas[flight.gate];
  const gateCenter = gateAreaId ? airport.areaCenters[gateAreaId] : YOU_POSITION;

  const departure = new Date(flight.scheduledDeparture);
  const minutesUntilBoarding =
    Math.round((departure.getTime() - now.getTime()) / 60_000) - GATE_ARRIVAL_BUFFER_MINUTES;

  function buildOption(type: 'quiet' | 'food'): { place: Place; canMakeIt: boolean } | null {
    const place = getNearestPlace(airport, flight.gate, type);
    if (!place) return null;
    const roundTripMinutes = estimateWalkMinutes(gateCenter, place) * 2;
    return { place, canMakeIt: roundTripMinutes <= minutesUntilBoarding };
  }

  return {
    minutesUntilBoarding,
    quietOption: buildOption('quiet'),
    foodOption: buildOption('food'),
  };
}

export function buildItinerary(
  airport: Airport,
  flight: FlightLookup,
  tripDetails: TripDetails,
  profile: Profile,
  now: Date,
): Itinerary {
  const recommendedCheckpoint = recommendCheckpointLane(airport.checkpointLanes, tripDetails);
  const recommendedArrival = recommendArrivalTime(flight, tripDetails, profile, recommendedCheckpoint);
  const postSecurity = recommendPostSecurityOptions(airport, flight, now);

  return {
    recommendedArrival,
    recommendedCheckpoint,
    tsaReminder: {
      text:
        'At the checkpoint, you may need to remove laptops and liquids from your bag and walk through a scanner — a pat-down is sometimes part of screening. A Sunflower lanyard can signal to staff that you may need extra patience, though it is not a fast pass.',
      links: [{ label: 'TSA Cares' }, { label: 'MagnusCards' }],
    },
    visaReminder: tripDetails.isInternational
      ? {
          text:
            "Check your destination's passport and visa requirements before you fly — rules vary by citizenship and destination and are not looked up in this demo.",
          links: [{ label: 'U.S. State Department travel advisories' }],
        }
      : null,
    postSecurity,
  };
}
