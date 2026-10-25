import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stillgate.tripDetails';

export interface TripDetails {
  checkingBag: boolean;
  hasBoardingPass: boolean;
  hasPreCheck: boolean;
  isInternational: boolean;
}

export const defaultTripDetails: TripDetails = {
  checkingBag: false,
  hasBoardingPass: false,
  hasPreCheck: false,
  isInternational: false,
};

export async function getTripDetails(): Promise<TripDetails> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultTripDetails;

  try {
    return { ...defaultTripDetails, ...JSON.parse(raw) };
  } catch {
    return defaultTripDetails;
  }
}

export async function saveTripDetails(details: TripDetails): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(details));
}
