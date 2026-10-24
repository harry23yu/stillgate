import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stillgate.savedFlight';

export interface SavedFlight {
  flightNumber: string;
  /** YYYY-MM-DD. Required alongside the flight number to find a specific flight. */
  date: string;
}

export async function getSavedFlight(): Promise<SavedFlight | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
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
