import { useMemo } from 'react';
import type {
  ConferenceDraft,
  OOCRivalry,
  BowlSelection,
  ValidationResult,
} from '@/types';
import { MAX_BOWL_SELECTIONS } from '@/types';

interface ValidationInput {
  conferences: ConferenceDraft[];
  rivalries: Record<string, string>;
  oocRivalries: OOCRivalry[];
  selectedBowls: BowlSelection[];
  totalDraftedCount: number;
}

/**
 * Runs all validation rules against the current universe state.
 * Returns a list of ValidationResult entries — one per rule.
 * Blocking rules must all pass before export is allowed.
 */
export function useValidation(input: ValidationInput): ValidationResult[] {
  const { conferences, rivalries, oocRivalries, selectedBowls, totalDraftedCount } = input;

  return useMemo((): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // ── Rule 1: At least one conference with drafted teams ─────────────────────
    const confsWithTeams = conferences.filter(c =>
      c.divisions.some(d => d.teams.some(t => t != null)),
    );
    results.push({
      id: 'has-teams',
      label: 'At least one conference has teams drafted',
      pass: confsWithTeams.length > 0,
      errorMessage: 'No teams have been drafted into any conference.',
      severity: 'blocking',
      screen: 'draft-teams',
    });

    // ── Rule 2: All division team slots are filled (no empty slots) ────────────
    const emptySlotConfs: string[] = [];
    for (const conf of conferences) {
      for (const div of conf.divisions) {
        const hasEmpty = div.teams.some(t => t == null);
        if (hasEmpty) {
          emptySlotConfs.push(conf.name || conf.id);
          break;
        }
      }
    }
    results.push({
      id: 'all-slots-filled',
      label: 'All conference division slots are filled',
      pass: emptySlotConfs.length === 0,
      errorMessage: emptySlotConfs.length > 0
        ? `${emptySlotConfs.length} conference(s) have empty slots: ${emptySlotConfs.slice(0, 3).join(', ')}${emptySlotConfs.length > 3 ? '…' : ''}`
        : undefined,
      severity: 'blocking',
      screen: 'draft-teams',
    });

    // ── Rule 3: Every drafted team has a rivalry assigned ─────────────────────
    const teamsWithoutRival: string[] = [];
    for (const conf of conferences) {
      for (const div of conf.divisions) {
        // Only check if division has more than 1 team (can't have a rival if alone)
        const divTeams = div.teams.filter((t): t is NonNullable<typeof t> => t != null);
        if (divTeams.length < 2) continue;
        for (const team of divTeams) {
          if (!rivalries[team.abbreviation]) {
            teamsWithoutRival.push(team.abbreviation);
          }
        }
      }
    }
    results.push({
      id: 'rivalries-complete',
      label: 'Every team has a divisional rivalry assigned',
      pass: teamsWithoutRival.length === 0,
      errorMessage: teamsWithoutRival.length > 0
        ? `${teamsWithoutRival.length} team(s) missing a rivalry: ${teamsWithoutRival.slice(0, 5).join(', ')}${teamsWithoutRival.length > 5 ? '…' : ''}`
        : undefined,
      severity: 'blocking',
      screen: 'rivalries',
    });

    // ── Rule 4: No self-rivalries ─────────────────────────────────────────────
    const selfRivalries = Object.entries(rivalries)
      .filter(([abbr, rival]) => abbr === rival)
      .map(([abbr]) => abbr);
    results.push({
      id: 'no-self-rivalry',
      label: 'No team is rivals with itself',
      pass: selfRivalries.length === 0,
      errorMessage: selfRivalries.length > 0
        ? `${selfRivalries.join(', ')} ${selfRivalries.length === 1 ? 'is' : 'are'} set as self-rivals`
        : undefined,
      severity: 'blocking',
      screen: 'rivalries',
    });

    // ── Rule 5: OOC rivalry — no duplicate pairs ──────────────────────────────
    const oocPairs = new Set<string>();
    const oocDupes: string[] = [];
    for (const r of oocRivalries) {
      const key1 = `${r.teamA}:${r.teamB}`;
      const key2 = `${r.teamB}:${r.teamA}`;
      if (oocPairs.has(key1) || oocPairs.has(key2)) {
        oocDupes.push(`${r.teamA} vs ${r.teamB}`);
      }
      oocPairs.add(key1);
    }
    results.push({
      id: 'ooc-no-duplicates',
      label: 'No duplicate OOC rivalry pairs',
      pass: oocDupes.length === 0,
      errorMessage: oocDupes.length > 0
        ? `Duplicate OOC pairs: ${oocDupes.join(', ')}`
        : undefined,
      severity: 'blocking',
      screen: 'ooc-rivalries',
    });

    // ── Rule 6: OOC rivalry — offset < cadence ────────────────────────────────
    const badOffsets = oocRivalries.filter(r => r.offset >= r.cadence);
    results.push({
      id: 'ooc-valid-offset',
      label: 'All OOC rivalry offsets are valid (offset < cadence)',
      pass: badOffsets.length === 0,
      errorMessage: badOffsets.length > 0
        ? `${badOffsets.length} OOC rivarlies have offset ≥ cadence`
        : undefined,
      severity: 'blocking',
      screen: 'ooc-rivalries',
    });

    // ── Rule 7: Bowl count ≤ MAX ──────────────────────────────────────────────
    results.push({
      id: 'bowl-count',
      label: `Bowl game count is within limit (max ${MAX_BOWL_SELECTIONS})`,
      pass: selectedBowls.length <= MAX_BOWL_SELECTIONS,
      errorMessage: selectedBowls.length > MAX_BOWL_SELECTIONS
        ? `${selectedBowls.length} bowls selected (max is ${MAX_BOWL_SELECTIONS})`
        : undefined,
      severity: 'blocking',
      screen: 'bowl-draft',
    });

    // ── Rule 8 (warning): Bowl slots vs drafted team count ────────────────────
    const bowlTeamSlots = selectedBowls.length * 2;
    const bowlOverflow = totalDraftedCount > 0 && bowlTeamSlots > totalDraftedCount;
    results.push({
      id: 'bowl-team-ratio',
      label: `Bowl game slots don't exceed drafted team count`,
      pass: !bowlOverflow,
      errorMessage: bowlOverflow
        ? `${bowlTeamSlots} bowl slots vs ${totalDraftedCount} drafted teams — some bowls may not fill`
        : undefined,
      severity: 'warning',
      screen: 'bowl-draft',
    });

    return results;
  }, [conferences, rivalries, oocRivalries, selectedBowls, totalDraftedCount]);
}

/** Returns true only if all blocking validations pass. */
export function allBlockingPass(results: ValidationResult[]): boolean {
  return results.filter(r => r.severity === 'blocking').every(r => r.pass);
}
