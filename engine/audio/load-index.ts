/**
 * Read sounds.txt from a caller-supplied byte source. The source is
 * the player's install. This module does not open a path itself.
 */
import { parseSounds, type SoundIndex } from '@sfc2js/formats';

export const SOUND_INDEX_PATHS = ['assets/sounds/sounds.txt', 'Assets/Sounds/sounds.txt'] as const;

export async function readSoundIndex(
  read: (path: string) => Promise<Uint8Array | null>,
): Promise<{ index: SoundIndex; file: string } | null> {
  for (const file of SOUND_INDEX_PATHS) {
    const bytes = await read(file);
    if (!bytes || bytes.length === 0) continue;
    const parsed = parseSounds(bytes, { file });
    if (parsed.diagnostics.some((diagnostic) => diagnostic.code === 'emptyFile')) continue;
    if (parsed.data.entries.length === 0 && parsed.data.classes.length === 0) continue;
    return { index: parsed.data, file };
  }
  return null;
}
