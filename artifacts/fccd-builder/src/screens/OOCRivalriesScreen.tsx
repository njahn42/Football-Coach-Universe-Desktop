import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { Team, OOCRivalry } from '@/types';

type Step = 'list' | 'pickA' | 'pickB' | 'configure';

export default function OOCRivalriesScreen() {
  const conferences   = useUniverseStore(s => s.conferences);
  const oocRivalries  = useUniverseStore(s => s.oocRivalries);
  const addOOCRivalry = useUniverseStore(s => s.addOOCRivalry);
  const removeOOCRivalry = useUniverseStore(s => s.removeOOCRivalry);
  const setScreen     = useUniverseStore(s => s.setScreen);
  const showControls  = useUniverseStore(s => s.showControls);
  const setControlBindings = useUniverseStore(s => s.setControlBindings);

  const [step,  setStep]  = useState<Step>('list');
  const [listFocus, setListFocus] = useState(0);
  const [teamFocus, setTeamFocus] = useState(0);
  const [search, setSearch] = useState('');

  // Add-flow state
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [slot,    setSlot]    = useState(1);
  const [cadence, setCadence] = useState(1);
  const [offset,  setOffset]  = useState(0);
  const [stepperFocus, setStepperFocus] = useState(0); // 0=slot,1=cadence,2=offset

  // All drafted teams (deduplicated)
  const allDraftedTeams = useMemo(() => {
    const result: { team: Team; confName: string }[] = [];
    const seen = new Set<string>();
    for (const c of conferences) {
      for (const d of c.divisions) {
        for (const t of d.teams) {
          if (t != null && !seen.has(t.abbreviation)) {
            seen.add(t.abbreviation);
            result.push({ team: t, confName: c.name });
          }
        }
      }
    }
    return result.sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [conferences]);

  const filteredTeams = useMemo(() => {
    const pool = step === 'pickB'
      ? allDraftedTeams.filter(t => t.team.abbreviation !== teamA?.abbreviation)
      : allDraftedTeams;
    if (!search) return pool;
    const q = search.toLowerCase();
    return pool.filter(t => t.team.name.toLowerCase().includes(q) || t.team.abbreviation.toLowerCase().includes(q) || t.confName.toLowerCase().includes(q));
  }, [allDraftedTeams, search, step, teamA]);

  // Clamp teamFocus when filtered list changes
  useEffect(() => {
    setTeamFocus(i => Math.min(i, Math.max(0, filteredTeams.length - 1)));
  }, [filteredTeams.length]);

  useEffect(() => {
    setControlBindings([
      { action: 'Y',        label: 'Add OOC rivalry' },
      { action: 'dpadUp',   label: 'Navigate' },
      { action: 'dpadDown', label: 'Navigate' },
      { action: 'X',        label: 'Remove rivalry' },
      { action: 'B',        label: 'Back to rivalries' },
      { action: 'Start',    label: 'Continue to bowl draft' },
    ]);
  }, [setControlBindings]);

  function resetFlow() {
    setStep('list');
    setTeamA(null); setTeamB(null);
    setSlot(1); setCadence(1); setOffset(0);
    setSearch(''); setTeamFocus(0); setStepperFocus(0);
  }

  function confirmAdd() {
    if (!teamA || !teamB) return;
    addOOCRivalry({ teamA: teamA.abbreviation, teamB: teamB.abbreviation, preferredSlot: slot, cadence, offset });
    resetFlow();
  }

  const cadenceLabel = (n: number) => n === 1 ? 'EVERY YR' : `EVERY ${n} YRS`;

  useGamepad((action) => {
    if (showControls) return;
    if (step === 'list') {
      if (action === 'dpadUp')   setListFocus(i => Math.max(0, i - 1));
      else if (action === 'dpadDown') setListFocus(i => Math.min(oocRivalries.length - 1, i + 1));
      else if (action === 'X')   { if (oocRivalries.length > 0) removeOOCRivalry(listFocus); }
      else if (action === 'Y')   { setStep('pickA'); setSearch(''); setTeamFocus(0); }
      else if (action === 'B')   setScreen('rivalries');
      else if (action === 'Start') setScreen('bowl-draft');
    } else if (step === 'pickA' || step === 'pickB') {
      if (action === 'dpadUp')   setTeamFocus(i => Math.max(0, i - 1));
      else if (action === 'dpadDown') setTeamFocus(i => Math.min(filteredTeams.length - 1, i + 1));
      else if (action === 'A') {
        const picked = filteredTeams[teamFocus]?.team;
        if (!picked) return;
        if (step === 'pickA') { setTeamA(picked); setStep('pickB'); setSearch(''); setTeamFocus(0); }
        else { setTeamB(picked); setStep('configure'); setStepperFocus(0); }
      } else if (action === 'B') {
        if (step === 'pickA') resetFlow();
        else { setStep('pickA'); setTeamB(null); setSearch(''); setTeamFocus(0); }
      }
    } else if (step === 'configure') {
      if (action === 'dpadUp')   setStepperFocus(i => Math.max(0, i - 1));
      else if (action === 'dpadDown') setStepperFocus(i => Math.min(2, i + 1));
      else if (action === 'dpadLeft' || action === 'dpadRight') {
        const d = action === 'dpadLeft' ? -1 : 1;
        if (stepperFocus === 0) setSlot(s => Math.max(1, Math.min(15, s + d)));
        else if (stepperFocus === 1) {
          const nc = Math.max(1, Math.min(10, cadence + d));
          setCadence(nc);
          setOffset(o => Math.min(o, nc - 1));
        } else {
          setOffset(o => Math.max(0, Math.min(cadence - 1, o + d)));
        }
      } else if (action === 'A') confirmAdd();
      else if (action === 'B') { setStep('pickB'); setTeamB(null); }
    }
  });

  // Lookup team info for a rivalry entry
  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    for (const { team } of allDraftedTeams) m.set(team.abbreviation, team);
    return m;
  }, [allDraftedTeams]);

  const overlayShowing = step !== 'list';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative">
      {/* ── Header ── */}
      <ScreenHeader
        step={7}
        totalSteps={10}
        title="OOC Rivalries"
        cta="Add out-of-conference rivalry series (optional)"
        onBack={() => setScreen('rivalries')}
        onContinue={() => setScreen('bowl-draft')}
      />
      {/* Sub-bar: count + add button */}
      <div className="px-6 py-2 border-b border-border/40 bg-card/20 flex items-center justify-between shrink-0">
        <span className="text-xs font-mono text-muted-foreground">
          {oocRivalries.length === 0 ? 'No rivalries added yet' : `${oocRivalries.length} rivalry series configured`}
        </span>
        <button
          onClick={() => { setStep('pickA'); setSearch(''); setTeamFocus(0); }}
          className="px-4 py-1 rounded-full border border-primary text-primary font-mono font-black text-xs hover:bg-primary hover:text-primary-foreground transition-all"
        >
          + ADD RIVALRY
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {oocRivalries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl m-4">
            <div className="text-4xl opacity-30">⚔</div>
            <p className="font-mono text-sm">No OOC rivalries configured</p>
            <p className="text-xs opacity-70">Press Y or click Add Rivalry to create cross-conference series</p>
          </div>
        ) : oocRivalries.map((r, idx) => {
          const tA = teamMap.get(r.teamA);
          const tB = teamMap.get(r.teamB);
          const isFocused = idx === listFocus;
          return (
            <div
              key={idx}
              onClick={() => setListFocus(idx)}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${isFocused ? 'border-ring bg-card shadow-md' : 'border-border/50 hover:border-border hover:bg-muted/20'}`}
            >
              {/* Team A */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: tA?.primaryColor ?? '#666' }} />
                <div>
                  <div className="font-mono font-black">{r.teamA}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[100px]">{tA?.name ?? r.teamA}</div>
                </div>
              </div>

              <span className="text-muted-foreground font-bold text-sm shrink-0">vs</span>

              {/* Team B */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: tB?.primaryColor ?? '#666' }} />
                <div>
                  <div className="font-mono font-black">{r.teamB}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[100px]">{tB?.name ?? r.teamB}</div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-1 rounded-md bg-muted border border-border text-xs font-mono font-bold">SLOT {r.preferredSlot}</span>
                <span className="px-2 py-1 rounded-md bg-muted border border-border text-xs font-mono font-bold">{cadenceLabel(r.cadence)}</span>
                <span className="px-2 py-1 rounded-md bg-muted border border-border text-xs font-mono font-bold">YR {r.offset}</span>
              </div>

              {/* Remove */}
              <button
                onClick={(e) => { e.stopPropagation(); removeOOCRivalry(idx); }}
                className="w-8 h-8 rounded-full border border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-400/50 flex items-center justify-center text-sm shrink-0 transition-colors"
              >✕</button>
            </div>
          );
        })}
      </div>


      {/* ── Overlay ── */}
      {overlayShowing && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
          {/* Step indicator */}
          <div className="flex items-center gap-4 px-8 py-5 border-b border-border bg-card/50">
            {(['pickA', 'pickB', 'configure'] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 text-sm font-mono font-bold ${step === s ? 'text-primary' : 'text-muted-foreground/50'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'}`}>{i + 1}</span>
                  {s === 'pickA' ? 'TEAM A' : s === 'pickB' ? 'TEAM B' : 'SCHEDULE'}
                </div>
                {i < 2 && <div className="flex-1 h-px bg-border/50" />}
              </React.Fragment>
            ))}
            <button
              onClick={resetFlow}
              className="ml-auto w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 flex items-center justify-center text-sm transition-colors"
            >✕</button>
          </div>

          {/* Step content */}
          {(step === 'pickA' || step === 'pickB') && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-8 py-4 border-b border-border/50">
                <h2 className="text-lg font-black text-foreground mb-3">
                  {step === 'pickA' ? 'Select Team A' : `Select Team B — rival of ${teamA?.abbreviation}`}
                </h2>
                <input
                  type="text"
                  placeholder="Search teams…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setTeamFocus(0); }}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto px-8 py-3 space-y-1.5">
                {filteredTeams.map(({ team, confName }, idx) => {
                  const isFocused = idx === teamFocus;
                  return (
                    <button
                      key={team.abbreviation}
                      onClick={() => {
                        if (step === 'pickA') { setTeamA(team); setStep('pickB'); setSearch(''); setTeamFocus(0); }
                        else { setTeamB(team); setStep('configure'); setStepperFocus(0); }
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-150 ${isFocused ? 'border-ring bg-card shadow-md scale-[1.005]' : 'border-transparent hover:bg-muted/30'}`}
                    >
                      <div className="w-1.5 h-9 rounded-full shrink-0" style={{ backgroundColor: team.primaryColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black">{team.abbreviation}</span>
                          <span className="text-muted-foreground text-sm truncate">{team.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground/60 font-mono">{confName}</div>
                      </div>
                      <span className="text-2xl font-black font-mono text-muted-foreground/60 shrink-0">{team.rating}</span>
                    </button>
                  );
                })}
              </div>
              <div className="px-8 py-3 border-t border-border/50 flex items-center gap-4">
                <ControllerBadge action="dpadUp" label="NAV" active />
                <ControllerBadge action="dpadDown" label="NAV" active />
                <ControllerBadge action="A" label="SELECT" active />
                <ControllerBadge action="B" label="BACK" active />
              </div>
            </div>
          )}

          {step === 'configure' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
              {/* Selected pair */}
              <div className="flex items-center gap-6">
                {[teamA, teamB].map((t, i) => t && (
                  <React.Fragment key={t.abbreviation}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-12 rounded-full" style={{ backgroundColor: t.primaryColor }} />
                      <div>
                        <div className="font-mono font-black text-xl">{t.abbreviation}</div>
                        <div className="text-sm text-muted-foreground">{t.name}</div>
                      </div>
                    </div>
                    {i === 0 && <span className="text-muted-foreground font-bold">vs</span>}
                  </React.Fragment>
                ))}
              </div>

              {/* Steppers */}
              <div className="flex items-stretch gap-6">
                {([
                  { label: 'SLOT', value: slot, min: 1, max: 15, display: `Week ${slot}` },
                  { label: 'CADENCE', value: cadence, min: 1, max: 10, display: cadenceLabel(cadence) },
                  { label: 'OFFSET', value: offset, min: 0, max: cadence - 1, display: `Year ${offset}` },
                ] as const).map(({ label, value, min, max, display }, i) => {
                  const isFocused = stepperFocus === i;
                  const setFn = i === 0 ? setSlot : i === 1
                    ? (v: number) => { setCadence(v); setOffset(o => Math.min(o, v - 1)); }
                    : setOffset;
                  return (
                    <div
                      key={label}
                      onClick={() => setStepperFocus(i)}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border cursor-pointer transition-all duration-200 min-w-[130px] ${isFocused ? 'border-ring bg-card shadow-sm' : 'border-border bg-card/40 hover:border-border/80'}`}
                    >
                      <span className="text-xs font-mono font-bold text-muted-foreground tracking-widest">{label}</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); if (value > min) setFn(value - 1 as any); }}
                          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 font-bold transition-colors"
                        >-</button>
                        <span className={`text-2xl font-black font-mono w-16 text-center ${isFocused ? 'text-primary' : 'text-foreground'}`}>{value}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (value < max) setFn(value + 1 as any); }}
                          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/50 font-bold transition-colors"
                        >+</button>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono text-center">{display}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setStep('pickB'); setTeamB(null); }}
                  className="px-5 py-2 rounded-lg border border-border text-muted-foreground font-medium text-sm hover:border-foreground/40 hover:text-foreground transition-all"
                >
                  ◀ BACK
                </button>
                <button
                  onClick={confirmAdd}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition-all"
                >
                  ADD RIVALRY ⊕
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <ControllerBadge action="dpadUp" label="STEPPER" active />
                <ControllerBadge action="dpadDown" label="STEPPER" active />
                <ControllerBadge action="dpadLeft" label="ADJUST" active />
                <ControllerBadge action="dpadRight" label="ADJUST" active />
                <ControllerBadge action="A" label="CONFIRM" active />
                <ControllerBadge action="B" label="BACK" active />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
