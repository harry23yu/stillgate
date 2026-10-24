import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FlightLookup } from '@/data/types';

const STORAGE_KEY = 'stillgate.savedFlight';

export interface SavedFlight {
  flightNumber: string;
  /** YYYY-MM-DD. Required alongside the flight number to find a specific flight. */
  date: string;
  /** Present for saved results; remains optional to read existing installs. */
  originCode?: string;
  lookup?: FlightLookup;
}

export async function getSavedFlight(): Promise<SavedFlight | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const saved = JSON.parse(raw) as SavedFlight;
    if (typeof saved.flightNumber !== 'string' || typeof saved.date !== 'string') return null;
    return {
      ...saved,
      originCode: saved.originCode ?? saved.lookup?.origin.code,
    };
  } catch {
    return null;
  }
}

export async function saveFlight(flight: SavedFlight): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(flight));
}

export async function clearSavedFlight(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
