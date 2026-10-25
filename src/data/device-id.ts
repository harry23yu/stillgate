import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stillgate.deviceId';

let cached: Promise<string> | null = null;

/**
 * Random, anonymous id for this install, sent with traveler reports so one
 * device counts once per place per day (convex/reports.ts). Not tied to the
 * person and reset by clearing app data.
 */
export function getDeviceId(): Promise<string> {
  cached ??= (async () => {
    const existing = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (existing) return existing;
    const id = randomId();
    await AsyncStorage.setItem(STORAGE_KEY, id).catch(() => undefined);
    return id;
  })();
  return cached;
}

function randomId(): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  if (uuid) return uuid;
  // Hermes may lack crypto.randomUUID; uniqueness, not secrecy, is what matters here.
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
