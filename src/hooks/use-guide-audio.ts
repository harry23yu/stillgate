import { useCallback, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { cartesiaGuideAudioProvider, type GuideNarrationRequest } from '@/data/guide-audio-provider';

export type GuideAudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'finished' | 'error';

export function useGuideAudio() {
  const player = useAudioPlayer(null, { downloadFirst: true });
  const playerStatus = useAudioPlayerStatus(player);
  const [state, setState] = useState<GuideAudioState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadedStepId, setLoadedStepId] = useState<string | null>(null);

  const visibleState: GuideAudioState = playerStatus.error
    ? 'error'
    : playerStatus.didJustFinish
      ? 'finished'
      : playerStatus.playing
        ? 'playing'
        : state;
  const visibleError = playerStatus.error
    ? 'We couldn’t play this guide. Try again when audio is available.'
    : error;

  const stop = useCallback(() => {
    player.pause();
    if (playerStatus.isLoaded) void player.seekTo(0);
    setState('idle');
    setError(null);
  }, [player, playerStatus.isLoaded]);

  const toggle = useCallback(async (request: GuideNarrationRequest) => {
    setError(null);
    if (playerStatus.playing && loadedStepId === request.stepId) {
      player.pause();
      setState('paused');
      return;
    }

    if (loadedStepId === request.stepId && playerStatus.isLoaded) {
      if (playerStatus.didJustFinish) void player.seekTo(0);
      player.play();
      setState('playing');
      return;
    }

    setState('loading');
    try {
      const result = await cartesiaGuideAudioProvider.synthesize(request);
      if (result.kind === 'unavailable') {
        setError(result.message);
        setState('error');
        return;
      }
      player.replace({ uri: result.uri, name: `Calm Guide · ${request.stepId}` });
      setLoadedStepId(request.stepId);
      player.play();
      setState('playing');
    } catch {
      setError('We couldn’t prepare audio for this step. Please try again.');
      setState('error');
    }
  }, [loadedStepId, player, playerStatus.didJustFinish, playerStatus.isLoaded, playerStatus.playing]);

  return { state: visibleState, error: visibleError, toggle, stop };
}
