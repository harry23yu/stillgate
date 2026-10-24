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

/** The future Convex/Cartesia adapter implements this mobile-facing contract. */
export interface GuideAudioProvider {
  synthesize(request: GuideNarrationRequest): Promise<GuideAudioResult>;
}

/** Keep the app honest until the Cartesia backend is connected. */
export const cartesiaGuideAudioProvider: GuideAudioProvider = {
  async synthesize() {
    return {
      kind: 'unavailable',
      message: 'Cartesia audio is ready to connect, but the audio service is not connected yet.',
    };
  },
};
