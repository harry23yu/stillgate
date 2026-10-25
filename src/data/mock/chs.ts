import type { Airport, Place, PlaceType } from '@/data/types';

/**
 * Charleston example built from the overview image supplied for this project.
 * The overview is supplied by the project; place pins are demo placeholders
 * for exercising the map filters and are not verified airport locations.
 */
function placeholderPlace(
  id: string,
  type: PlaceType,
  name: string,
  terminal: 'concourse-a' | 'concourse-b',
  x: number,
  y: number,
): Place {
  return {
    id,
    type,
    name,
    terminal,
    x,
    y,
    hours: 'Unknown',
    notes:
      type === 'loud'
        ? 'Demo placeholder only. This is not a measured noise level or a verified busy area.'
        : 'Demo placeholder only. This location has not been verified at Charleston International Airport.',
    confidence: 'low',
    lastVerified: 'unknown',
    source: 'demo placeholder',
  };
}

export const chsAirport: Airport = {
  code: 'CHS',
  name: 'Charleston International Airport',
  verified: false,
  lastVerified: 'unknown',
  terminals: [
    {
      id: 'concourse-a',
      name: 'Concourse A',
      floorPlanImage: null,
      boardingAreas: ['A'],
    },
    {
      id: 'concourse-b',
      name: 'Concourse B',
      floorPlanImage: null,
      boardingAreas: ['B'],
    },
  ],
  places: [
    placeholderPlace('chs-quiet-a', 'quiet', 'Quiet seating · Concourse A', 'concourse-a', 0.69, 0.38),
    placeholderPlace('chs-quiet-b', 'quiet', 'Quiet seating · Concourse B', 'concourse-b', 0.31, 0.23),
    placeholderPlace('chs-security', 'loud', 'Security screening', 'concourse-a', 0.65, 0.58),
    placeholderPlace('chs-central-hall', 'loud', 'Central hall', 'concourse-a', 0.46, 0.58),
    placeholderPlace('chs-info', 'service', 'Information counter', 'concourse-a', 0.46, 0.69),
    placeholderPlace('chs-baggage', 'service', 'Baggage claim', 'concourse-b', 0.39, 0.70),
    placeholderPlace('chs-ticketing', 'service', 'Ticketing / check-in', 'concourse-a', 0.70, 0.68),
    placeholderPlace('chs-ground-transport', 'service', 'Ground transport', 'concourse-a', 0.54, 0.88),
    placeholderPlace('chs-food-hall', 'food', 'Food vendor · Central Hall', 'concourse-a', 0.56, 0.65),
    placeholderPlace('chs-food-a', 'food', 'Food vendor · Concourse A', 'concourse-a', 0.74, 0.40),
    placeholderPlace('chs-food-b', 'food', 'Food vendor · Concourse B', 'concourse-b', 0.34, 0.29),
  ],
  gateAreas: {},
  areaCenters: {},
  checkpointLanes: [],
};
