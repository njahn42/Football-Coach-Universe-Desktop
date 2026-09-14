import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useUniverseStore } from '@/store';
import { useDraftFilter } from '@/hooks/useDraftFilter';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TeamLogo } from '@/components/TeamLogo';
import { LAYOUT_LABELS, totalTeams, Team } from '@/types';

export default function DraftTeamsScreen() {
  const allTeams = useUniverseStore(s => s.allTeams);
  const setAllTeams = useUniverseStore(s => s.setAllTeams);
  const conferences = useUniverseStore(s => s.conferences);
  const conferenceCount = useUniverseStore(s => s.conferenceCount);
  const setScreen = useUniverseStore(s => s.setScreen);
  const setConferenceSetupIndex = useUniverseStore(s => s.setConferenceSetupIndex);
  const assignTeam = useUniverseStore(s => s.assignTeam);
  const removeTeamFromSlot = useUniverseStore(s => s.removeTeamFromSlot);
  const showControls = useUniverseStore(s => s.showControls);
  const setControlBindings = useUniverseStore(s => s.setControlBindings);
  
  const getDraftedTeamAbbrsFn = useUniverseStore(s => s.getDraftedTeamAbbrs);
  const getTotalDraftedCountFn = useUniverseStore(s => s.getTotalDraftedCount);
  const drawerNavConf  = useUniverseStore(s => s.drawerNavConf);
  const setDrawerNavConf = useUniverseStore(s => s.setDrawerNavConf);

  // Subscribe to reactive data via hooks pattern to ensure freshness
  const draftedTeamAbbrs = useMemo(() => getDraftedTeamAbbrsFn(), [conferences, getDraftedTeamAbbrsFn]);
  const draftedCount = useMemo(() => getTotalDraftedCountFn(), [conferences, getTotalDraftedCountFn]);
  const totalSlots = useMemo(() => conferences.reduce((acc, c) => acc + totalTeams(c.layout), 0), [conferences]);
  const completeConfs = useMemo(() => conferences.filter(c => {
    const total = totalTeams(c.layout);
    const filled = c.divisions.reduce((acc, d) => acc + d.teams.filter(t => t).length, 0);
    return total > 0 && total === filled;
  }).length, [conferences]);

  // Load data once
  useEffect(() => {
    if (allTeams.length === 0) {
      fetch('/data/teams.json')
        .then(r => r.json())
        .then(setAllTeams)
        .catch(console.error);
    }
  }, [allTeams.length, setAllTeams]);

  const pool = useMemo(() => allTeams.filter(t => !draftedTeamAbbrs.has(t.abbreviation)), [allTeams, draftedTeamAbbrs]);
  const { filters, filtered, cycleFilter, clearFilters } = useDraftFilter(pool);

  const [activePanel, setActivePanel] = useState<'left'|'right'>('left');
  const [leftFocusIndex, setLeftFocusIndex] = useState(0); 
  const [rightFocusIndex, setRightFocusIndex] = useState(0);
  
  const [expandedConfs, setExpandedConfs] = useState<Set<number>>(() => new Set(conferences.map((_, i) => i)));
  const [stagedTeam, setStagedTeam] = useState<Team | null>(null);

  type ConfSort = 'az' | 'za' | 'most' | 'least';
  const SORT_CYCLE: ConfSort[] = ['az', 'za', 'most', 'least'];
  const SORT_LABELS: Record<ConfSort, string> = { az: 'A–Z', za: 'Z–A', most: 'MOST', least: 'LEAST' };
  const [confSort, setConfSort] = useState<ConfSort>('az');
  const cycleSort = () => setConfSort(s => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length]);

  const handleBackFromDraft = () => {
    setConferenceSetupIndex((conferenceCount ?? 6) - 1);
    setScreen('conference-setup');
  };

  useEffect(() => {
    setControlBindings([
      { action: 'LB',       label: 'Switch panel' },
      { action: 'RB',       label: 'Switch panel' },
      { action: 'dpadUp',   label: 'Navigate up' },
      { action: 'dpadDown', label: 'Navigate down' },
      { action: 'A',        label: activePanel === 'left' ? 'Stage team' : (stagedTeam ? 'Assign to slot' : 'Remove from slot') },
      { action: 'B',        label: stagedTeam ? 'Unstage' : 'Back' },
      { action: 'Y',        label: activePanel === 'left' ? 'Reset filter' : `Sort: ${SORT_LABELS[confSort]}` },
      { action: 'Start',    label: 'Continue to prestige review' },
    ]);
  }, [activePanel, stagedTeam, confSort, setControlBindings]);

  const isCapped = totalSlots > 0 && draftedCount >= totalSlots;
  const canContinue = completeConfs === conferences.length && conferences.length > 0;

  type RightPanelItem =
    | { type: 'conf-header'; confIndex: number; conf: typeof conferences[0] }
    | { type: 'div-header'; confIndex: number; divIndex: number; name: string; conf: typeof conferences[0]; filled: number; total: number }
    | { type: 'slot'; confIndex: number; divIndex: number; slotIndex: number; team: Team | null; conf: typeof conferences[0] };

  const rightFocusItems = useMemo(() => {
    // Build sortable list with fill counts, preserving original indices
    const sortable = conferences.map((conf, cIdx) => ({
      conf,
      cIdx,
      name: conf.name || `Conference ${cIdx + 1}`,
      filled: conf.divisions.reduce((acc, d) => acc + d.teams.filter(t => t).length, 0),
    }));
    if (confSort === 'az') sortable.sort((a, b) => a.name.localeCompare(b.name));
    else if (confSort === 'za') sortable.sort((a, b) => b.name.localeCompare(a.name));
    else if (confSort === 'most') sortable.sort((a, b) => b.filled - a.filled);
    else if (confSort === 'least') sortable.sort((a, b) => a.filled - b.filled);

    const items: RightPanelItem[] = [];
    sortable.forEach(({ conf, cIdx }) => {
      items.push({ type: 'conf-header', confIndex: cIdx, conf });
      if (expandedConfs.has(cIdx)) {
        const numDivs = conf.divisions.length;
        const tpd = parseInt(conf.layout.split('x')[1], 10);
        conf.divisions.forEach((div, dIdx) => {
          if (numDivs > 1) {
            items.push({
              type: 'div-header',
              confIndex: cIdx,
              divIndex: dIdx,
              name: div.name?.trim() || `Division ${dIdx + 1}`,
              conf,
              filled: div.teams.filter(t => t).length,
              total: tpd,
            });
          }
          for (let sIdx = 0; sIdx < tpd; sIdx++) {
            items.push({ type: 'slot', confIndex: cIdx, divIndex: dIdx, slotIndex: sIdx, team: div.teams[sIdx] ?? null, conf });
          }
        });
      }
    });
    return items;
  }, [conferences, expandedConfs, confSort]);

  // Safety clamps for focus indexing
  useEffect(() => {
    const maxIdx = isCapped ? 3 : (3 + filtered.length);
    setLeftFocusIndex(i => Math.min(Math.max(0, i), maxIdx));
  }, [filtered.length, isCapped]);

  useEffect(() => {
    setRightFocusIndex(i => Math.min(Math.max(0, i), Math.max(0, rightFocusItems.length - 1)));
  }, [rightFocusItems.length]);

  const leftRefs = useRef<(HTMLElement | null)[]>([]);
  const rightRefs = useRef<(HTMLElement | null)[]>([]);
  // Used to scroll to a conference after the drawer navigates here
  const pendingScrollConf = useRef<number | null>(null);

  useEffect(() => {
    if (activePanel === 'left') {
      leftRefs.current[leftFocusIndex]?.focus({ preventScroll: true });
      leftRefs.current[leftFocusIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      rightRefs.current[rightFocusIndex]?.focus({ preventScroll: true });
      rightRefs.current[rightFocusIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activePanel, leftFocusIndex, rightFocusIndex]);

  // When the drawer navigates to this screen targeting a specific conference,
  // expand it, switch to the right panel, then scroll to it after the list rebuilds.
  useEffect(() => {
    if (drawerNavConf == null) return;
    pendingScrollConf.current = drawerNavConf;
    setExpandedConfs(prev => { const next = new Set(prev); next.add(drawerNavConf); return next; });
    setActivePanel('right');
    setDrawerNavConf(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerNavConf]);

  // After rightFocusItems rebuilds, scroll to the pending conference header.
  useEffect(() => {
    if (pendingScrollConf.current == null) return;
    const target = pendingScrollConf.current;
    pendingScrollConf.current = null;
    const idx = rightFocusItems.findIndex(
      item => item.type === 'conf-header' && item.confIndex === target,
    );
    if (idx >= 0) setRightFocusIndex(idx);
  }, [rightFocusItems]);

  useGamepad((action) => {
    if (showControls) return;
    if (action === 'LB' || action === 'RB') {
      setActivePanel(prev => prev === 'left' ? 'right' : 'left');
      return;
    }
    
    if (action === 'Start') {
      if (canContinue) setScreen('prestige-review');
      return;
    }

    if (activePanel === 'left') {
      if (action === 'dpadUp') {
        setLeftFocusIndex(i => Math.max(0, i - 1));
      } else if (action === 'dpadDown') {
        const maxIdx = isCapped ? 3 : (3 + filtered.length);
        setLeftFocusIndex(i => Math.min(maxIdx, i + 1));
      } else if (action === 'LT') {
        setLeftFocusIndex(i => Math.max(0, i - 8));
      } else if (action === 'RT') {
        const maxIdx = isCapped ? 3 : (3 + filtered.length);
        setLeftFocusIndex(i => Math.min(maxIdx, i + 8));
      } else if (action === 'dpadLeft') {
        if (leftFocusIndex === 0) cycleFilter('division', 'prev');
        else if (leftFocusIndex === 1) cycleFilter('state', 'prev');
        else if (leftFocusIndex === 2) cycleFilter('archetype', 'prev');
        else if (leftFocusIndex === 3) cycleFilter('fanbaseType', 'prev');
      } else if (action === 'dpadRight') {
        if (leftFocusIndex === 0) cycleFilter('division', 'next');
        else if (leftFocusIndex === 1) cycleFilter('state', 'next');
        else if (leftFocusIndex === 2) cycleFilter('archetype', 'next');
        else if (leftFocusIndex === 3) cycleFilter('fanbaseType', 'next');
      } else if (action === 'A') {
        if (leftFocusIndex === 0) cycleFilter('division', 'next');
        else if (leftFocusIndex === 1) cycleFilter('state', 'next');
        else if (leftFocusIndex === 2) cycleFilter('archetype', 'next');
        else if (leftFocusIndex === 3) cycleFilter('fanbaseType', 'next');
        else if (leftFocusIndex >= 4) {
          const team = filtered[leftFocusIndex - 4];
          if (team) {
            setStagedTeam(team);
            setActivePanel('right');
          }
        }
      } else if (action === 'B') {
        if (stagedTeam) {
          setStagedTeam(null);
        } else {
          handleBackFromDraft();
        }
      } else if (action === 'Y') {
        clearFilters();
        setLeftFocusIndex(0);
      }
    } else {
      if (action === 'dpadUp') {
        setRightFocusIndex(i => {
          let next = i - 1;
          while (next >= 0 && rightFocusItems[next]?.type === 'div-header') next -= 1;
          return Math.max(0, next);
        });
      } else if (action === 'dpadDown') {
        setRightFocusIndex(i => {
          let next = i + 1;
          const max = rightFocusItems.length - 1;
          while (next <= max && rightFocusItems[next]?.type === 'div-header') next += 1;
          return Math.min(max, next);
        });
      } else if (action === 'dpadLeft') {
        const item = rightFocusItems[rightFocusIndex];
        if (item) {
          if (item.type === 'conf-header') {
            setExpandedConfs(prev => {
              const next = new Set(prev);
              next.delete(item.confIndex);
              return next;
            });
          } else if (item.type === 'slot') {
            const headerIdx = rightFocusItems.findIndex(i => i.type === 'conf-header' && i.confIndex === item.confIndex);
            if (headerIdx !== -1) {
              setRightFocusIndex(headerIdx);
            }
          }
        }
      } else if (action === 'dpadRight') {
        const item = rightFocusItems[rightFocusIndex];
        if (item && item.type === 'conf-header') {
          setExpandedConfs(prev => {
            const next = new Set(prev);
            next.add(item.confIndex);
            return next;
          });
          // Move focus to the first real row after expanding (skip any div-header rows)
          let firstSlot = rightFocusIndex + 1;
          while (firstSlot < rightFocusItems.length && rightFocusItems[firstSlot]?.type === 'div-header') firstSlot += 1;
          if (firstSlot < rightFocusItems.length) setRightFocusIndex(firstSlot);
        }
      } else if (action === 'A') {
        const item = rightFocusItems[rightFocusIndex];
        if (item?.type === 'slot') {
          if (item.team) {
            removeTeamFromSlot(item.confIndex, item.divIndex, item.slotIndex);
          } else if (stagedTeam) {
            const poolIdx = filtered.findIndex(t => t.abbreviation === stagedTeam.abbreviation);
            const nextTeam = filtered[poolIdx + 1] ?? (poolIdx > 0 ? filtered[poolIdx - 1] : null) ?? null;
            assignTeam(stagedTeam, item.confIndex, item.divIndex, item.slotIndex);
            setStagedTeam(nextTeam);
            if (!nextTeam) setActivePanel('left');
            // leftFocusIndex stays: after pool shrinks, it naturally lands on the next entry
          }
        } else if (item?.type === 'conf-header') {
          setExpandedConfs(prev => {
            const next = new Set(prev);
            if (next.has(item.confIndex)) next.delete(item.confIndex);
            else next.add(item.confIndex);
            return next;
          });
        }
      } else if (action === 'Y') {
        cycleSort();
      } else if (action === 'B') {
        setActivePanel('left');
      }
    }
  });

  if (allTeams.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-mono text-xl">
        <div className="animate-pulse flex items-center gap-4">
          <div className="w-4 h-4 rounded-full bg-primary" />
          LOADING TEAMS...
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <ScreenHeader
        step={4}
        totalSteps={10}
        title="Draft Teams"
        cta="Assign teams from the pool into conference slots"
        requiredFields={[{ label: `All conferences filled (${completeConfs} / ${conferences.length})`, done: canContinue }]}
        onBack={handleBackFromDraft}
        onContinue={() => setScreen('prestige-review')}
      />
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* Left Panel - Team Pool */}
        <div className={`w-[62%] flex flex-col border-2 rounded-xl bg-card transition-all duration-300 ${activePanel === 'left' ? 'border-ring shadow-[0_0_20px_rgba(250,204,21,0.15)] relative z-10' : 'border-border/50 opacity-80 scale-[0.99]'}`}>
          <div className="p-5 border-b border-border bg-background/50 rounded-t-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-black font-mono tracking-tighter text-primary">TEAM POOL</h2>
              <div className="text-sm font-mono text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border">
                <span className="text-foreground font-bold text-base">{draftedCount} / {totalSlots}</span> DRAFTED
              </div>
            </div>
            
            <div className="flex gap-2 text-sm font-mono overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {[
                { key: 'division', label: 'DIV', val: filters.division || 'ALL' },
                { key: 'state', label: 'STATE', val: filters.state || 'ALL' },
                { key: 'archetype', label: 'ARCHETYPE', val: filters.archetype || 'ALL' },
                { key: 'fanbaseType', label: 'FANBASE', val: filters.fanbaseType || 'ALL' },
              ].map((f, i) => (
                <button
                  key={f.key}
                  ref={el => { leftRefs.current[i] = el; }}
                  onClick={() => {
                    setLeftFocusIndex(i);
                    setActivePanel('left');
                    cycleFilter(f.key as any, 'next');
                  }}
                  className={`flex-1 flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 rounded-lg border transition-all ${leftFocusIndex === i && activePanel === 'left' ? 'border-ring bg-primary/10 text-primary shadow-[0_0_15px_rgba(250,204,21,0.2)] scale-105 z-10' : 'border-border bg-background text-muted-foreground hover:bg-muted/30 hover:border-border/80'}`}
                  tabIndex={-1}
                >
                  <span className="opacity-60 text-xs sm:text-sm">{f.label}</span>
                  <span className="font-bold truncate max-w-[100px]">{f.val}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {isCapped ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-primary font-mono space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="text-7xl text-primary drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">★★★</div>
                <div className="text-3xl font-black tracking-widest uppercase">Draft Complete</div>
                <div className="text-muted-foreground text-lg bg-card/50 px-6 py-2 rounded-full border border-border">
                  All {totalSlots} Slots Filled
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono bg-muted/20 rounded-lg border border-dashed border-border m-4">
                NO TEAMS MATCH ACTIVE FILTERS
              </div>
            ) : (
              filtered.map((team, idx) => {
                const listIndex = idx + 4;
                const isFocused = leftFocusIndex === listIndex && activePanel === 'left';
                const isStaged = stagedTeam?.abbreviation === team.abbreviation;
                return (
                  <button
                    key={team.abbreviation}
                    ref={el => { leftRefs.current[listIndex] = el; }}
                    onClick={() => {
                      setLeftFocusIndex(listIndex);
                      setStagedTeam(team);
                      setActivePanel('right');
                    }}
                    className={`w-full flex items-center text-left p-3.5 rounded-xl border transition-all duration-200 ${isStaged ? 'border-ring bg-primary/20 shadow-[0_0_20px_rgba(250,204,21,0.3)] animate-pulse scale-[1.02] z-10' : isFocused ? 'border-ring bg-card/80 scale-[1.01] shadow-lg z-10' : 'border-transparent hover:bg-muted/50'}`}
                    tabIndex={-1}
                  >
                    <TeamLogo name={team.name} primaryColor={team.primaryColor} size={36} className="mr-3 rounded-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-xl">{team.abbreviation}</span>
                        <span className="text-muted-foreground text-sm truncate">{team.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono text-muted-foreground font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-background border border-border/50 text-foreground/80">{team.state}</span>
                        <span className="px-2 py-0.5 rounded-md bg-background border border-border/50 text-foreground/80">{team.division}</span>
                        <span className="px-2 py-0.5 rounded-md bg-background border border-border/50 truncate max-w-[150px]">{team.archetype}</span>
                      </div>
                    </div>
                    <div className="text-3xl font-black font-mono tracking-tighter w-16 text-right drop-shadow-sm opacity-90">
                      {team.rating}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Slot Tree */}
        <div className={`w-[38%] flex flex-col border-2 rounded-xl bg-card transition-all duration-300 ${activePanel === 'right' ? 'border-ring shadow-[0_0_20px_rgba(250,204,21,0.15)] relative z-10' : 'border-border/50 opacity-80 scale-[0.99]'}`}>
          <div className="p-5 border-b border-border bg-background/50 rounded-t-xl shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold font-mono tracking-tight text-primary">CONFERENCES</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={cycleSort}
                  className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border transition-colors ${activePanel === 'right' ? 'border-ring/60 bg-ring/10 text-foreground hover:bg-ring/20' : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60'}`}
                >
                  {SORT_LABELS[confSort]} ▸
                </button>
                <span className={`text-sm font-bold px-3 py-1 rounded-md border ${completeConfs === conferences.length ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-muted/50 text-muted-foreground border-border'}`}>
                  {completeConfs} / {conferences.length} DONE
                </span>
              </div>
            </div>
            {stagedTeam ? (
              <div className="bg-primary/10 border border-primary/50 text-primary text-sm p-3 rounded-lg font-mono flex items-center gap-3 animate-in fade-in slide-in-from-top-1 shadow-[0_0_10px_rgba(250,204,21,0.1)]">
                <span className="animate-pulse bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center rounded-full text-xs">▶</span> 
                <span className="opacity-80">STAGED:</span> 
                <span className="font-bold text-base tracking-wider">{stagedTeam.abbreviation}</span>
              </div>
            ) : (
              <div className="bg-background border border-dashed border-border text-muted-foreground text-sm p-3 rounded-lg font-mono flex items-center justify-center opacity-70">
                SELECT A TEAM FROM POOL
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {rightFocusItems.map((item, idx) => {
              const isFocused = rightFocusIndex === idx && activePanel === 'right';
              
              if (item.type === 'div-header') {
                const divFull = item.filled === item.total;
                return (
                  <div
                    key={`div-header-${item.confIndex}-${item.divIndex}`}
                    className="px-4 pt-2 pb-0.5 flex items-center gap-2"
                    aria-hidden="true"
                  >
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/60">
                      {item.name}
                    </span>
                    <div className="flex-1 h-px bg-border/30" />
                    <span className={`text-[10px] font-mono font-bold tabular-nums ${divFull ? 'text-green-400' : 'text-muted-foreground/60'}`}>
                      {item.filled} / {item.total}
                    </span>
                  </div>
                );
              } else if (item.type === 'conf-header') {
                const filled = item.conf.divisions.reduce((acc, d) => acc + d.teams.filter(t => t).length, 0);
                const total = totalTeams(item.conf.layout);
                const isFull = filled === total;
                const isExpanded = expandedConfs.has(item.confIndex);
                
                return (
                  <button
                    key={`conf-${item.confIndex}`}
                    ref={el => { rightRefs.current[idx] = el; }}
                    onClick={() => {
                      setRightFocusIndex(idx);
                      setActivePanel('right');
                      setExpandedConfs(prev => {
                        const next = new Set(prev);
                        if (next.has(item.confIndex)) next.delete(item.confIndex);
                        else next.add(item.confIndex);
                        return next;
                      });
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all mt-6 first:mt-0 ${isFocused ? 'border-ring bg-muted shadow-md scale-[1.02] z-10' : 'border-border bg-background hover:bg-muted/30'}`}
                    tabIndex={-1}
                  >
                    <div className="flex items-center gap-3">
                       <span className="font-mono text-muted-foreground text-xs w-5 flex items-center justify-center opacity-60">
                         {isExpanded ? '▼' : '▶'}
                       </span>
                       <span className="font-bold tracking-tight">{item.conf.name || `Conference ${item.confIndex + 1}`}</span>
                       <span className="px-2 py-0.5 bg-card border border-border/50 rounded-md text-[10px] font-mono font-bold text-muted-foreground">
                         {LAYOUT_LABELS[item.conf.layout]}
                       </span>
                    </div>
                    <div className={`font-mono text-sm font-black tracking-wider ${isFull ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'text-primary'}`}>
                      {filled} / {total}
                    </div>
                  </button>
                )
              } else {
                // Slot
                const isEmpty = !item.team;
                return (
                  <button
                    key={`slot-${item.confIndex}-${item.divIndex}-${item.slotIndex}`}
                    ref={el => { rightRefs.current[idx] = el; }}
                    onClick={() => {
                      setRightFocusIndex(idx);
                      setActivePanel('right');
                      if (item.team) {
                        removeTeamFromSlot(item.confIndex, item.divIndex, item.slotIndex);
                      } else if (stagedTeam) {
                        const poolIdx = filtered.findIndex(t => t.abbreviation === stagedTeam.abbreviation);
                        const nextTeam = filtered[poolIdx + 1] ?? (poolIdx > 0 ? filtered[poolIdx - 1] : null) ?? null;
                        assignTeam(stagedTeam, item.confIndex, item.divIndex, item.slotIndex);
                        setStagedTeam(nextTeam);
                        if (!nextTeam) setActivePanel('left');
                      }
                    }}
                    className={`w-full flex items-center p-2.5 pl-12 rounded-lg border transition-all duration-200
                      ${isFocused ? 'border-ring bg-card/90 scale-[1.02] shadow-lg z-20 relative' : 'border-transparent hover:bg-muted/40'}
                      ${isEmpty && stagedTeam && isFocused ? 'bg-primary/20 border-primary border-dashed shadow-[0_0_15px_rgba(250,204,21,0.2)]' : ''}
                      ${isEmpty && !stagedTeam ? 'opacity-60 hover:opacity-100' : ''}
                    `}
                    tabIndex={-1}
                  >
                    {isEmpty ? (
                      <div className="flex items-center gap-2 text-muted-foreground font-mono text-[13px] font-bold">
                        <span className="opacity-50 tracking-[0.2em]">[EMPTY SLOT {item.slotIndex + 1}]</span>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <TeamLogo name={item.team!.name} primaryColor={item.team!.primaryColor} size={24} className="rounded-sm" />
                          <span className="font-mono font-black text-lg">{item.team!.abbreviation}</span>
                          <span className="text-muted-foreground truncate max-w-[110px] text-xs font-medium">{item.team!.name}</span>
                        </div>
                        <span className="font-mono font-black text-xl tracking-tighter opacity-90">{item.team!.rating}</span>
                      </div>
                    )}
                  </button>
                )
              }
            })}
          </div>
        </div>

      </div>
      
    </div>
  );
}
