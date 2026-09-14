import React, { useState, useMemo, useEffect } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { Team } from '@/types';

export default function RivalriesScreen() {
  const conferences   = useUniverseStore(s => s.conferences);
  const rivalries     = useUniverseStore(s => s.rivalries);
  const setRivalry    = useUniverseStore(s => s.setRivalry);
  const clearRivalry  = useUniverseStore(s => s.clearRivalry);
  const setScreen     = useUniverseStore(s => s.setScreen);
  const showControls  = useUniverseStore(s => s.showControls);
  const setControlBindings = useUniverseStore(s => s.setControlBindings);
  const drawerNavConf    = useUniverseStore(s => s.drawerNavConf);
  const setDrawerNavConf = useUniverseStore(s => s.setDrawerNavConf);

  const [confIdx, setConfIdx] = useState(() => {
    // If the drawer navigated here targeting a specific conference, start there.
    const nav = useUniverseStore.getState().drawerNavConf;
    return nav != null ? Math.max(0, Math.min(nav, useUniverseStore.getState().conferences.length - 1)) : 0;
  });
  const [divIdx,  setDivIdx]  = useState(0);
  const [teamIdx, setTeamIdx] = useState(0);
  // null = not in rival-select mode; string = abbr being previewed
  const [previewAbbr, setPreviewAbbr] = useState<string | null>(null);

  const conf      = conferences[confIdx];
  const divs      = conf?.divisions ?? [];
  const div       = divs[divIdx];
  const divTeams  = useMemo(
    () => (div?.teams ?? []).filter((t): t is NonNullable<typeof t> => t != null),
    [div],
  );
  const focusedTeam = divTeams[teamIdx] ?? null;

  // Build a per-team options map so every row uses its own filtered list.
  // Rules (applied per row team A):
  //   • must be in same division (divTeams is already division-scoped)
  //   • exclude A itself
  //   • exclude any team B where rivalries[B] exists AND rivalries[B] !== A
  //     (B is already committed to someone other than A)
  const rowOptionsMap = useMemo(() => {
    const map = new Map<string, Team[]>();
    for (const team of divTeams) {
      const opts = divTeams.filter(t => {
        if (t.abbreviation === team.abbreviation) return false;
        const theirRival = rivalries[t.abbreviation];
        if (theirRival && theirRival !== team.abbreviation) return false;
        return true;
      });
      map.set(team.abbreviation, opts);
    }
    return map;
  }, [divTeams, rivalries]);

  // Gamepad-facing alias — always the focused team's slice
  const rivalOptions: Team[] = focusedTeam
    ? (rowOptionsMap.get(focusedTeam.abbreviation) ?? [])
    : [];

  // If the drawer set a nav target, clear it from the store (we already consumed it in useState).
  // Also handle the case where drawerNavConf changes while we're already on this screen.
  useEffect(() => {
    if (drawerNavConf == null) return;
    setConfIdx(Math.max(0, Math.min(drawerNavConf, conferences.length - 1)));
    setDrawerNavConf(null);
  }, [drawerNavConf, conferences.length, setDrawerNavConf]);

  // Clear the store's drawerNavConf on mount (consumed by the useState initializer)
  useEffect(() => {
    setDrawerNavConf(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset team focus when conf/div changes
  useEffect(() => {
    setTeamIdx(0);
    setPreviewAbbr(null);
  }, [confIdx, divIdx]);

  useEffect(() => {
    setControlBindings([
      { action: 'LB',        label: 'Previous conference' },
      { action: 'RB',        label: 'Next conference' },
      { action: 'LT',        label: 'Previous division' },
      { action: 'RT',        label: 'Next division' },
      { action: 'dpadUp',    label: 'Navigate teams' },
      { action: 'dpadDown',  label: 'Navigate teams' },
      { action: 'dpadLeft',  label: 'Cycle rival options' },
      { action: 'dpadRight', label: 'Cycle rival options' },
      { action: 'A',         label: 'Pick rival / Confirm' },
      { action: 'X',         label: 'Clear rival' },
      { action: 'B',         label: 'Back / Cancel' },
      { action: 'Start',     label: 'Continue (when all set)' },
    ]);
  }, [setControlBindings]);

  // Progress
  const { assigned, total } = useMemo(() => {
    let assigned = 0, total = 0;
    for (const c of conferences) {
      for (const d of c.divisions) {
        const ts = d.teams.filter((t): t is NonNullable<typeof t> => t != null);
        if (ts.length < 2) continue;
        total += ts.length;
        for (const t of ts) if (rivalries[t.abbreviation]) assigned++;
      }
    }
    return { assigned, total };
  }, [conferences, rivalries]);
  const allDone = total > 0 && assigned === total;
  const pct     = total > 0 ? Math.round((assigned / total) * 100) : 0;

  const confCount = conferences.length;
  const divCount  = divs.length;

  const inRivalSelect = previewAbbr !== null;

  useGamepad((action) => {
    if (showControls) return;
    if (action === 'LB') {
      setConfIdx(i => (i - 1 + confCount) % confCount);
      setDivIdx(0); setPreviewAbbr(null);
    } else if (action === 'RB') {
      setConfIdx(i => (i + 1) % confCount);
      setDivIdx(0); setPreviewAbbr(null);
    } else if (action === 'Start' && allDone) {
      setScreen('ooc-rivalries');
    } else if (inRivalSelect) {
      // Left/right cycle rival options
      if (action === 'dpadLeft' || action === 'dpadRight') {
        if (rivalOptions.length === 0) return;
        const idx = rivalOptions.findIndex(t => t.abbreviation === previewAbbr);
        const next = action === 'dpadLeft'
          ? (idx - 1 + rivalOptions.length) % rivalOptions.length
          : (idx + 1) % rivalOptions.length;
        setPreviewAbbr(rivalOptions[next].abbreviation);
      } else if (action === 'A') {
        if (focusedTeam && previewAbbr) setRivalry(focusedTeam.abbreviation, previewAbbr);
        setPreviewAbbr(null);
      } else if (action === 'B') {
        setPreviewAbbr(null);
      }
    } else {
      if (action === 'dpadUp') {
        setTeamIdx(i => Math.max(0, i - 1));
      } else if (action === 'dpadDown') {
        setTeamIdx(i => Math.min(divTeams.length - 1, i + 1));
      } else if (action === 'LT') {
        setDivIdx(i => (i - 1 + divCount) % divCount);
        setPreviewAbbr(null);
      } else if (action === 'RT') {
        setDivIdx(i => (i + 1) % divCount);
        setPreviewAbbr(null);
      } else if (action === 'A') {
        if (focusedTeam && rivalOptions.length > 0) {
          const current = rivalries[focusedTeam.abbreviation];
          const start = current
            ? (rivalOptions.find(t => t.abbreviation === current)?.abbreviation ?? rivalOptions[0].abbreviation)
            : rivalOptions[0].abbreviation;
          setPreviewAbbr(start);
        }
      } else if (action === 'B') {
        if (focusedTeam && rivalries[focusedTeam.abbreviation]) {
          clearRivalry(focusedTeam.abbreviation);
        } else {
          setScreen('prestige-review');
        }
      } else if (action === 'X' && focusedTeam) {
        clearRivalry(focusedTeam.abbreviation);
      }
    }
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* ── Header ── */}
      <ScreenHeader
        step={6}
        totalSteps={10}
        title="Rivalries"
        cta="Set protected in-conference rivalries"
        requiredFields={[{ label: 'All rivals assigned', done: allDone }]}
        onBack={() => setScreen('prestige-review')}
        onContinue={() => setScreen('ooc-rivalries')}
      />
      {/* Rivalry progress (informational — rivalries are optional) */}
      <div className="flex items-center gap-4 px-6 py-2 border-b border-border/40 bg-card/20 shrink-0">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-mono font-bold whitespace-nowrap">
          <span className={allDone ? 'text-green-400' : 'text-primary'}>{assigned}</span>
          <span className="text-muted-foreground/50"> / {total} rivals</span>
          {allDone && total > 0 && <span className="text-green-400 ml-1">✓</span>}
        </span>
      </div>

      {/* ── Conference Tabs ── */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <ControllerBadge action="LB" active />
        {conferences.map((c, i) => {
          const confTeams = c.divisions.flatMap(d => d.teams.filter((t): t is NonNullable<typeof t> => t != null));
          const confDone  = confTeams.filter(t => t && rivalries[t.abbreviation]).length;
          const confTotal = confTeams.filter((_, idx) => {
            // only count teams in divisions with ≥2 members
            for (const d of c.divisions) {
              const members = d.teams.filter((tt): tt is NonNullable<typeof tt> => tt != null);
              if (members.some(m => m === confTeams[idx]) && members.length >= 2) return true;
            }
            return false;
          }).length;
          return (
            <button
              key={c.id}
              onClick={() => { setConfIdx(i); setDivIdx(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold font-mono transition-all whitespace-nowrap ${i === confIdx ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            >
              {c.name || `CONF ${i + 1}`}
              <span className="ml-2 text-xs opacity-70">
                {confDone}/{confTotal}
              </span>
            </button>
          );
        })}
        <ControllerBadge action="RB" active />
      </div>

      {/* ── Division Tabs ── */}
      <div className="flex items-center gap-2 px-6 pb-3">
        <ControllerBadge action="LT" active />
        {divs.map((d, i) => (
          <button
            key={i}
            onClick={() => setDivIdx(i)}
            className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all ${i === divIdx ? 'bg-primary/20 text-primary border border-primary/50' : 'text-muted-foreground hover:text-foreground border border-transparent'}`}
          >
            {d.name || `DIV ${i + 1}`}
          </button>
        ))}
        <ControllerBadge action="RT" active />
      </div>

      {/* ── Team List ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
        {divTeams.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground font-mono text-sm">
            No teams in this division
          </div>
        ) : divTeams.map((team, idx) => {
          const isFocused = idx === teamIdx;
          const confirmed = rivalries[team.abbreviation];
          const isPreviewingThis = isFocused && inRivalSelect;
          const displayRival = isPreviewingThis ? previewAbbr : (confirmed ?? null);
          // Per-row options — correct filtering for THIS team, not the focused one
          const rowOpts = rowOptionsMap.get(team.abbreviation) ?? [];

          return (
            <div
              key={team.abbreviation}
              onClick={() => {
                setTeamIdx(idx);
                if (rowOpts.length > 0 && !isPreviewingThis) {
                  const current = rivalries[team.abbreviation];
                  const start = current
                    ? (rowOpts.find(t => t.abbreviation === current)?.abbreviation ?? rowOpts[0].abbreviation)
                    : rowOpts[0].abbreviation;
                  setPreviewAbbr(start);
                }
              }}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                isFocused
                  ? isPreviewingThis
                    ? 'border-primary bg-primary/10'
                    : 'border-ring bg-card shadow-md scale-[1.01]'
                  : 'border-transparent hover:bg-muted/30 hover:border-border'
              }`}
            >
              {/* Color bar */}
              <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: team.primaryColor }} />

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-lg">{team.abbreviation}</span>
                  <span className="text-muted-foreground text-sm truncate">{team.name}</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  {team.state} · {team.archetype}
                </div>
              </div>

              {/* Rival display */}
              <div className="flex items-center gap-3 shrink-0">
                {isPreviewingThis ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const idx2 = rivalOptions.findIndex(t => t.abbreviation === previewAbbr);
                        setPreviewAbbr(rivalOptions[(idx2 - 1 + rivalOptions.length) % rivalOptions.length]?.abbreviation ?? null);
                      }}
                      className="w-7 h-7 rounded-full border border-primary/50 text-primary hover:bg-primary/20 flex items-center justify-center text-xs font-bold"
                    >◀</button>
                    <div className="text-center min-w-[80px]">
                      <div className="text-primary font-mono font-black text-sm animate-pulse">{displayRival}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">preview</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const idx2 = rivalOptions.findIndex(t => t.abbreviation === previewAbbr);
                        setPreviewAbbr(rivalOptions[(idx2 + 1) % rivalOptions.length]?.abbreviation ?? null);
                      }}
                      className="w-7 h-7 rounded-full border border-primary/50 text-primary hover:bg-primary/20 flex items-center justify-center text-xs font-bold"
                    >▶</button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (previewAbbr) setRivalry(team.abbreviation, previewAbbr);
                        setPreviewAbbr(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-black font-mono hover:bg-primary/90"
                    >CONFIRM</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewAbbr(null); }}
                      className="w-7 h-7 rounded-full border border-border text-muted-foreground hover:text-foreground flex items-center justify-center text-xs"
                    >✕</button>
                  </div>
                ) : displayRival ? (
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 font-mono font-bold text-sm">
                      {displayRival}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); clearRivalry(team.abbreviation); }}
                      className="w-6 h-6 rounded-full border border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-400/50 flex items-center justify-center text-xs"
                    >✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Native select for mouse users */}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setRivalry(team.abbreviation, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 rounded-lg border border-dashed border-border bg-background text-muted-foreground text-sm font-mono cursor-pointer hover:border-primary/50 focus:outline-none focus:border-primary"
                    >
                      <option value="" disabled>— SELECT —</option>
                      {rowOpts.map(r => (
                        <option key={r.abbreviation} value={r.abbreviation}>{r.abbreviation} — {r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
