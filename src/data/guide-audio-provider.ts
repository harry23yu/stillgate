import { api } from '../../convex/_generated/api';
import { convex } from '@/lib/convex';

export type GuideStepId = 'trip' | 'arrival' | 'checkpoint' | 'security' | 'post-security';

export interface GuideNarrationRequest {
  stepId: GuideStepId;
  transcript: string;
  flight: {
    flightNumber: string;
    departureAirport: string;
    destinationAirport: string | null;
    gate: string | null;
    departureTime: string;
  };
  leaveByTime: string | null;
}

export type GuideAudioResult =
  | { kind: 'audio'; uri: string; expiresAt?: string }
  | { kind: 'unavailable'; message: string };

/** Mobile-facing contract; the Convex/Cartesia adapter below implements it. */
export interface GuideAudioProvider {
  synthesize(request: GuideNarrationRequest): Promise<GuideAudioResult>;
}

/** A new step waits for Cartesia (a few seconds); a step played before comes from Convex file storage. */
const SPEAK_TIMEOUT_MS = 20_000;

/**
 * Cartesia voice through the Convex `voice.speak` action. The Cartesia key
 * stays on the backend, never on the phone.
 */
export const cartesiaGuideAudioProvider: GuideAudioProvider = {
  async synthesize({ transcript }) {
    if (!convex) return { kind: 'unavailable', message: 'Voice needs the Stillgate backend, which is not connected.' };
    try {
      const result = await Promise.race([
        convex.action(api.voice.speak, { text: transcript }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out')), SPEAK_TIMEOUT_MS)),
      ]);
      return result.kind === 'audio' ? { kind: 'audio', uri: result.uri } : { kind: 'unavailable', message: result.message };
    } catch {
      return { kind: 'unavailable', message: 'Voice is temporarily unavailable.' };
    }
  },
};
