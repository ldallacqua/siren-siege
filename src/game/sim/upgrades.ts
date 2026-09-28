import type { HeroineDef, Stats } from '../../data/types.ts';

export const MAX_TIER = 3; // MVP; the data model supports 5 like BTD6.

/**
 * BTD6-style crosspathing: at most two paths may be upgraded, and only one of
 * them may go beyond tier 2 (e.g. 3-2-0 is legal, 3-3-0 and 1-1-1 are not).
 */
export function canBuyUpgrade(tiers: readonly number[], path: number): boolean {
  if (tiers[path] >= MAX_TIER) return false;
  const next = tiers.map((t, i) => (i === path ? t + 1 : t));
  if (next.filter((t) => t > 0).length > 2) return false;
  if (next.filter((t) => t > 2).length > 1) return false;
  return true;
}

/** Why a path is locked, for the UI. Null when purchasable (ignoring cash). */
export function lockReason(tiers: readonly number[], path: number): string | null {
  if (tiers[path] >= MAX_TIER) return 'Maxed';
  if (canBuyUpgrade(tiers, path)) return null;
  return 'Path locked';
}

/** Bond levels give a small permanent edge: +2% attack rate per level above 1. */
export function bondRateBonus(level: number): number {
  return 1 + Math.max(0, level - 1) * 0.02;
}

export function computeStats(def: HeroineDef, tiers: readonly number[], bondLevel: number): Stats {
  const s: Stats = { ...def.base };
  def.paths.forEach((p, i) => {
    for (let t = 0; t < tiers[i]; t++) p.tiers[t].apply(s);
  });
  s.rate *= bondRateBonus(bondLevel);
  return s;
}

export function sellValue(spent: number): number {
  return Math.floor(spent * 0.7);
}
