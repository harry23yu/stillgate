import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AirportCode, Place } from '@/data/types';

/**
 * Last reviewed places fetched for each airport, so the map and gate-change
 * help still work on airport Wi-Fi that drops out. Only backend places are
 * stored; bundled map data always comes from the app itself.
 */

const keyFor = (code: AirportCode) => `stillgate.airport.${code}`;

export interface CachedAirportPlaces {
  places: Place[];
  fetchedAt: string;
}

export async function readCachedAirport(code: AirportCode): Promise<CachedAirportPlaces | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(code));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedAirportPlaces;
    if (!Array.isArray(cached.places) || typeof cached.fetchedAt !== 'string') return null;
    return cached;
  } catch {
    return null;
  }
}

export async function writeCachedAirport(code: AirportCode, entry: CachedAirportPlaces): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(code), JSON.stringify(entry));
  } catch {
    // A full disk shouldn't break the screen that triggered the fetch.
  }
}
