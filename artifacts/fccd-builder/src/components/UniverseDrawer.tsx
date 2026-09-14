import { useEffect, useMemo } from 'react';
import { useUniverseStore } from '@/store';
import { usePrestige } from '@/hooks/usePrestige';
import { totalTeams } from '@/types';
import type { ScreenId } from '@/types';

// ─── Prestige colour helper (matches PrestigeReviewScreen) ───────────────────
function prestigeColor(level: number | null): string {
  if (level == null) return 'text-muted-foreground';
  if (level >= 8) return 'text-amber-400';
  if (level >= 5) return 'text-teal-400';
  return 'text-orange-500';
}

// ─── Screens where the drawer toggle is available ────────────────────────────
const DRAWER_SCREENS = new Set<ScreenId>([
  'draft-teams',
  'prestige-review',
  'rivalries',
  'ooc-rivalries',
  'bowl-draft',
  'bowl-tie-ins',
  'review-export',
]);

// ─── Component ────────────────────────────────────────────────────────────────
export function UniverseDrawer() {
  const currentScreen      = useUniverseStore(s => s.currentScreen);
  const showUniverseDrawer = useUniverseStore(s => s.showUniverseDrawer);
  const toggleUniverseDrawer = useUniverseStore(s => s.toggleUniverseDrawer);
  const closeUniverseDrawer  = useUniverseStore(s => s.closeUniverseDrawer);
  const setDrawerNavConf     = useUniverseStore(s => s.setDrawerNavConf);
  const setScreen            = useUniverseStore(s => s.setScreen);

  const conferences       = useUniverseStore(s => s.conferences);
  const rivalries         = useUniverseStore(s => s.rivalries);
  const selectedBowls     = useUniverseStore(s => s.selectedBowls);
  const prestigeOverrides = useUniverseStore(s => s.prestigeOverrides);

  const isAvailable = DRAWER_SCREENS.has(currentScreen);

  // Close drawer when navigating to a screen where it's not available
  useEffect(() => {
    if (!isAvailable) closeUniverseDrawer();
  }, [isAvailable, closeUniverseDrawer]);

  // Keyboard shortcut: Y (only when no input focused, only on available screens)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isAvailable) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        toggleUniverseDrawer();
      }
      if (e.key === 'Escape' && showUniverseDrawer) {
        closeUniverseDrawer();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAvailable, showUniverseDrawer, toggleUniverseDrawer, closeUniverseDrawer]);

  // Prestige levels via existing hook
  const prestigeInfos = usePrestige(conferences, prestigeOverrides);

  // ── Per-conference stats ──────────────────────────────────────────────────
  const confStats = useMemo(() => {
    return conferences.map((conf, idx) => {
      const total  = totalTeams(conf.layout);
      const filled = conf.divisions.reduce(
        (acc, d) => acc + d.teams.filter(t => t != null).length, 0,
      );

      // Rivalry completion: only count teams in divisions with ≥2 teams
      let totalForRivalry = 0;
      let withRival       = 0;
      for (const div of conf.divisions) {
        const divTeams = div.teams.filter((t): t is NonNullable<typeof t> => t != null);
        if (divTeams.length >= 2) {
          totalForRivalry += divTeams.length;
          withRival       += divTeams.filter(t => rivalries[t.abbreviation]).length;
        }
      }
      const rivalryPct = totalForRivalry > 0
        ? Math.round((withRival / totalForRivalry) * 100)
        : null;

      // Bowl tie-ins where this conference is the primary slot holder
      const bowlCount = selectedBowls.filter(bs =>
        bs.tieIn.slot1Primary === conf.name ||
        bs.tieIn.slot2Primary === conf.name,
      ).length;

      const prestige      = prestigeInfos.find(p => p.confId === conf.id)?.prestigeLevel ?? null;
      const hasEmptySlots = filled < total;
      const rivalryBad    = rivalryPct !== null && rivalryPct < 100;
      const hasWarning    = hasEmptySlots || rivalryBad;

      return { conf, idx, total, filled, rivalryPct, bowlCount, prestige, hasEmptySlots, rivalryBad, hasWarning };
    });
  }, [conferences, rivalries, selectedBowls, prestigeInfos]);

  // ── Global summary numbers ────────────────────────────────────────────────
  const totalFilled  = confStats.reduce((a, c) => a + c.filled, 0);
  const totalSlots   = confStats.reduce((a, c) => a + c.total, 0);
  const warningCount = confStats.filter(c => c.hasWarning).length;

  // ── Navigate to a conference ─────────────────────────────────────────────
  function navigateToConf(confIdx: number, hasEmpty: boolean) {
    setDrawerNavConf(confIdx);
    closeUniverseDrawer();
    if (hasEmpty) {
      setScreen('draft-teams');
    } else {
      setScreen('rivalries');
    }
  }

  if (!isAvailable) return null;

  return (
    <>
      {/* ── Backdrop ───────────────────────────────────────────────────────── */}
      {showUniverseDrawer && (
        <div
          className="fixed inset-0 z-[145] bg-background/60 backdrop-blur-sm"
          onClick={closeUniverseDrawer}
        />
      )}

      {/* ── Slide-in drawer ────────────────────────────────────────────────── */}
      <div
        className={`fixed right-0 top-0 h-full w-[340px] z-[146] flex flex-col bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          showUniverseDrawer ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Universe Map"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-background/60 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-black font-mono">◉</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-black font-mono uppercase tracking-widest text-foreground">
              Universe Map
            </h2>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
              {conferences.length} conference{conferences.length !== 1 ? 's' : ''} ·{' '}
              {totalFilled} / {totalSlots} slots filled
              {warningCount > 0 && (
                <span className="text-red-400 ml-1">· {warningCount} need attention</span>
              )}
            </p>
          </div>
          <button
            onClick={closeUniverseDrawer}
            className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none ml-auto shrink-0"
            aria-label="Close Universe Map"
          >
            ×
          </button>
        </div>

        {/* Conference list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
          {conferences.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-xs text-center px-8 opacity-60">
              No conferences drafted yet.
              <br />Set up conferences first.
            </div>
          ) : (
            confStats.map(({ conf, idx, total, filled, rivalryPct, bowlCount, prestige, hasEmptySlots, rivalryBad, hasWarning }) => {
              const fillPct = total > 0 ? (filled / total) * 100 : 0;
              const confLabel = conf.name || `Conference ${idx + 1}`;
              return (
                <button
                  key={conf.id}
                  onClick={() => navigateToConf(idx, hasEmptySlots)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 group hover:border-ring/60 hover:bg-muted/30 active:scale-[0.98] ${
                    hasWarning
                      ? 'border-red-500/30 bg-red-950/10'
                      : 'border-border/60 bg-background/40'
                  }`}
                >
                  {/* Top row: name + prestige + warning dot */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {hasWarning && (
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse mt-1" />
                      )}
                      <span className="font-bold text-sm leading-tight truncate">{confLabel}</span>
                    </div>
                    {prestige != null && (
                      <span className={`shrink-0 font-black font-mono text-lg leading-none ${prestigeColor(prestige)}`}>
                        {prestige}
                      </span>
                    )}
                  </div>

                  {/* Fill bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                        Teams
                      </span>
                      <span className={`text-[10px] font-mono font-bold tabular-nums ${
                        hasEmptySlots ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {filled} / {total}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-border/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          hasEmptySlots ? 'bg-red-500/60' : 'bg-green-500/70'
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Rivalry + Bowls row */}
                  <div className="flex items-center gap-3 mt-2.5">
                    {rivalryPct !== null && (
                      <div className={`flex items-center gap-1.5 text-[10px] font-mono font-bold ${
                        rivalryBad ? 'text-red-400' : 'text-green-400'
                      }`}>
                        <span>{rivalryBad ? '✕' : '✓'}</span>
                        <span>Rivals {rivalryPct}%</span>
                      </div>
                    )}
                    {rivalryPct !== null && bowlCount > 0 && (
                      <span className="text-muted-foreground/30 text-[10px]">·</span>
                    )}
                    {bowlCount > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                        <span>🏆</span>
                        <span>{bowlCount} bowl{bowlCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {rivalryPct === null && bowlCount === 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground/50">No teams yet</span>
                    )}
                  </div>

                  {/* Navigate hint */}
                  <div className="mt-2.5 text-[10px] font-mono text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors text-right">
                    → {hasEmptySlots ? 'Draft Teams' : 'Rivalries'}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer with keyboard hint */}
        <div className="px-5 py-3 border-t border-border/50 bg-background/40 shrink-0">
          <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-muted-foreground/50">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/60 text-[9px] font-bold">Y</kbd>
            <span>to toggle · click a card to navigate</span>
          </div>
        </div>
      </div>

      {/* ── Toggle FAB ─────────────────────────────────────────────────────── */}
      <button
        onClick={toggleUniverseDrawer}
        title="Universe Map (Y)"
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-[147] flex flex-col items-center gap-1 px-2.5 py-4 rounded-l-xl border border-r-0 border-border bg-card text-muted-foreground hover:text-foreground hover:border-ring/60 hover:bg-muted/50 transition-all duration-200 shadow-lg ${
          showUniverseDrawer ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${warningCount > 0 ? 'border-red-500/40' : ''}`}
        aria-label="Toggle Universe Map"
      >
        <span className="text-base">◉</span>
        <span className="text-[9px] font-black font-mono uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
          MAP
        </span>
        {warningCount > 0 && (
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        )}
      </button>
    </>
  );
}
