import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MAX_BOWL_SELECTIONS } from '@/types';

export default function BowlDraftScreen() {
  const allBowls      = useUniverseStore(s => s.allBowls);
  const setAllBowls   = useUniverseStore(s => s.setAllBowls);
  const selectedBowls = useUniverseStore(s => s.selectedBowls);
  const conferences   = useUniverseStore(s => s.conferences);
  const getTotalDraftedCount = useUniverseStore(s => s.getTotalDraftedCount);
  const addBowl       = useUniverseStore(s => s.addBowl);
  const removeBowl    = useUniverseStore(s => s.removeBowl);
  const reorderBowl   = useUniverseStore(s => s.reorderBowl);
  const setBowlTieIn  = useUniverseStore(s => s.setBowlTieIn);
  const setScreen     = useUniverseStore(s => s.setScreen);
  const showControls  = useUniverseStore(s => s.showControls);
  const setControlBindings = useUniverseStore(s => s.setControlBindings);

  const [activePanel, setActivePanel]   = useState<'left' | 'right'>('left');
  const [leftFocus,   setLeftFocus]     = useState(0);
  const [rightFocus,  setRightFocus]    = useState(0);
  const [expandedIdx, setExpandedIdx]   = useState<number | null>(null);
  const [search,      setSearch]        = useState('');

  // Load bowls.json on mount
  useEffect(() => {
    if (allBowls.length === 0) {
      fetch('/data/bowls.json').then(r => r.json()).then(setAllBowls).catch(console.error);
    }
  }, [allBowls.length, setAllBowls]);

  const selectedNames = useMemo(() => new Set(selectedBowls.map(s => s.bowl.name)), [selectedBowls]);
  const pool = useMemo(() => allBowls.filter(b => !selectedNames.has(b.name)), [allBowls, selectedNames]);
  const filteredPool = useMemo(() => {
    if (!search) return pool;
    const q = search.toLowerCase();
    return pool.filter(b => b.name.toLowerCase().includes(q));
  }, [pool, search]);

  useEffect(() => {
    setLeftFocus(i => Math.min(i, Math.max(0, filteredPool.length - 1)));
  }, [filteredPool.length]);

  useEffect(() => {
    setRightFocus(i => Math.min(i, Math.max(0, selectedBowls.length - 1)));
  }, [selectedBowls.length]);

  useEffect(() => {
    setControlBindings([
      { action: 'LB',       label: 'Pool panel' },
      { action: 'RB',       label: 'Selected bowls panel' },
      { action: 'dpadUp',   label: 'Navigate up' },
      { action: 'dpadDown', label: 'Navigate down' },
      ...(activePanel === 'left'
        ? [{ action: 'LT' as const, label: 'Page up' }, { action: 'RT' as const, label: 'Page down' }, { action: 'A' as const, label: 'Add bowl game' }]
        : [{ action: 'A' as const, label: 'Expand / collapse' }, { action: 'X' as const, label: 'Remove bowl game' }, { action: 'LT' as const, label: 'Move up' }, { action: 'RT' as const, label: 'Move down' }]),
      { action: 'B',        label: 'Back to OOC Rivalries' },
      { action: 'Start',    label: 'Continue to review' },
    ]);
  }, [activePanel, setControlBindings]);

  const totalDraftedCount = useMemo(() => getTotalDraftedCount(), [selectedBowls, getTotalDraftedCount]);
  const bowlOverflow = totalDraftedCount > 0 && selectedBowls.length * 2 > totalDraftedCount;
  const atLimit = selectedBowls.length >= MAX_BOWL_SELECTIONS;

  const confNames = useMemo(() => conferences.map(c => c.name).filter(Boolean), [conferences]);

  // Capacity enforcement — mirrors BowlTieInsScreen logic
  const confTeamCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const conf of conferences) {
      const count = conf.divisions
        .flatMap(d => d.teams)
        .filter((t): t is NonNullable<typeof t> => t != null).length;
      if (conf.name) map.set(conf.name, count);
    }
    return map;
  }, [conferences]);

  const confTieInTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const { tieIn } of selectedBowls) {
      const all = [
        tieIn.slot1Primary,
        ...(tieIn.slot1Backups ?? []),
        tieIn.slot2Primary,
        ...(tieIn.slot2Backups ?? []),
      ];
      for (const v of all) {
        if (v) map.set(v, (map.get(v) ?? 0) + 1);
      }
    }
    return map;
  }, [selectedBowls]);

  const getAvailableConfs = (bIdx: number, currentValue: string): string[] => {
    const entry = selectedBowls[bIdx];
    if (!entry) return confNames;
    const { tieIn } = entry;
    const usedInBowl = new Set<string>();
    const allInBowl = [
      tieIn.slot1Primary,
      ...(tieIn.slot1Backups ?? []),
      tieIn.slot2Primary,
      ...(tieIn.slot2Backups ?? []),
    ];
    for (const v of allInBowl) {
      if (v && v !== currentValue) usedInBowl.add(v);
    }
    return confNames.filter(name => {
      if (usedInBowl.has(name)) return false;
      const total    = confTieInTotals.get(name) ?? 0;
      const selfUsed = currentValue === name ? 1 : 0;
      const effective = total - selfUsed;
      const capacity  = confTeamCounts.get(name) ?? 0;
      if (effective >= capacity) return false;
      return true;
    });
  };

  useGamepad((action) => {
    if (showControls) return;
    if (action === 'LB') { setActivePanel('left'); return; }
    if (action === 'RB') { setActivePanel('right'); return; }
    if (action === 'Start') { setScreen('bowl-tie-ins'); return; }

    if (activePanel === 'left') {
      if (action === 'dpadUp')   setLeftFocus(i => Math.max(0, i - 1));
      else if (action === 'dpadDown') setLeftFocus(i => Math.min(filteredPool.length - 1, i + 1));
      else if (action === 'LT') setLeftFocus(i => Math.max(0, i - 8));
      else if (action === 'RT') setLeftFocus(i => Math.min(filteredPool.length - 1, i + 8));
      else if (action === 'A') {
        const bowl = filteredPool[leftFocus];
        if (bowl && !atLimit) addBowl(bowl);
      } else if (action === 'B') setScreen('ooc-rivalries');
    } else {
      if (action === 'dpadUp')   setRightFocus(i => Math.max(0, i - 1));
      else if (action === 'dpadDown') setRightFocus(i => Math.min(selectedBowls.length - 1, i + 1));
      else if (action === 'A') {
        setExpandedIdx(prev => prev === rightFocus ? null : rightFocus);
      } else if (action === 'X') {
        removeBowl(rightFocus);
        setExpandedIdx(null);
        setRightFocus(i => Math.min(i, Math.max(0, selectedBowls.length - 2)));
      } else if (action === 'LT') {
        if (rightFocus > 0) { reorderBowl(rightFocus, rightFocus - 1); setRightFocus(i => i - 1); }
      } else if (action === 'RT') {
        if (rightFocus < selectedBowls.length - 1) { reorderBowl(rightFocus, rightFocus + 1); setRightFocus(i => i + 1); }
      } else if (action === 'B') setScreen('ooc-rivalries');
    }
  });

  if (allBowls.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-mono text-xl">
        <div className="animate-pulse flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-primary" />
          LOADING BOWLS...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* ── Header ── */}
      <ScreenHeader
        step={8}
        totalSteps={10}
        title="Bowl Draft"
        cta="Select bowl games for your universe"
        onBack={() => setScreen('ooc-rivalries')}
        onContinue={() => setScreen('bowl-tie-ins')}
      />

      {/* ── Warning ── */}
      {bowlOverflow && (
        <div className="mx-6 mt-3 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-mono flex items-center gap-2">
          <span className="text-amber-400">!</span>
          {selectedBowls.length * 2} bowl slots vs {totalDraftedCount} drafted teams — some bowls may not fill
        </div>
      )}

      {/* ── Split panels ── */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left — Pool */}
        <div className={`w-[55%] flex flex-col border rounded-xl bg-card transition-all duration-300 ${activePanel === 'left' ? 'border-ring' : 'border-border/50 opacity-80'}`}>
          <div className="p-4 border-b border-border bg-background/50 rounded-t-xl shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black font-mono text-primary tracking-tight">BOWL POOL</h2>
              <span className="text-xs font-mono text-muted-foreground">{filteredPool.length} available</span>
            </div>
            <input
              type="text"
              placeholder="Search bowls…"
              value={search}
              onChange={e => { setSearch(e.target.value); setLeftFocus(0); }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredPool.map((bowl, idx) => {
              const isFocused = leftFocus === idx && activePanel === 'left';
              return (
                <button
                  key={bowl.name}
                  onClick={() => { setLeftFocus(idx); setActivePanel('left'); if (!atLimit) addBowl(bowl); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 ${isFocused ? 'border-ring bg-card/80 shadow-sm scale-[1.005]' : 'border-transparent hover:bg-muted/30'} ${atLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="font-mono font-bold text-sm">{bowl.name}</span>
                  <div className="flex items-center gap-2">
                    {bowl.indoors && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold">INDOORS</span>
                    )}
                    <span className="text-primary text-xs font-mono font-bold opacity-70">+ ADD</span>
                  </div>
                </button>
              );
            })}
            {filteredPool.length === 0 && (
              <div className="h-24 flex items-center justify-center text-muted-foreground font-mono text-sm">
                {search ? 'No bowls match search' : 'All bowls selected'}
              </div>
            )}
          </div>
        </div>

        {/* Right — Selection */}
        <div className={`w-[45%] flex flex-col border rounded-xl bg-card transition-all duration-300 ${activePanel === 'right' ? 'border-ring' : 'border-border/50 opacity-80'}`}>
          <div className="p-4 border-b border-border bg-background/50 rounded-t-xl shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black font-mono tracking-tight text-primary">SELECTED</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-mono font-black border ${atLimit ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-muted border-border text-muted-foreground'}`}>
                {selectedBowls.length} / {MAX_BOWL_SELECTIONS}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {selectedBowls.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground font-mono text-sm border-2 border-dashed border-border/30 rounded-xl m-2">
                No bowls selected — add from pool
              </div>
            ) : selectedBowls.map(({ bowl, tieIn }, idx) => {
              const isFocused = rightFocus === idx && activePanel === 'right';
              const isExpanded = expandedIdx === idx;
              return (
                <div
                  key={`${bowl.name}-${idx}`}
                  className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${isFocused ? 'border-ring bg-card shadow-md' : 'border-border/50 hover:border-border bg-card/40'}`}
                >
                  <button
                    onClick={() => { setRightFocus(idx); setActivePanel('right'); setExpandedIdx(prev => prev === idx ? null : idx); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 font-bold">#{idx + 1}</span>
                    <span className="font-mono font-bold text-sm flex-1 min-w-0 truncate">{bowl.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {bowl.indoors && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono">INDOORS</span>
                      )}
                      {/* Up/Down */}
                      <button
                        onClick={(e) => { e.stopPropagation(); if (idx > 0) { reorderBowl(idx, idx - 1); setRightFocus(idx - 1); } }}
                        disabled={idx === 0}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs transition-colors"
                      >▲</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (idx < selectedBowls.length - 1) { reorderBowl(idx, idx + 1); setRightFocus(idx + 1); } }}
                        disabled={idx === selectedBowls.length - 1}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs transition-colors"
                      >▼</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeBowl(idx); setExpandedIdx(null); }}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-400 text-xs transition-colors ml-1"
                      >✕</button>
                      <span className="text-muted-foreground/50 text-xs">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                  </button>

                  {/* Tie-in dropdowns */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/30 bg-background/30 grid grid-cols-2 gap-3">
                      {([
                        ['slot1Primary', 'Slot 1 Primary'],
                        ['slot2Primary', 'Slot 2 Primary'],
                      ] as [keyof typeof tieIn, string][]).map(([key, label]) => {
                        const current = (tieIn[key] as string) ?? '';
                        const opts = getAvailableConfs(idx, current);
                        return (
                          <div key={key}>
                            <label className="text-xs font-mono text-muted-foreground block mb-1">{label}</label>
                            <select
                              value={current}
                              onChange={e => setBowlTieIn(idx, { [key]: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                            >
                              <option value="">— None —</option>
                              {opts.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                              {current && !opts.includes(current) && (
                                <option value={current}>{current} ⚠ over cap</option>
                              )}
                            </select>
                          </div>
                        );
                      })}
                      <div className="col-span-2 text-xs text-muted-foreground/50 font-mono pt-1">
                        Add backups in the Bowl Tie-Ins step →
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
