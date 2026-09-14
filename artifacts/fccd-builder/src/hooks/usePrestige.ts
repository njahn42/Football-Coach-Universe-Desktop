import { useMemo } from 'react';
import type { ConferenceDraft, ConferencePrestigeInfo } from '@/types';
import { totalTeams } from '@/types';

/**
 * Computes prestige information for all conferences based on their
 * current draft state. Conferences are ranked by average team rating
 * (highest avg → prestige 10, lowest → prestige 1). Rankings are spread
 * evenly across the 1–10 scale with unique values per conference.
 *
 * Manual overrides in `overrides` (confId → prestige 1–10) replace the
 * auto-calculated value but do NOT shift other conferences.
 */
export function usePrestige(
  conferences: ConferenceDraft[],
  overrides: Record<string, number>,
): ConferencePrestigeInfo[] {
  return useMemo(() => {
    if (conferences.length === 0) return [];

    // 1. Compute raw stats for each conference
    const stats = conferences.map(conf => {
      const slots = totalTeams(conf.layout);
      const draftedTeams = conf.divisions
        .flatMap(d => d.teams)
        .filter((t): t is NonNullable<typeof t> => t != null);

      const filledSlots = draftedTeams.length;
      const avgRating = filledSlots > 0
        ? draftedTeams.reduce((sum, t) => sum + t.rating, 0) / filledSlots
        : 0;
      const isFinal = filledSlots >= slots;

      return { confId: conf.id, confName: conf.name, avgRating, filledSlots, totalSlots: slots, isFinal };
    });

    // 2. Rank conferences by avgRating descending; assign unique prestige 1–10
    const n = stats.length;
    const sorted = [...stats].sort((a, b) => b.avgRating - a.avgRating);

    const autoPrestigeMap = new Map<string, number>();
    sorted.forEach((conf, rankIdx) => {
      // Spread rank 0..n-1 linearly across prestige 10..1
      // With n conferences: rank 0 → prestige 10, rank n-1 → prestige 1
      // For fewer than 10: top is still 10, bottom is still 1 (or adjusted)
      const prestige = n === 1
        ? 10
        : Math.round(10 - (rankIdx / (n - 1)) * 9);
      autoPrestigeMap.set(conf.confId, Math.max(1, Math.min(10, prestige)));
    });

    // 3. Merge with overrides
    return stats.map(s => {
      const autoPrestige = autoPrestigeMap.get(s.confId) ?? 5;
      const prestigeLevel = overrides[s.confId] ?? autoPrestige;
      return { ...s, autoPrestige, prestigeLevel };
    });
  }, [conferences, overrides]);
}

/**
 * Given a set of prestige infos and a confId + proposed new level,
 * returns the confId (if any) that currently holds that prestige level.
 * Used for the uniqueness enforcement in the prestige review screen.
 */
export function findPrestigeConflict(
  prestigeInfos: ConferencePrestigeInfo[],
  targetConfId: string,
  proposedLevel: number,
): string | null {
  const conflict = prestigeInfos.find(
    p => p.confId !== targetConfId && p.prestigeLevel === proposedLevel,
  );
  return conflict?.confId ?? null;
}
