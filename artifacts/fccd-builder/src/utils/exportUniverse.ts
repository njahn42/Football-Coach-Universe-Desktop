import JSZip from 'jszip';
import { logoPath, logoZipPath } from './logoAssets';
import type {
  ConferenceDraft,
  ConferencePrestigeInfo,
  OOCRivalry,
  BowlSelection,
  UniverseExport,
  ExportedConference,
  ExportedDivision,
  ExportedTeam,
  ExportedBowlGame,
  ExportedBowlTieIn,
} from '@/types';

export { logoPath, normalizeLogoName } from './logoAssets';

// ─── Universe filename ─────────────────────────────────────────────────────────

export function buildExportFilename(universeName: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const safe = universeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${safe}_${today}`;
}

// ─── Division mapping ─────────────────────────────────────────────────────────
// teams.json stores "FBS" / "FCS" (uppercase NCAA classifications); the game
// validator expects lowercase values.
const DIVISION_MAP: Record<string, string> = {
  FBS: 'fbs',
  FCS: 'fcs',
};

function mapDivision(raw: string): string {
  return DIVISION_MAP[raw] ?? raw.toLowerCase();
}

// ─── Archetype mapping ────────────────────────────────────────────────────────
// teams.json stores football-strategy archetypes; the game validates against
// school-identity archetypes. Map each source value to the closest game value.
const ARCHETYPE_MAP: Record<string, string> = {
  balance:     'balanced',
  tradition:   'tradition-rich',
  rivalry:     'tradition-rich',
  academic:    'academic-powerhouse',
  athletes:    'the-main-attraction',
  recruiting:  'the-main-attraction',
  speed:       'future-forward',
  passing:     'media-mogul',
  line:        'football-focused',
  defense:     'football-focused',
  development: 'football-focused',
};

function mapArchetype(raw: string): string {
  return ARCHETYPE_MAP[raw] ?? 'balanced';
}

// fanbaseType mapping: source values → game-expected values
const FANBASE_TYPE_MAP: Record<string, string> = {
  casual:    'reasonable',
  passionate: 'ride-or-die',
  loyal:     'stubborn',
  'fair-weather': 'volatile',
};

function mapFanbaseType(raw: string): string {
  return FANBASE_TYPE_MAP[raw] ?? 'reasonable';
}

// ─── JSON assembly ────────────────────────────────────────────────────────────

export function generateUniverseExport(
  universeName: string,
  startingYear: number,
  startingMessage: string,
  conferences: ConferenceDraft[],
  rivalries: Record<string, string>,
  selectedBowls: BowlSelection[],
  oocRivalries: OOCRivalry[],
  prestigeInfos: ConferencePrestigeInfo[],
): UniverseExport {
  const prestigeMap = new Map(prestigeInfos.map(p => [p.confId, p.prestigeLevel]));

  const exportedConferences: ExportedConference[] = conferences.map(conf => {
    const prestige = prestigeMap.get(conf.id) ?? 5;
    const zipcode = conf.ccgCity?.zipcode ?? '';

    const divisions: ExportedDivision[] = conf.divisions.map((div, divIdx) => {
      const singleDiv = conf.divisions.length === 1;
      const teams: ExportedTeam[] = div.teams
        .filter((t): t is NonNullable<typeof t> => t != null)
        .map(team => ({
          // Explicit field list — no extra top-level fields from teams.json
          abbreviation:     team.abbreviation,
          name:             team.name,
          mascot:           team.mascot,
          primaryColor:     team.primaryColor,
          secondaryColor:   team.secondaryColor,
          zipcode:          team.zipcode,
          attributes: {
            prestige:     team.attributes.prestige,
            facilities:   team.attributes.facilities,
            stadium:      team.attributes.stadium,
            collegeLife:  team.attributes.collegeLife,
            academics:    team.attributes.academics,
            marketing:    team.attributes.marketing,
            attendance:   team.attendance,   // top-level → nested
            fanbaseLevel: team.attributes.fanbaseLevel,
          },
          archetype:        mapArchetype(team.archetype),
          fanbaseType:      mapFanbaseType(team.fanbaseType),
          rivalAbbreviation: rivalries[team.abbreviation] ?? '',
        }));
      const divName = div.name || (singleDiv ? conf.name : `Division ${divIdx + 1}`);
      return { name: divName, teams };
    });

    return {
      name: conf.name,
      prestigeLevel: prestige,
      zipcode,
      divisions,
    };
  });

  const exportedBowls: ExportedBowlGame[] = selectedBowls.map(({ bowl, tieIn }) => {
    const base: ExportedBowlGame = {
      name: bowl.name,
      zipcode: bowl.zipcode,
      indoors: bowl.indoors,
    };

    // Build first/second in the game's format:
    //   single conf          → "ConfName"
    //   primary + backups    → ["Primary", "Backup1", ...]
    //   no conf set          → omit the key
    const buildSlot = (primary?: string, backups?: string[]) => {
      if (!primary) return undefined;
      const all = [primary, ...(backups?.filter(Boolean) ?? [])];
      return all.length === 1 ? all[0] : all;
    };

    const first  = buildSlot(tieIn.slot1Primary, tieIn.slot1Backups);
    const second = buildSlot(tieIn.slot2Primary, tieIn.slot2Backups);

    if (first !== undefined || second !== undefined) {
      const exportTieIn: Record<string, string | string[]> = {};
      if (first  !== undefined) exportTieIn.first  = first;
      if (second !== undefined) exportTieIn.second = second;
      base.tieIn = exportTieIn as ExportedBowlTieIn;
    }

    return base;
  });

  const result: UniverseExport = {
    name: universeName,
    startingYear,
    startingMessage,
    conferences: exportedConferences,
    bowlGames: exportedBowls,
  };

  if (oocRivalries.length > 0) {
    // Export only the fields the game schema expects — strip internal `offset`
    result.oocRivalries = oocRivalries.map(({ teamA, teamB, preferredSlot, cadence }) => ({
      teamA,
      teamB,
      preferredSlot,
      cadence,
    }));
  }

  return result;
}

// ─── File download helpers ─────────────────────────────────────────────────────

/** Triggers a JSON file download in the browser. */
export function downloadJSON(filename: string, data: UniverseExport): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Builds a ZIP containing the JSON plus any available logo PNGs and triggers download.
 * Missing logos (404) are silently skipped.
 */
export async function downloadZIP(
  filename: string,
  data: UniverseExport,
): Promise<void> {
  const zip = new JSZip();

  // Add the JSON
  zip.file(`${filename}.json`, JSON.stringify(data, null, 2));

  // Collect logo paths to attempt
  const logoPaths: Array<{ zipPath: string; fetchPath: string }> = [];

  // Team logos
  for (const conf of data.conferences) {
    for (const div of conf.divisions) {
      for (const team of div.teams) {
        logoPaths.push({
          fetchPath: logoPath('teams', team.name),
          zipPath: logoZipPath('teams', team.name),
        });
      }
    }
  }

  // Conference logos
  for (const conf of data.conferences) {
    logoPaths.push({
      fetchPath: logoPath('conferences', conf.name),
      zipPath: logoZipPath('conferences', conf.name),
    });
  }

  // Bowl logos
  for (const bowl of data.bowlGames) {
    logoPaths.push({
      fetchPath: logoPath('bowls', bowl.name),
      zipPath: logoZipPath('bowls', bowl.name),
    });
  }

  // De-duplicate
  const seen = new Set<string>();
  const uniquePaths = logoPaths.filter(p => {
    if (seen.has(p.zipPath)) return false;
    seen.add(p.zipPath);
    return true;
  });

  // Fetch all logos in parallel, silently skip 404s
  const fetchResults = await Promise.allSettled(
    uniquePaths.map(async ({ fetchPath, zipPath }) => {
      const res = await fetch(fetchPath);
      if (!res.ok) return null;
      const blob = await res.blob();
      return { zipPath, blob };
    }),
  );

  for (const result of fetchResults) {
    if (result.status === 'fulfilled' && result.value) {
      zip.file(result.value.zipPath, result.value.blob);
    }
  }

  // Generate and download
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
