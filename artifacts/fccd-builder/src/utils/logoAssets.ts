export type LogoCategory = 'teams' | 'conferences' | 'bowls' | 'playoffs';

/**
 * Some reference data uses a current or abbreviated school name while the
 * supplied artwork retains an older or expanded filename.
 */
const LOGO_NAME_ALIASES: Partial<Record<LogoCategory, Record<string, string>>> = {
  teams: {
    miami_fl: 'miami',
    california: 'cal',
    louisiana_monroe: 'louisiana-monroe',
    sam_houston: 'sam_houston_state',
    tarleton_state: 'tarleton',
    'bethune-cookman': 'bethune_cookman',
    southern_university: 'southern',
    'gardner-webb': 'gardner_webb',
    nccu: 'north_carolina_central',
    'tennessee-martin': 'ut_martin',
    lane_college: 'lane',
    miles_college: 'miles',
    dixie_state: 'utah_tech',
  },
};

export function normalizeLogoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function logoFilename(type: LogoCategory, name: string): string {
  const normalizedName = normalizeLogoName(name);
  return LOGO_NAME_ALIASES[type]?.[normalizedName] ?? normalizedName;
}

/**
 * Resolve an image under Vite's configured artifact base path.
 */
export function logoPath(type: LogoCategory, name: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return `${base}images/${type}/${logoFilename(type, name)}.png`;
}

/**
 * The game ZIP always starts its artwork tree at `images/`, independent of
 * the builder's hosting base path.
 */
export function logoZipPath(type: LogoCategory, name: string): string {
  return `images/${type}/${logoFilename(type, name)}.png`;
}