import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FlightLookup } from '@/data/types';

const STORAGE_KEY = 'stillgate.savedFlights';
const LEGACY_STORAGE_KEY = 'stillgate.savedFlight';

export interface SavedFlight {
  flightNumber: string;
  /** YYYY-MM-DD. Required alongside the flight number to find a specific flight. */
  date: string;
  originCode?: string;
  lookup?: FlightLookup;
}

function isSavedFlight(value: unknown): value is SavedFlight {
  if (!value || typeof value !== 'object') return false;
  const flight = value as Partial<SavedFlight>;
  return typeof flight.flightNumber === 'string' && typeof flight.date === 'string';
}

function normalizeFlight(flight: SavedFlight): SavedFlight {
  return { ...flight, originCode: flight.originCode ?? flight.lookup?.origin.code };
}

export async function getSavedFlights(): Promise<SavedFlight[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as unknown;
      return Array.isArray(saved) ? saved.filter(isSavedFlight).map(normalizeFlight) : [];
    } catch {
      return [];
    }
  }

  // Migrate installs that stored one flight before layover support.
  const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return [];
  try {
    const legacy = JSON.parse(legacyRaw) as unknown;
    if (!isSavedFlight(legacy)) return [];
    const migrated = [normalizeFlight(legacy)];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
  } catch {
    return [];
  }
}

/** Backwards-compatible accessor for the first leg used by the map and guide. */
export async function getSavedFlight(): Promise<SavedFlight | null> {
  return (await getSavedFlights())[0] ?? null;
}

export async function saveFlight(flight: SavedFlight): Promise<void> {
  const flights = await getSavedFlights();
  const normalized = normalizeFlight(flight);
  const index = flights.findIndex((saved) =>
    saved.flightNumber.toUpperCase() === normalized.flightNumber.toUpperCase()
    && saved.date === normalized.date
    && saved.originCode?.toUpperCase() === normalized.originCode?.toUpperCase(),
  );
  if (index === -1) flights.push(normalized);
  else flights[index] = normalized;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(flights));
}

export async function clearSavedFlight(flightToRemove?: SavedFlight): Promise<void> {
  if (flightToRemove) {
    const flights = await getSavedFlights();
    const remaining = flights.filter((saved) => !(
      saved.flightNumber.toUpperCase() === flightToRemove.flightNumber.toUpperCase()
      && saved.date === flightToRemove.date
      && saved.originCode?.toUpperCase() === flightToRemove.originCode?.toUpperCase()
    ));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    return;
  }
  await AsyncStorage.multiRemove([STORAGE_KEY, LEGACY_STORAGE_KEY]);
}
