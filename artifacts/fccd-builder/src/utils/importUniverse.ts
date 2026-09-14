import type {
  UniverseExport,
  ConferenceDraft,
  DraftedDivision,
  BowlSelection,
  OOCRivalry,
  Team,
  Bowl,
  City,
  DivisionLayout,
} from '@/types';
import { numDivisions, teamsPerDivision } from '@/types';

// ─── Layout inference ─────────────────────────────────────────────────────────

const VALID_LAYOUTS: DivisionLayout[] = ['1x10', '2x6', '2x7', '2x9', '4x4', '4x5'];

/**
 * Infer the closest valid DivisionLayout from the number of divisions and the
 * maximum number of teams found in any single division of the export.
 */
function inferLayout(divCount: number, maxTeamsInDiv: number): DivisionLayout {
  const candidates = VALID_LAYOUTS.filter(
    l => numDivisions(l) === divCount && teamsPerDivision(l) >= maxTeamsInDiv,
  );
  if (candidates.length > 0) {
    // Pick the smallest layout that still fits all exported teams
    return candidates.sort((a, b) => teamsPerDivision(a) - teamsPerDivision(b))[0];
  }
  // Fallback: best guess by div count
  if (divCount === 1) return '1x10';
  if (divCount === 2) return '2x9';
  return '4x5';
}

// ─── Validated import result ──────────────────────────────────────────────────

export interface ImportPayload {
  universeName: string;
  startingYear: number;
  startingMessage: string;
  conferences: ConferenceDraft[];
  conferenceCount: 6 | 8 | 10 | null;
  rivalries: Record<string, string>;
  selectedBowls: BowlSelection[];
  oocRivalries: OOCRivalry[];
  prestigeOverrides: Record<string, number>;
}

// ─── Main import function ─────────────────────────────────────────────────────

/**
 * Validates `raw` against the UniverseExport shape and re-hydrates it into
 * the store's internal representation using the supplied lookup data.
 *
 * Throws a descriptive Error string on any validation failure so the caller
 * can surface it to the user without mutating existing state.
 */
export function validateAndImport(
  raw: unknown,
  allTeams: Team[],
  allBowls: Bowl[],
  allCities: City[],
): ImportPayload {
  // ── Structural validation ──────────────────────────────────────────────────
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('The file does not contain a valid universe JSON object.');
  }

  const d = raw as Record<string, unknown>;

  if (typeof d.name !== 'string' || d.name.trim() === '') {
    throw new Error('Missing or empty "name" field.');
  }
  if (typeof d.startingYear !== 'number' || !Number.isFinite(d.startingYear)) {
    throw new Error('Missing or invalid "startingYear" field — expected a number.');
  }
  if (typeof d.startingMessage !== 'string') {
    throw new Error('Missing or invalid "startingMessage" field — expected a string.');
  }
  if (!Array.isArray(d.conferences) || d.conferences.length === 0) {
    throw new Error('Missing or empty "conferences" array.');
  }
  if (!Array.isArray(d.bowlGames)) {
    throw new Error('Missing "bowlGames" array.');
  }

  const exportData = d as unknown as UniverseExport;

  // ── Lookup maps ────────────────────────────────────────────────────────────
  const teamByAbbr = new Map<string, Team>(allTeams.map(t => [t.abbreviation, t]));
  const bowlByName = new Map<string, Bowl>(allBowls.map(b => [b.name, b]));
  const cityByZip  = new Map<string, City>(allCities.map(c => [c.zipcode, c]));

  // ── Re-hydrate conferences ─────────────────────────────────────────────────
  const rivalries: Record<string, string> = {};
  const prestigeOverrides: Record<string, number> = {};

  const conferences: ConferenceDraft[] = exportData.conferences.map((ec, idx) => {
    if (typeof ec.name !== 'string' || ec.name.trim() === '') {
      throw new Error(`Conference at index ${idx} is missing a name.`);
    }
    if (!Array.isArray(ec.divisions) || ec.divisions.length === 0) {
      throw new Error(`Conference "${ec.name}" has no divisions.`);
    }

    const confId = `conf-${idx}`;

    // CCG city — fall back to a minimal City if zipcode isn't in cities.json
    const ccgCity: City = cityByZip.get(ec.zipcode) ?? {
      cityName: ec.zipcode,
      zipcode: ec.zipcode,
      stadium: '',
      indoors: false,
    };

    // Infer layout from export shape
    const maxTeamsInDiv = Math.max(...ec.divisions.map(d => (Array.isArray(d.teams) ? d.teams.length : 0)), 1);
    const layout = inferLayout(ec.divisions.length, maxTeamsInDiv);
    const slotCount = teamsPerDivision(layout);

    const divisions: DraftedDivision[] = ec.divisions.map((ed, dIdx) => {
      if (!Array.isArray(ed.teams)) {
        throw new Error(`Division ${dIdx} of conference "${ec.name}" has no teams array.`);
      }
      const teams: (Team | null)[] = Array<null>(slotCount).fill(null);

      ed.teams.forEach((et, slotIdx) => {
        if (slotIdx >= slotCount) return; // shouldn't happen, but be safe
        if (typeof et.abbreviation !== 'string') return;

        const team = teamByAbbr.get(et.abbreviation);
        if (team) {
          teams[slotIdx] = team;
        }
        // Even if the team wasn't found in teams.json, preserve rivalry info
        if (typeof et.rivalAbbreviation === 'string' && et.rivalAbbreviation) {
          rivalries[et.abbreviation] = et.rivalAbbreviation;
        }
      });

      return { name: ed.name ?? '', teams };
    });

    // Store prestige as an override keyed by conf id
    if (typeof ec.prestigeLevel === 'number') {
      prestigeOverrides[confId] = Math.max(1, Math.min(10, Math.round(ec.prestigeLevel)));
    }

    return {
      id: confId,
      name: ec.name,
      ccgCity,
      layout,
      divisionNameSetIndex: 0,
      divisions,
    };
  });

  // ── Re-hydrate bowl selections ─────────────────────────────────────────────
  const selectedBowls: BowlSelection[] = exportData.bowlGames.map((eg, idx) => {
    if (typeof eg.name !== 'string' || eg.name.trim() === '') {
      throw new Error(`Bowl game at index ${idx} is missing a name.`);
    }

    // Prefer the canonical Bowl from bowls.json; fall back to export data
    const bowl: Bowl = bowlByName.get(eg.name) ?? {
      name: eg.name,
      zipcode: typeof eg.zipcode === 'string' ? eg.zipcode : '',
      indoors: typeof eg.indoors === 'boolean' ? eg.indoors : false,
    };

    // Re-parse tie-in format: string | string[] → slot1/slot2 Primary + Backups
    const parseSlot = (
      val: string | string[] | undefined,
    ): [string | undefined, string[]] => {
      if (!val) return [undefined, []];
      if (typeof val === 'string') return [val, []];
      if (Array.isArray(val) && val.length > 0) return [val[0], val.slice(1).filter(Boolean)];
      return [undefined, []];
    };

    const [slot1Primary, slot1Backups] = parseSlot(eg.tieIn?.first);
    const [slot2Primary, slot2Backups] = parseSlot(eg.tieIn?.second);

    return {
      bowl,
      tieIn: { slot1Primary, slot1Backups, slot2Primary, slot2Backups },
    };
  });

  // ── Re-hydrate OOC rivalries ───────────────────────────────────────────────
  const oocRivalries: OOCRivalry[] = (exportData.oocRivalries ?? []).map((r, idx) => {
    if (typeof r.teamA !== 'string' || typeof r.teamB !== 'string') {
      throw new Error(`OOC rivalry at index ${idx} is missing teamA or teamB.`);
    }
    return {
      teamA: r.teamA,
      teamB: r.teamB,
      preferredSlot: typeof r.preferredSlot === 'number' ? r.preferredSlot : 1,
      cadence:       typeof r.cadence       === 'number' ? r.cadence       : 1,
      offset: 0, // offset is an internal field, not exported
    };
  });

  // ── Conference count ───────────────────────────────────────────────────────
  const count = conferences.length;
  const conferenceCount: 6 | 8 | 10 | null =
    count === 6 ? 6 : count === 8 ? 8 : count === 10 ? 10 : null;

  return {
    universeName: exportData.name,
    startingYear: exportData.startingYear,
    startingMessage: exportData.startingMessage,
    conferences,
    conferenceCount,
    rivalries,
    selectedBowls,
    oocRivalries,
    prestigeOverrides,
  };
}
