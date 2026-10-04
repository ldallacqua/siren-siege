// Where her face is in each portrait, as a fraction of the picture's width and height
// (the middle of the face). The story screen's close-ups are framed on it. Measured by
// `python scripts/faces.py`, which also draws a sheet to check the result by eye: run it
// after adding or replacing a portrait and paste its output here.

/** [x, y] of the middle of her face; `base` is portrait.webp, the rest are her moods. */
export const FACES: Record<string, Record<string, [number, number]>> = {
  scarlet: {
    base: [0.5, 0.08],
    smile: [0.51, 0.08],
    laugh: [0.51, 0.08],
    tease: [0.46, 0.09],
    wink: [0.5, 0.08],
    blush: [0.52, 0.08],
    shy: [0.48, 0.11],
    pout: [0.54, 0.09],
    angry: [0.43, 0.11],
    sad: [0.48, 0.1],
  },
  yuki: {
    base: [0.5, 0.11],
    smile: [0.5, 0.11],
    laugh: [0.51, 0.11],
    tease: [0.51, 0.12],
    wink: [0.5, 0.12],
    blush: [0.5, 0.11],
    shy: [0.51, 0.12],
    pout: [0.51, 0.1],
    angry: [0.48, 0.11],
    sad: [0.57, 0.18],
  },
  kaede: {
    base: [0.41, 0.07],
    smile: [0.52, 0.06],
    laugh: [0.53, 0.07],
    tease: [0.51, 0.07],
    wink: [0.54, 0.08],
    blush: [0.5, 0.07],
    shy: [0.54, 0.06],
    pout: [0.57, 0.07],
    angry: [0.56, 0.09],
    sad: [0.55, 0.07],
  },
  selene: {
    base: [0.51, 0.05],
    smile: [0.52, 0.05],
    laugh: [0.5, 0.05],
    tease: [0.5, 0.06],
    wink: [0.48, 0.04],
    blush: [0.55, 0.05],
    shy: [0.46, 0.05],
    pout: [0.53, 0.05],
    angry: [0.55, 0.05],
    sad: [0.52, 0.05],
  },
  nemu: {
    base: [0.49, 0.1],
    smile: [0.49, 0.1],
    laugh: [0.49, 0.1],
    tease: [0.48, 0.1],
    wink: [0.49, 0.1],
    blush: [0.48, 0.11],
    shy: [0.49, 0.11],
    pout: [0.47, 0.11],
    angry: [0.48, 0.1],
    sad: [0.48, 0.12],
  },
};

/** A pose without a measurement is framed where most faces are. */
export const faceOf = (heroine: string, mood?: string): [number, number] => FACES[heroine]?.[mood ?? 'base'] ?? [0.5, 0.09];
