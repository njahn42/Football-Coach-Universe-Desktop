import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ConferenceDraft,
  DivisionLayout,
  ScreenId,
  City,
  Team,
  LastAssignment,
  OOCRivalry,
  Bowl,
  BowlSelection,
  BowlTieIn,
  ControlBinding,
} from './types';
import type { ImportPayload } from './utils/importUniverse';
import { numDivisions, teamsPerDivision, MAX_DRAFTED_TEAMS, MAX_BOWL_SELECTIONS } from './types';

// ─── Name/message suggestions ─────────────────────────────────────────────────

export function buildNameSuggestions(year: number): string[] {
  return [
    `${year} Custom Universe`,
    `${year} College Dynasty`,
    `${year} Gridiron Universe`,
    `${year} Custom College Season`,
    `${year} Champion's League`,
  ];
}

export function buildMessageSuggestions(name: string, year: number): string[] {
  return [
    `Welcome to the ${year} season of ${name}!`,
    `A new era of college football begins in ${year}. Welcome to ${name}!`,
    `${name}: ${year} kicks off. May the best program win!`,
  ];
}

// ─── Store state interface ─────────────────────────────────────────────────────

interface UniverseState {
  // ── Navigation ──────────────────────────────────────────────────────────────
  currentScreen: ScreenId;
  conferenceSetupIndex: number; // which conference is being configured (0-based)

  // ── Screen 1: Universe Info ──────────────────────────────────────────────────
  universeName: string;
  nameIndex: number;
  startingYear: number;
  startingMessage: string;
  messageIndex: number;

  // ── Screen 2: Conference Count ───────────────────────────────────────────────
  conferenceCount: 6 | 8 | 10 | null;

  // ── Screen 3+: Conference drafts (one per conference) ──────────────────────
  conferences: ConferenceDraft[];

  // ── Screen 4: Team pool ──────────────────────────────────────────────────────
  allTeams: Team[];
  lastAssignment: LastAssignment | null;

  // ── Screen 5: Prestige overrides (confId → prestige 1–10) ─────────────────
  prestigeOverrides: Record<string, number>;

  // ── Screen 6: Division rivalries (teamAbbr → rivalAbbr) ───────────────────
  rivalries: Record<string, string>;

  // ── Screen 7: OOC rivalries ──────────────────────────────────────────────────
  oocRivalries: OOCRivalry[];

  // ── Screen 8: Bowl selections ────────────────────────────────────────────────
  allBowls: Bowl[];
  selectedBowls: BowlSelection[];

  // ── Computed helpers ─────────────────────────────────────────────────────────
  getDraftedTeamAbbrs: () => Set<string>;
  getTotalDraftedCount: () => number;

  // ── Actions ──────────────────────────────────────────────────────────────────
  setScreen: (screen: ScreenId) => void;
  setConferenceSetupIndex: (index: number) => void;

  // Universe Info
  setUniverseName: (name: string) => void;
  cycleNameSuggestion: (direction?: 'next' | 'prev') => void;
  setStartingYear: (year: number) => void;
  nudgeYear: (delta: number) => void;
  setStartingMessage: (msg: string) => void;
  cycleMessageSuggestion: (direction?: 'next' | 'prev') => void;

  // Conference Count
  setConferenceCount: (count: 6 | 8 | 10) => void;

  // Conference drafts
  upsertConference: (index: number, patch: Partial<ConferenceDraft>) => void;
  setConferenceLayout: (index: number, layout: DivisionLayout) => void;
  cycleConferenceDivisionNameSet: (index: number, direction?: 'next' | 'prev') => void;
  setDivisionName: (confIndex: number, divIndex: number, name: string) => void;

  // Team pool
  setAllTeams: (teams: Team[]) => void;
  assignTeam: (team: Team, confIndex: number, divIndex: number, slotIndex: number) => void;
  removeTeamFromSlot: (confIndex: number, divIndex: number, slotIndex: number) => void;
  undoLastAssignment: () => void;

  // Prestige
  setPrestigeOverride: (confId: string, level: number) => void;
  clearPrestigeOverride: (confId: string) => void;

  // Division rivalries
  setRivalry: (teamAbbr: string, rivalAbbr: string) => void;
  clearRivalry: (teamAbbr: string) => void;
  clearAllRivalries: () => void;

  // OOC rivalries
  addOOCRivalry: (entry: OOCRivalry) => void;
  removeOOCRivalry: (index: number) => void;
  updateOOCRivalry: (index: number, patch: Partial<OOCRivalry>) => void;

  // Bowls
  setAllBowls: (bowls: Bowl[]) => void;
  addBowl: (bowl: Bowl) => void;
  removeBowl: (index: number) => void;
  reorderBowl: (fromIndex: number, toIndex: number) => void;
  setBowlTieIn: (index: number, tieIn: Partial<BowlTieIn>) => void;

  // Import
  loadFromImport: (payload: ImportPayload) => void;

  // Reset
  resetDraft: () => void;

  // ── Controls overlay ─────────────────────────────────────────────────────────
  showControls: boolean;
  controlBindings: ControlBinding[];
  setControlBindings: (bindings: ControlBinding[]) => void;
  toggleControls: () => void;
  closeControls: () => void;

  // ── Universe Drawer ───────────────────────────────────────────────────────────
  showUniverseDrawer: boolean;
  /** Conference index to jump to when navigating from the drawer. Cleared by the target screen. */
  drawerNavConf: number | null;
  toggleUniverseDrawer: () => void;
  closeUniverseDrawer: () => void;
  setDrawerNavConf: (index: number | null) => void;
}

// ─── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_YEAR = new Date().getFullYear();
const INITIAL_NAME = buildNameSuggestions(INITIAL_YEAR)[0];
const INITIAL_MSG = buildMessageSuggestions(INITIAL_NAME, INITIAL_YEAR)[0];

const initialState = {
  currentScreen: 'universe-info' as ScreenId,
  conferenceSetupIndex: 0,
  showControls: false,
  controlBindings: [] as ControlBinding[],
  showUniverseDrawer: false,
  drawerNavConf: null as number | null,
  universeName: INITIAL_NAME,
  nameIndex: 0,
  startingYear: INITIAL_YEAR,
  startingMessage: INITIAL_MSG,
  messageIndex: 0,
  conferenceCount: null as (6 | 8 | 10 | null),
  conferences: [] as ConferenceDraft[],
  allTeams: [] as Team[],
  lastAssignment: null as LastAssignment | null,
  prestigeOverrides: {} as Record<string, number>,
  rivalries: {} as Record<string, string>,
  oocRivalries: [] as OOCRivalry[],
  allBowls: [] as Bowl[],
  selectedBowls: [] as BowlSelection[],
};

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useUniverseStore = create<UniverseState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ── Computed helpers ────────────────────────────────────────────────────
      getDraftedTeamAbbrs: () => {
        const { conferences } = get();
        const abbrs = new Set<string>();
        for (const conf of conferences) {
          for (const div of conf.divisions) {
            for (const team of div.teams) {
              if (team != null) abbrs.add(team.abbreviation);
            }
          }
        }
        return abbrs;
      },

      getTotalDraftedCount: () => {
        const { conferences } = get();
        let count = 0;
        for (const conf of conferences) {
          for (const div of conf.divisions) {
            for (const team of div.teams) {
              if (team != null) count++;
            }
          }
        }
        return count;
      },

      // ── Navigation ──────────────────────────────────────────────────────────
      setScreen: (screen) => set({ currentScreen: screen, showControls: false }),
      setConferenceSetupIndex: (index) => set({ conferenceSetupIndex: index }),

      // ── Controls overlay ─────────────────────────────────────────────────────
      setControlBindings: (bindings) => set({ controlBindings: bindings }),
      toggleControls: () => set((s) => ({ showControls: !s.showControls })),
      closeControls: () => set({ showControls: false }),

      // ── Universe Drawer ───────────────────────────────────────────────────────
      toggleUniverseDrawer: () => set((s) => ({ showUniverseDrawer: !s.showUniverseDrawer })),
      closeUniverseDrawer: () => set({ showUniverseDrawer: false }),
      setDrawerNavConf: (index) => set({ drawerNavConf: index }),

      // ── Universe Info ────────────────────────────────────────────────────────
      setUniverseName: (name) => {
        const { startingYear, messageIndex } = get();
        const msg = buildMessageSuggestions(name, startingYear)[messageIndex]
          ?? buildMessageSuggestions(name, startingYear)[0];
        set({ universeName: name, startingMessage: msg });
      },

      cycleNameSuggestion: (direction = 'next') => {
        const { nameIndex, startingYear } = get();
        const suggestions = buildNameSuggestions(startingYear);
        const next = direction === 'next'
          ? (nameIndex + 1) % suggestions.length
          : (nameIndex - 1 + suggestions.length) % suggestions.length;
        const name = suggestions[next];
        const { messageIndex } = get();
        const msg = buildMessageSuggestions(name, startingYear)[messageIndex]
          ?? buildMessageSuggestions(name, startingYear)[0];
        set({ nameIndex: next, universeName: name, startingMessage: msg });
      },

      setStartingYear: (year) => {
        const clamped = Math.min(2100, Math.max(1950, year));
        const { nameIndex, messageIndex } = get();
        const name = buildNameSuggestions(clamped)[nameIndex] ?? buildNameSuggestions(clamped)[0];
        const msg = buildMessageSuggestions(name, clamped)[messageIndex]
          ?? buildMessageSuggestions(name, clamped)[0];
        set({ startingYear: clamped, universeName: name, startingMessage: msg });
      },

      nudgeYear: (delta) => get().setStartingYear(get().startingYear + delta),

      setStartingMessage: (msg) => set({ startingMessage: msg }),

      cycleMessageSuggestion: (direction = 'next') => {
        const { messageIndex, universeName, startingYear } = get();
        const suggestions = buildMessageSuggestions(universeName, startingYear);
        const next = direction === 'next'
          ? (messageIndex + 1) % suggestions.length
          : (messageIndex - 1 + suggestions.length) % suggestions.length;
        set({ messageIndex: next, startingMessage: suggestions[next] });
      },

      // ── Conference Count ─────────────────────────────────────────────────────
      setConferenceCount: (count) => set({ conferenceCount: count, conferences: [] }),

      // ── Conference drafts ────────────────────────────────────────────────────
      upsertConference: (index, patch) => {
        const { conferences } = get();
        const next = [...conferences];
        while (next.length <= index) {
          next.push({
            id: `conf-${next.length}`,
            name: '',
            ccgCity: null as unknown as City,
            layout: '2x6',
            divisionNameSetIndex: 0,
            divisions: [],
          });
        }
        next[index] = { ...next[index], ...patch };
        set({ conferences: next });
      },

      setConferenceLayout: (index, layout) => {
        const { conferences } = get();
        const conf = conferences[index];
        if (!conf) return;
        const n = numDivisions(layout);
        const tpd = teamsPerDivision(layout);
        const divisions = Array.from({ length: n }, (_, i) => ({
          name: conf.divisions[i]?.name ?? '',
          teams: Array<null>(tpd).fill(null),
        }));
        get().upsertConference(index, { layout, divisions, divisionNameSetIndex: 0 });
      },

      cycleConferenceDivisionNameSet: (index, direction = 'next') => {
        const { conferences } = get();
        const conf = conferences[index];
        if (!conf) return;
        const current = conf.divisionNameSetIndex ?? 0;
        const next = direction === 'next' ? current + 1 : Math.max(0, current - 1);
        get().upsertConference(index, { divisionNameSetIndex: next });
      },

      setDivisionName: (confIndex, divIndex, name) => {
        const { conferences } = get();
        const conf = conferences[confIndex];
        if (!conf) return;
        const newDivisions = [...conf.divisions];
        if (!newDivisions[divIndex]) return;
        newDivisions[divIndex] = { ...newDivisions[divIndex], name };
        const next = [...conferences];
        next[confIndex] = { ...conf, divisions: newDivisions };
        set({ conferences: next });
      },

      // ── Team pool ────────────────────────────────────────────────────────────
      setAllTeams: (teams) => set({ allTeams: teams }),

      assignTeam: (team, confIndex, divIndex, slotIndex) => {
        const { conferences, getTotalDraftedCount, getDraftedTeamAbbrs } = get();
        if (getTotalDraftedCount() >= MAX_DRAFTED_TEAMS) return;
        if (getDraftedTeamAbbrs().has(team.abbreviation)) return;

        const conf = conferences[confIndex];
        if (!conf) return;
        const division = conf.divisions[divIndex];
        if (!division) return;

        const tpd = teamsPerDivision(conf.layout);
        const currentTeams: (Team | null)[] = Array.from(
          { length: tpd }, (_, i) => division.teams[i] ?? null,
        );
        if (currentTeams[slotIndex] != null) return;
        currentTeams[slotIndex] = team;

        const newDivisions = [...conf.divisions];
        newDivisions[divIndex] = { ...division, teams: currentTeams };
        const nextConferences = [...conferences];
        nextConferences[confIndex] = { ...conf, divisions: newDivisions };

        set({ conferences: nextConferences, lastAssignment: { confIndex, divIndex, slotIndex, team } });
      },

      removeTeamFromSlot: (confIndex, divIndex, slotIndex) => {
        const { conferences, lastAssignment } = get();
        const conf = conferences[confIndex];
        if (!conf) return;
        const division = conf.divisions[divIndex];
        if (!division) return;

        const tpd = teamsPerDivision(conf.layout);
        const currentTeams: (Team | null)[] = Array.from(
          { length: tpd }, (_, i) => division.teams[i] ?? null,
        );
        currentTeams[slotIndex] = null;

        const newDivisions = [...conf.divisions];
        newDivisions[divIndex] = { ...division, teams: currentTeams };
        const nextConferences = [...conferences];
        nextConferences[confIndex] = { ...conf, divisions: newDivisions };

        const newLast =
          lastAssignment?.confIndex === confIndex &&
          lastAssignment?.divIndex === divIndex &&
          lastAssignment?.slotIndex === slotIndex
            ? null : lastAssignment;

        set({ conferences: nextConferences, lastAssignment: newLast });
      },

      undoLastAssignment: () => {
        const { lastAssignment } = get();
        if (!lastAssignment) return;
        get().removeTeamFromSlot(lastAssignment.confIndex, lastAssignment.divIndex, lastAssignment.slotIndex);
        set({ lastAssignment: null });
      },

      // ── Prestige ─────────────────────────────────────────────────────────────
      setPrestigeOverride: (confId, level) => {
        const { prestigeOverrides } = get();
        set({ prestigeOverrides: { ...prestigeOverrides, [confId]: level } });
      },

      clearPrestigeOverride: (confId) => {
        const next = { ...get().prestigeOverrides };
        delete next[confId];
        set({ prestigeOverrides: next });
      },

      // ── Division rivalries ───────────────────────────────────────────────────
      setRivalry: (teamAbbr, rivalAbbr) => {
        const { rivalries } = get();
        // Bidirectional: clear any old pairings first, then link both sides
        const next = { ...rivalries };
        // Remove previous rival's back-link if it existed
        const oldRival = next[teamAbbr];
        if (oldRival && next[oldRival] === teamAbbr) delete next[oldRival];
        const oldBack = next[rivalAbbr];
        if (oldBack && next[oldBack] === rivalAbbr) delete next[oldBack];
        next[teamAbbr] = rivalAbbr;
        next[rivalAbbr] = teamAbbr;
        set({ rivalries: next });
      },

      clearRivalry: (teamAbbr) => {
        const next = { ...get().rivalries };
        // Clear both sides of the pair
        const rival = next[teamAbbr];
        if (rival && next[rival] === teamAbbr) delete next[rival];
        delete next[teamAbbr];
        set({ rivalries: next });
      },

      clearAllRivalries: () => set({ rivalries: {} }),

      // ── OOC rivalries ────────────────────────────────────────────────────────
      addOOCRivalry: (entry) => {
        const { oocRivalries } = get();
        // Validate: no duplicates (either order)
        const dupe = oocRivalries.some(
          r =>
            (r.teamA === entry.teamA && r.teamB === entry.teamB) ||
            (r.teamA === entry.teamB && r.teamB === entry.teamA),
        );
        if (dupe) return;
        // Validate: teamA ≠ teamB
        if (entry.teamA === entry.teamB) return;
        // Clamp offset
        const clamped = { ...entry, offset: Math.min(entry.offset, entry.cadence - 1) };
        set({ oocRivalries: [...oocRivalries, clamped] });
      },

      removeOOCRivalry: (index) => {
        const { oocRivalries } = get();
        set({ oocRivalries: oocRivalries.filter((_, i) => i !== index) });
      },

      updateOOCRivalry: (index, patch) => {
        const { oocRivalries } = get();
        const existing = oocRivalries[index];
        if (!existing) return;
        const updated = { ...existing, ...patch };
        // Auto-clamp offset when cadence changes
        updated.offset = Math.min(updated.offset, Math.max(0, updated.cadence - 1));
        const next = [...oocRivalries];
        next[index] = updated;
        set({ oocRivalries: next });
      },

      // ── Bowls ────────────────────────────────────────────────────────────────
      setAllBowls: (bowls) => set({ allBowls: bowls }),

      addBowl: (bowl) => {
        const { selectedBowls } = get();
        if (selectedBowls.length >= MAX_BOWL_SELECTIONS) return;
        if (selectedBowls.some(s => s.bowl.name === bowl.name)) return;
        set({ selectedBowls: [...selectedBowls, { bowl, tieIn: {} }] });
      },

      removeBowl: (index) => {
        const { selectedBowls } = get();
        set({ selectedBowls: selectedBowls.filter((_, i) => i !== index) });
      },

      reorderBowl: (fromIndex, toIndex) => {
        const { selectedBowls } = get();
        if (fromIndex === toIndex) return;
        const next = [...selectedBowls];
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        set({ selectedBowls: next });
      },

      setBowlTieIn: (index, tieIn) => {
        const { selectedBowls } = get();
        const entry = selectedBowls[index];
        if (!entry) return;
        const merged: BowlTieIn = { ...entry.tieIn, ...tieIn };
        // When a primary is cleared, also clear its backup array
        if ('slot1Primary' in tieIn && !tieIn.slot1Primary) merged.slot1Backups = [];
        if ('slot2Primary' in tieIn && !tieIn.slot2Primary) merged.slot2Backups = [];
        const next = [...selectedBowls];
        next[index] = { ...entry, tieIn: merged };
        set({ selectedBowls: next });
      },

      // ── Import ───────────────────────────────────────────────────────────────
      loadFromImport: (payload) => {
        set({
          universeName:      payload.universeName,
          startingYear:      payload.startingYear,
          startingMessage:   payload.startingMessage,
          nameIndex:         0,
          messageIndex:      0,
          conferences:       payload.conferences,
          conferenceCount:   payload.conferenceCount,
          rivalries:         payload.rivalries,
          selectedBowls:     payload.selectedBowls,
          oocRivalries:      payload.oocRivalries,
          prestigeOverrides: payload.prestigeOverrides,
          conferenceSetupIndex: 0,
          lastAssignment:    null,
          currentScreen:     'prestige-review',
          showControls:      false,
        });
      },

      // ── Reset ────────────────────────────────────────────────────────────────
      resetDraft: () => set(initialState),
    }),
    {
      name: 'fccd-universe-draft',
      version: 2,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>;
        if (fromVersion < 1) {
          // v0 → v1: rename teamAAbbr/teamBAbbr → teamA/teamB in oocRivalries
          const raw = s.oocRivalries;
          if (Array.isArray(raw)) {
            s.oocRivalries = raw.map((r: Record<string, unknown>) => {
              if ('teamAAbbr' in r || 'teamBAbbr' in r) {
                const { teamAAbbr, teamBAbbr, ...rest } = r;
                return { ...rest, teamA: teamAAbbr, teamB: teamBAbbr };
              }
              return r;
            });
          }
        }
        if (fromVersion < 2) {
          // v1 → v2: convert slot1Backup/slot2Backup strings → slot1Backups/slot2Backups arrays
          const bowls = s.selectedBowls;
          if (Array.isArray(bowls)) {
            s.selectedBowls = bowls.map((b: Record<string, unknown>) => {
              const tieIn = (b.tieIn ?? {}) as Record<string, unknown>;
              if ('slot1Backup' in tieIn || 'slot2Backup' in tieIn) {
                const { slot1Backup, slot2Backup, ...rest } = tieIn;
                return {
                  ...b,
                  tieIn: {
                    ...rest,
                    slot1Backups: slot1Backup ? [slot1Backup] : [],
                    slot2Backups: slot2Backup ? [slot2Backup] : [],
                  },
                };
              }
              return b;
            });
          }
        }
        return s;
      },
      partialize: (state) => {
        // Exclude transient/re-fetchable data from localStorage
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
          allTeams, lastAssignment,
          allBowls,
          getDraftedTeamAbbrs, getTotalDraftedCount,
          ...persisted
        } = state;
        return persisted;
      },
    },
  ),
);
