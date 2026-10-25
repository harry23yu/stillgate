import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Profile } from '@/data/types';

// Bumped to v2 when the profile fields were renamed (lights→lighting, helps→whatHelps,
// detailLevel 'standard'→'brief') so stale blobs with the old keys are ignored.
const STORAGE_KEY = 'stillgate.profile.v2';

export const defaultProfile: Profile = {
  noise: null,
  crowds: null,
  lighting: null,
  whatHelps: [],
  firstFlight: false,
  detailLevel: 'brief',
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
