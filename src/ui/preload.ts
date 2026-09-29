import type { ChatEpisode } from '../data/types.ts';
import { HEROINES } from '../data/heroines.ts';
import { portraitFile } from '../data/progression.ts';

/**
 * Image preloading. Art is decoded before a screen that swaps pictures (chat
 * mood changes, lobby heroine switch) needs it, and files that don't exist are
 * remembered so fallback chains skip them instead of paying a 404 each time
 * (that round trip was the visible "blink" on expression changes).
 */

const status = new Map<string, Promise<boolean>>();
const known = new Map<string, boolean>();
/** Decoded images are kept referenced so the browser doesn't evict them. */
const keep: HTMLImageElement[] = [];

export function preload(file: string): Promise<boolean> {
  let p = status.get(file);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        keep.push(img);
        img
          .decode()
          .catch(() => {})
          .finally(() => resolve(true));
      };
      img.onerror = () => resolve(false);
      img.src = file;
    }).then((ok) => {
      known.set(file, ok);
      return ok;
    });
    status.set(file, p);
  }
  return p;
}

/** False when the file is known not to exist; undefined when not checked yet. */
export const exists = (file: string): boolean | undefined => known.get(file);

/** Drop files already known to be missing from a fallback chain. */
export const present = (files: string[]): string[] => files.filter((f) => known.get(f) !== false);

/** Preload several files, giving up waiting after `maxMs` (they keep loading). */
export function preloadAll(files: string[], maxMs = 1500): Promise<void> {
  const all = Promise.all(files.map(preload)).then(() => undefined);
  return Promise.race([all, new Promise<void>((r) => window.setTimeout(r, maxMs))]);
}

const MOODS = ['smile', 'tease', 'smirk', 'wink', 'laugh', 'blush', 'shy', 'pout', 'grin'];

/** Every picture a chat can show: her portrait and each mood it uses. */
export function chatFiles(ep: ChatEpisode): string[] {
  const moods = new Set<string>(['smile']);
  for (const n of ep.nodes) if (n.mood) moods.add(n.mood);
  return [portraitFile(ep.heroine), ...[...moods].map((m) => portraitFile(ep.heroine, m))];
}

/** Warm the cache in idle time: every portrait, then every mood variant. */
export function warmArt(): void {
  const idle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn) : setTimeout(fn, 400));
  idle(() => {
    void Promise.all(HEROINES.map((h) => preload(portraitFile(h.id)))).then(() =>
      idle(() => HEROINES.forEach((h) => MOODS.forEach((m) => void preload(portraitFile(h.id, m))))),
    );
  });
}
