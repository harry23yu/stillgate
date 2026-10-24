import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Profile } from '@/data/types';

const STORAGE_KEY = 'stillgate.profile';

export const defaultProfile: Profile = {
  noise: null,
  crowds: null,
  lights: null,
  helps: [],
  firstFlight: false,
  detailLevel: 'standard',
};

export async function getProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultProfile;

  try {
    return { ...defaultProfile, ...JSON.parse(raw) };
  } catch {
    return defaultProfile;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
