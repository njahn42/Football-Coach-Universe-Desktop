import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad, useGamepadConnected } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { BowlTieIn } from '@/types';

const MAX_BACKUPS = 5; // max backup conferences per slot (reference shows up to 4–5)

function totalAssigned(tieIn: BowlTieIn): number {
  return (tieIn.slot1Primary ? 1 : 0)
    + (tieIn.slot1Backups?.filter(Boolean).length ?? 0)
    + (tieIn.slot2Primary ? 1 : 0)
    + (tieIn.slot2Backups?.filter(Boolean).length ?? 0);
}

export default function BowlTieInsScreen() {
  const conferences        = useUniverseStore(s => s.conferences);
  const selectedBowls      = useUniverseStore(s => s.selectedBowls);
  const setBowlTieIn       = useUniverseStore(s => s.setBowlTieIn);
  const setScreen          = useUniverseStore(s => s.setScreen);
  const showControls       = useUniverseStore(s => s.showControls);
  const setControlBindings = useUniverseStore(s => s.setControlBindings);

  const gamepadConnected = useGamepadConnected();

  const [bowlIdx,    setBowlIdx]    = useState(0);
  const [slotFocus,  setSlotFocus]  = useState<0 | 1>(0); // 0 = SLOT 1, 1 = SLOT 2
  // entryFocus: 0 = primary, 1..backups.length = backup[i-1], backups.length+1 = "+ Add backup"
  const [entryFocus, setEntryFocus] = useState(0);

  const bowlCount   = selectedBowls.length;
  const focusedBowl = selectedBowls[bowlIdx] ?? null;

  // Teams per conference
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

  const confNames = useMemo(
    () => [...confTeamCounts.keys()].sort(),
    [confTeamCounts],
  );

  // Total tie-in slots used per conference across all bowls (primaries + all backups)
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

  // Available conferences for a given cell, given its current value
  // Enforces: per-bowl uniqueness + per-conf capacity
  const getAvailableConfs = useCallback((bIdx: number, currentValue: string): string[] => {
    const entry = selectedBowls[bIdx];
    if (!entry) return [];
    const { tieIn } = entry;

    // All confs currently assigned anywhere in this bowl (except this cell's own value)
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
  }, [selectedBowls, confNames, confTieInTotals, confTeamCounts]);

  useEffect(() => {
    setBowlIdx(i => Math.min(i, Math.max(0, bowlCount - 1)));
  }, [bowlCount]);

  // Clamp entryFocus when the focused slot's entry list shrinks.
  // When the primary is cleared, always reset to 0 so focus never lands on
  // a backup entry while the "+ Add backup" row is invisible (orphaned focus).
  useEffect(() => {
    if (!focusedBowl) return;
    const backupsKey: keyof BowlTieIn = slotFocus === 0 ? 'slot1Backups' : 'slot2Backups';
    const primaryKey: keyof BowlTieIn = slotFocus === 0 ? 'slot1Primary' : 'slot2Primary';
    const backups = (focusedBowl.tieIn[backupsKey] as string[] | undefined) ?? [];
    const primary = (focusedBowl.tieIn[primaryKey] as string) ?? '';
    if (!primary) {
      // Primary was cleared — snap focus back to the primary row so the user
      // is never left on a backup while canAddBackup is false.
      setEntryFocus(0);
      return;
    }
    const canAddBackup = backups.length < MAX_BACKUPS;
    const maxEntry = canAddBackup ? backups.length + 1 : backups.length;
    setEntryFocus(e => Math.min(e, maxEntry));
  }, [focusedBowl, slotFocus]);

  useEffect(() => {
    setControlBindings([
      { action: 'LB',       label: 'Previous bowl' },
      { action: 'RB',       label: 'Next bowl' },
      { action: 'dpadUp',   label: 'Previous entry' },
      { action: 'dpadDown', label: 'Next entry' },
      { action: 'dpadLeft', label: 'Cycle conference ◀' },
      { action: 'dpadRight',label: 'Cycle conference ▶' },
      { action: 'A',        label: 'Add backup' },
      { action: 'X',        label: 'Clear primary' },
      { action: 'Y',        label: 'Remove backup' },
      { action: 'B',        label: 'Back to Bowl Draft' },
      { action: 'Start',    label: 'Continue to Review' },
    ]);
  }, [setControlBindings]);

  useGamepad((action) => {
    if (showControls) return;
    if (action === 'Start') { setScreen('review-export'); return; }
    if (action === 'B')     { setScreen('bowl-draft');    return; }
    if (action === 'LB') {
      setBowlIdx(i => Math.max(0, i - 1));
      setSlotFocus(0);
      setEntryFocus(0);
      return;
    }
    if (action === 'RB') {
      setBowlIdx(i => Math.min(bowlCount - 1, i + 1));
      setSlotFocus(0);
      setEntryFocus(0);
      return;
    }

    if (!focusedBowl) return;

    // Derive current slot data
    const primaryKey: keyof BowlTieIn = slotFocus === 0 ? 'slot1Primary' : 'slot2Primary';
    const backupsKey: keyof BowlTieIn = slotFocus === 0 ? 'slot1Backups' : 'slot2Backups';
    const primary = (focusedBowl.tieIn[primaryKey] as string) ?? '';
    const backups = (focusedBowl.tieIn[backupsKey] as string[] | undefined) ?? [];
    const canAddBackup = !!primary && backups.length < MAX_BACKUPS;
    const addBackupEntryIdx = backups.length + 1;
    const maxEntry = canAddBackup ? addBackupEntryIdx : backups.length;

    // ── dpadUp / dpadDown: navigate entries within a slot, jump between slots at boundaries ──
    if (action === 'dpadUp') {
      if (entryFocus > 0) {
        setEntryFocus(e => e - 1);
      } else if (slotFocus === 1) {
        // Jump to slot 1's last entry
        const s1Backups = (focusedBowl.tieIn.slot1Backups as string[] | undefined) ?? [];
        const s1Primary = (focusedBowl.tieIn.slot1Primary as string) ?? '';
        const s1CanAdd  = !!s1Primary && s1Backups.length < MAX_BACKUPS;
        const s1Max     = s1CanAdd ? s1Backups.length + 1 : s1Backups.length;
        setSlotFocus(0);
        setEntryFocus(s1Max);
      }
      return;
    }

    if (action === 'dpadDown') {
      if (entryFocus < maxEntry) {
        setEntryFocus(e => e + 1);
      } else if (slotFocus === 0) {
        // Jump to slot 2's first entry
        setSlotFocus(1);
        setEntryFocus(0);
      }
      return;
    }

    // ── dpadLeft / dpadRight: cycle the conference for whichever entry is focused ──
    if (action === 'dpadLeft' || action === 'dpadRight') {
      // Guard: if focus is beyond the current max (e.g. primary was just cleared
      // and the clamp effect hasn't fired yet), snap to 0 instead of a silent no-op.
      if (entryFocus > maxEntry) {
        setEntryFocus(0);
        return;
      }
      if (entryFocus === 0) {
        // Cycle primary
        const opts = getAvailableConfs(bowlIdx, primary);
        if (opts.length === 0) return;
        const curIdx = primary ? opts.indexOf(primary) : -1;
        if (action === 'dpadLeft') {
          const next = curIdx <= 0 ? opts.length - 1 : curIdx - 1;
          setBowlTieIn(bowlIdx, { [primaryKey]: opts[next] });
        } else {
          const next = curIdx >= opts.length - 1 ? 0 : curIdx + 1;
          setBowlTieIn(bowlIdx, { [primaryKey]: opts[next] });
        }
      } else if (entryFocus <= backups.length) {
        // Cycle backup[bi]
        const bi = entryFocus - 1;
        const currentBackup = backups[bi] ?? '';
        const opts = getAvailableConfs(bowlIdx, currentBackup);
        if (opts.length === 0) return;
        const curIdx = currentBackup ? opts.indexOf(currentBackup) : -1;
        const newBackups = [...backups];
        if (action === 'dpadLeft') {
          const next = curIdx <= 0 ? opts.length - 1 : curIdx - 1;
          newBackups[bi] = opts[next];
        } else {
          const next = curIdx >= opts.length - 1 ? 0 : curIdx + 1;
          newBackups[bi] = opts[next];
        }
        setBowlTieIn(bowlIdx, { [backupsKey]: newBackups });
      }
      // On the "+ Add backup" row, dpad L/R does nothing
      return;
    }

    // ── X: clear primary (only when primary row is focused) ──
    if (action === 'X') {
      if (entryFocus === 0) {
        setBowlTieIn(bowlIdx, { [primaryKey]: '' });
      }
      return;
    }

    // ── Y: remove the focused backup entry ──
    if (action === 'Y') {
      if (entryFocus > 0 && entryFocus <= backups.length) {
        const bi = entryFocus - 1;
        setBowlTieIn(bowlIdx, { [backupsKey]: backups.filter((_, i) => i !== bi) });
        setEntryFocus(e => Math.max(0, e - 1));
      }
      return;
    }

    // ── A: add backup (only when "+ Add backup" row is focused) ──
    if (action === 'A') {
      if (entryFocus === addBackupEntryIdx && canAddBackup) {
        const opts = getAvailableConfs(bowlIdx, '');
        if (opts.length === 0) return;
        setBowlTieIn(bowlIdx, { [backupsKey]: [...backups, opts[0]] });
        // Advance focus to the newly added backup
        setEntryFocus(backups.length + 1);
      }
      return;
    }
  });

  // ── Slot section renderer ───────────────────────────────────────────────────
  const renderSlot = (slotNum: 1 | 2) => {
    if (!focusedBowl) return null;
    const isFocused  = slotFocus === (slotNum - 1);
    const primaryKey: keyof BowlTieIn = slotNum === 1 ? 'slot1Primary' : 'slot2Primary';
    const backupsKey: keyof BowlTieIn = slotNum === 1 ? 'slot1Backups' : 'slot2Backups';
    const { tieIn } = focusedBowl;
    const primary = (tieIn[primaryKey] as string) ?? '';
    const backups = (tieIn[backupsKey] as string[] | undefined) ?? [];

    const primaryOpts  = getAvailableConfs(bowlIdx, primary);
    const canAddBackup = !!primary && backups.length < MAX_BACKUPS;
    const addBackupEntryIdx = backups.length + 1;

    const addBackup = () => {
      const opts = getAvailableConfs(bowlIdx, '');
      if (opts.length === 0) return;
      setBowlTieIn(bowlIdx, { [backupsKey]: [...backups, opts[0]] });
    };

    const updateBackup = (idx: number, value: string) => {
      const next = [...backups];
      next[idx] = value;
      setBowlTieIn(bowlIdx, { [backupsKey]: next });
    };

    const removeBackup = (idx: number) => {
      setBowlTieIn(bowlIdx, { [backupsKey]: backups.filter((_, i) => i !== idx) });
    };

    // Whether a given entry index is the gamepad-focused one
    const isEntryFocused = (ei: number) => isFocused && entryFocus === ei;

    return (
      <div
        key={`slot-${slotNum}`}
        onClick={() => { setSlotFocus((slotNum - 1) as 0 | 1); setEntryFocus(0); }}
        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
          isFocused
            ? 'border-ring bg-card shadow-md'
            : 'border-border/40 bg-background/30 hover:border-border'
        }`}
      >
        {/* Section label */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-mono font-black text-muted-foreground tracking-widest">
            SLOT {slotNum}
          </span>
          <div className="flex-1 h-px bg-border/40" />
          {isFocused && (
            <span className="text-xs text-muted-foreground/50 font-mono">
              ↑↓ entry · ◀▶ cycle · X clear · Y remove · A add
            </span>
          )}
        </div>

        {/* Primary */}
        <div
          className={`mb-3 rounded-lg transition-all ${
            isEntryFocused(0)
              ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
              : ''
          }`}
          onClick={e => { e.stopPropagation(); setSlotFocus((slotNum - 1) as 0 | 1); setEntryFocus(0); }}
        >
          <div className="flex items-center justify-between mb-1 px-0.5">
            <span className="text-xs font-mono text-muted-foreground">Primary</span>
            {primary && (
              <button
                onClick={e => { e.stopPropagation(); setBowlTieIn(bowlIdx, { [primaryKey]: '' }); }}
                className="text-muted-foreground/50 hover:text-red-400 text-xs transition-colors"
                title="Clear primary"
              >✕</button>
            )}
          </div>
          <select
            value={primary}
            onChange={e => {
              setSlotFocus((slotNum - 1) as 0 | 1);
              setEntryFocus(0);
              setBowlTieIn(bowlIdx, { [primaryKey]: e.target.value });
            }}
            onClick={e => e.stopPropagation()}
            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:border-primary"
          >
            <option value="">— AT-LARGE —</option>
            {primaryOpts.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
            {primary && !primaryOpts.includes(primary) && (
              <option value={primary}>{primary} ⚠ over cap</option>
            )}
          </select>
        </div>

        {/* Backup list */}
        {backups.length > 0 && (
          <div className="space-y-2 mb-3">
            {backups.map((backup, bi) => {
              const backupOpts = getAvailableConfs(bowlIdx, backup);
              const ei = bi + 1; // entry index for this backup
              return (
                <div
                  key={bi}
                  className={`flex items-center gap-2 rounded-lg transition-all ${
                    isEntryFocused(ei)
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                      : ''
                  }`}
                  onClick={e => { e.stopPropagation(); setSlotFocus((slotNum - 1) as 0 | 1); setEntryFocus(ei); }}
                >
                  <span className="text-xs font-mono text-muted-foreground/60 w-16 shrink-0">
                    Backup {bi + 1}
                  </span>
                  <select
                    value={backup}
                    onChange={e => { e.stopPropagation(); updateBackup(bi, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:border-primary"
                  >
                    <option value="">— select —</option>
                    {backupOpts.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    {backup && !backupOpts.includes(backup) && (
                      <option value={backup}>{backup} ⚠ over cap</option>
                    )}
                  </select>
                  {gamepadConnected && isEntryFocused(ei) && (
                    <ControllerBadge action="Y" active />
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); removeBackup(bi); }}
                    className="w-6 h-6 flex items-center justify-center text-muted-foreground/50 hover:text-red-400 transition-colors text-xs shrink-0"
                    title="Remove backup"
                  >✕</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add backup */}
        {canAddBackup && (
          <button
            onClick={e => { e.stopPropagation(); addBackup(); }}
            className={`w-full py-1.5 rounded-lg border border-dashed text-xs font-mono transition-all flex items-center justify-center gap-2 ${
              isEntryFocused(addBackupEntryIdx)
                ? 'border-primary text-primary bg-primary/5 ring-2 ring-primary ring-offset-1 ring-offset-background'
                : 'border-border/50 text-muted-foreground/60 hover:border-primary/50 hover:text-primary'
            }`}
          >
            {gamepadConnected && isEntryFocused(addBackupEntryIdx) && (
              <ControllerBadge action="A" active />
            )}
            + Add backup
          </button>
        )}

        {!primary && backups.length === 0 && (
          <p className="text-xs text-muted-foreground/40 font-mono">No primary set — slot is at-large</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <ScreenHeader
        step={9}
        totalSteps={10}
        title="Bowl Tie-Ins"
        cta="Assign conference tie-ins to each bowl game"
        onBack={() => setScreen('bowl-draft')}
        onContinue={() => setScreen('review-export')}
      />

      {selectedBowls.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono text-sm">
          No bowl games selected — go back and add some
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden p-4 gap-4">

          {/* ── Left: Bowl list ── */}
          <div className="w-[30%] flex flex-col border border-border/50 rounded-xl bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-background/50 shrink-0 flex items-center gap-2">
              <ControllerBadge action="LB" active />
              <h2 className="text-xs font-black font-mono text-primary tracking-widest flex-1">BOWL GAMES</h2>
              <ControllerBadge action="RB" active />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {selectedBowls.map(({ bowl, tieIn }, idx) => {
                const count    = totalAssigned(tieIn);
                const isActive = idx === bowlIdx;
                return (
                  <button
                    key={bowl.name}
                    onClick={() => { setBowlIdx(idx); setSlotFocus(0); setEntryFocus(0); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                      isActive
                        ? 'border-ring bg-card shadow-sm'
                        : 'border-transparent hover:bg-muted/30'
                    }`}
                  >
                    <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                    <span className="font-mono font-bold text-xs flex-1 min-w-0 truncate">{bowl.name}</span>
                    <span className={`text-xs font-mono font-black ${
                      count > 0 ? 'text-primary' : 'text-muted-foreground/30'
                    }`}>{count > 0 ? count : '—'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: Slot editor ── */}
          <div className="flex-1 flex flex-col border border-ring rounded-xl bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-background/50 shrink-0">
              <h2 className="text-lg font-black font-mono text-primary">{focusedBowl?.bowl.name}</h2>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Empty slots = at-large. Backups fill in when the primary conf has no eligible team.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {renderSlot(1)}
              {renderSlot(2)}

              {/* Conference capacity tracker */}
              {confNames.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-mono font-black text-muted-foreground tracking-widest">
                      CONF CAPACITY
                    </span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {confNames.map(name => {
                      const used = confTieInTotals.get(name) ?? 0;
                      const cap  = confTeamCounts.get(name) ?? 0;
                      const full = used >= cap;
                      return (
                        <div
                          key={name}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background/50 border border-border/30"
                        >
                          <span className="font-mono text-xs font-bold flex-1 truncate text-foreground/70">
                            {name}
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : 'bg-primary'}`}
                                style={{ width: `${cap > 0 ? Math.min(100, (used / cap) * 100) : 0}%` }}
                              />
                            </div>
                            <span className={`font-mono text-xs font-black min-w-[28px] text-right ${
                              full ? 'text-red-400' : used > 0 ? 'text-primary' : 'text-muted-foreground/30'
                            }`}>{used}/{cap}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
