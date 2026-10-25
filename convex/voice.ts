import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, env, internalMutation, internalQuery } from './_generated/server';

/**
 * Text-to-speech through Cartesia. The Cartesia key stays on the backend; the
 * app only gets a Convex file-storage URL to play.
 *
 * Each clip is saved in file storage, keyed by its text and voice, so a step
 * that has been played once (for example while rehearsing the demo) plays
 * again without calling Cartesia, even if Cartesia is slow or down.
 *
 * Deployment env vars:
 *   CARTESIA_API_KEY   from play.cartesia.ai
 *   CARTESIA_VOICE_ID  the Calm Guide voice
 */

export type SpeakResponse =
  | { kind: 'audio'; uri: string }
  | { kind: 'unavailable'; message: string; configured: boolean };

const MODEL_ID = 'sonic-3.6';
const CARTESIA_VERSION = '2026-08-14';
/** Public action that spends Cartesia credits: keep inputs small. Guide steps are well under this. */
const MAX_TEXT_CHARS = 600;

export const speak = action({
  args: { text: v.string() },
  handler: async (ctx, args): Promise<SpeakResponse> => {
    const text = args.text.trim();
    if (!text || text.length > MAX_TEXT_CHARS) {
      return { kind: 'unavailable', configured: true, message: 'This step can’t be read aloud.' };
    }

    const voiceId = env.CARTESIA_VOICE_ID;
    if (!voiceId) return { kind: 'unavailable', configured: false, message: 'Voice is not set up yet.' };

    const key = await clipKey(voiceId, text);
    const cachedId: Id<'_storage'> | null = await ctx.runQuery(internal.voice.getClip, { key });
    const cachedUri = cachedId ? await ctx.storage.getUrl(cachedId) : null;
    if (cachedUri) return { kind: 'audio', uri: cachedUri };

    const apiKey = env.CARTESIA_API_KEY;
    if (!apiKey) return { kind: 'unavailable', configured: false, message: 'Voice is not set up yet.' };

    let audio: Blob;
    try {
      const response = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Cartesia-Version': CARTESIA_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: MODEL_ID,
          transcript: text,
          voice: { id: voiceId },
          language: 'en',
          // MP3 is about a tenth the size of WAV, so it downloads quickly on a phone.
          output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
        }),
      });
      if (!response.ok) {
        console.error(`Cartesia responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
        return { kind: 'unavailable', configured: true, message: 'Voice is temporarily unavailable.' };
      }
      audio = new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' });
    } catch (error) {
      console.error('Cartesia request failed', error);
      return { kind: 'unavailable', configured: true, message: 'Voice is temporarily unavailable.' };
    }

    const storedId = await ctx.storage.store(audio);
    const clipId: Id<'_storage'> = await ctx.runMutation(internal.voice.saveClip, { key, storageId: storedId });
    const uri = await ctx.storage.getUrl(clipId);
    if (!uri) return { kind: 'unavailable', configured: true, message: 'Voice is temporarily unavailable.' };
    return { kind: 'audio', uri };
  },
});

export const getClip = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const clip = await ctx.db
      .query('voiceClips')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();
    return clip?.storageId ?? null;
  },
});

/** Returns the clip to play. If another request saved this text first, keeps that one and drops the duplicate. */
export const saveClip = internalMutation({
  args: { key: v.string(), storageId: v.id('_storage') },
  handler: async (ctx, { key, storageId }) => {
    const existing = await ctx.db
      .query('voiceClips')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();
    if (!existing) {
      await ctx.db.insert('voiceClips', { key, storageId });
      return storageId;
    }
    if (existing.storageId !== storageId && (await ctx.db.system.get('_storage', existing.storageId))) {
      await ctx.storage.delete(storageId);
      return existing.storageId;
    }
    // The saved file was deleted from storage; point at the new one.
    await ctx.db.patch(existing._id, { storageId });
    return storageId;
  },
});

/** SHA-256 of model, voice and text: the same sentence in the same voice reuses one file. */
async function clipKey(voiceId: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${MODEL_ID}|${voiceId}|${text}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
