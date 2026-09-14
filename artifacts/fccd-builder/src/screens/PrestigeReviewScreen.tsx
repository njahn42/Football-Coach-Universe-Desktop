import React, { useEffect, useState, useRef } from 'react';
import { useUniverseStore } from '@/store';
import { usePrestige, findPrestigeConflict } from '@/hooks/usePrestige';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';

function getPrestigeColorClass(level: number) {
  if (level >= 8) return 'text-amber-400';
  if (level >= 5) return 'text-teal-400';
  return 'text-orange-600';
}

export default function PrestigeReviewScreen() {
  const conferences = useUniverseStore(s => s.conferences);
  const prestigeOverrides = useUniverseStore(s => s.prestigeOverrides);
  const setPrestigeOverride = useUniverseStore(s => s.setPrestigeOverride);
  const clearPrestigeOverride = useUniverseStore(s => s.clearPrestigeOverride);
  const setScreen = useUniverseStore(s => s.setScreen);
  const showControls = useUniverseStore(s => s.showControls);
  const setControlBindings = useUniverseStore(s => s.setControlBindings);

  const prestigeInfos = usePrestige(conferences, prestigeOverrides);

  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    refs.current[focusIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusIndex]);

  useEffect(() => {
    setControlBindings([
      { action: 'dpadUp',    label: 'Navigate up' },
      { action: 'dpadDown',  label: 'Navigate down' },
      { action: 'dpadLeft',  label: 'Lower prestige tier' },
      { action: 'dpadRight', label: 'Raise prestige tier' },
      { action: 'A',         label: 'Confirm tier' },
      { action: 'X',         label: 'Clear override' },
      { action: 'B',         label: 'Back to draft' },
      { action: 'Start',     label: 'Continue to rivalries' },
    ]);
  }, [setControlBindings]);

  useGamepad((action) => {
    if (showControls) return;
    if (action === 'dpadUp') {
      setFocusIndex(i => Math.max(0, i - 1));
    } else if (action === 'dpadDown') {
      setFocusIndex(i => Math.min(prestigeInfos.length - 1, i + 1));
    } else if (action === 'dpadLeft') {
      const info = prestigeInfos[focusIndex];
      if (info && info.prestigeLevel > 1) {
        setPrestigeOverride(info.confId, info.prestigeLevel - 1);
      }
    } else if (action === 'dpadRight') {
      const info = prestigeInfos[focusIndex];
      if (info && info.prestigeLevel < 10) {
        setPrestigeOverride(info.confId, info.prestigeLevel + 1);
      }
    } else if (action === 'X') {
      const info = prestigeInfos[focusIndex];
      if (info) clearPrestigeOverride(info.confId);
    } else if (action === 'B') {
      setScreen('draft-teams');
    } else if (action === 'A' || action === 'Start') {
      setScreen('rivalries');
    }
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <ScreenHeader
        step={5}
        totalSteps={10}
        title="Prestige Review"
        cta="Review calculated prestige and adjust any overrides"
        onBack={() => setScreen('draft-teams')}
        onContinue={() => setScreen('rivalries')}
      />
      <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
        <div className="w-full max-w-[950px] flex flex-col gap-8 pb-12">

          <div className="flex flex-col gap-5">
            {prestigeInfos.map((info, idx) => {
              const isFocused = focusIndex === idx;
              const isAuto = prestigeOverrides[info.confId] === undefined;
              const conflictId = findPrestigeConflict(prestigeInfos, info.confId, info.prestigeLevel);
              const conflictName = conflictId ? prestigeInfos.find(p => p.confId === conflictId)?.confName : null;
              
              return (
                <div 
                  key={info.confId} 
                  ref={el => { refs.current[idx] = el; }} 
                  onMouseEnter={() => setFocusIndex(idx)}
                  className={`flex items-center justify-between p-5 rounded-xl border transition-all duration-200 ${isFocused ? 'border-ring bg-card shadow-sm scale-[1.01] z-10 relative' : 'border-border/50 bg-card/40 opacity-70 hover:opacity-100 hover:border-border'}`}
                >
                  
                  {/* Left: Info */}
                  <div className="flex-1 min-w-[280px]">
                    <h3 className="text-3xl font-bold font-sans tracking-tight">{info.confName || `Conference ${idx + 1}`}</h3>
                    <div className="flex items-center gap-3 mt-4 font-mono text-sm">
                      <span className="px-3 py-1.5 bg-background rounded-md border border-border font-bold text-muted-foreground">
                        AVG <span className="text-foreground ml-1">{info.avgRating.toFixed(1)}</span>
                      </span>
                      <span className={`px-3 py-1.5 rounded-md font-bold tracking-widest text-xs border ${info.isFinal ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                        {info.isFinal ? 'FINAL' : 'PROVISIONAL'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Center: Stepper */}
                  <div className="flex flex-col items-center justify-center px-10 shrink-0">
                    <div className="flex items-center gap-8">
                      <button 
                        tabIndex={-1}
                        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-bold text-2xl transition-all ${isFocused ? 'border-ring text-ring hover:bg-ring/20' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/50'}`} 
                        onClick={() => { setFocusIndex(idx); setPrestigeOverride(info.confId, Math.max(1, info.prestigeLevel - 1)); }}
                      >
                        -
                      </button>
                      
                      <div className={`text-7xl font-black font-mono w-24 text-center ${getPrestigeColorClass(info.prestigeLevel)} transition-all duration-300`}>
                        {info.prestigeLevel}
                      </div>
                      
                      <button 
                        tabIndex={-1}
                        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-bold text-2xl transition-all ${isFocused ? 'border-ring text-ring hover:bg-ring/20' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/50'}`} 
                        onClick={() => { setFocusIndex(idx); setPrestigeOverride(info.confId, Math.min(10, info.prestigeLevel + 1)); }}
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="mt-4 h-8 flex items-center justify-center">
                      {!isAuto && (
                        <button 
                          tabIndex={-1}
                          onClick={() => { setFocusIndex(idx); clearPrestigeOverride(info.confId); }} 
                          className="flex items-center gap-2 text-xs font-mono px-4 py-1.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50 font-bold transition-colors"
                        >
                          MANUAL OVERRIDE <span className="opacity-60 text-lg leading-none mb-0.5">×</span>
                        </button>
                      )}
                      {isAuto && (
                        <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest px-4 py-1.5 rounded-full border border-dashed border-border/50">
                          AUTO CALCULATED
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Right: Conflict Warning */}
                  <div className="w-[240px] flex justify-end shrink-0">
                    {conflictName ? (
                      <div className="flex flex-col items-end text-right animate-in fade-in slide-in-from-right-4">
                        <span className="text-red-400 font-bold text-sm tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                          CONFLICT
                        </span>
                        <span className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          Level also held by<br/>
                          <span className="text-foreground font-mono font-bold">{conflictName}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end text-right opacity-30">
                        <span className="text-green-500 font-bold text-sm tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          UNIQUE
                        </span>
                      </div>
                    )}
                  </div>
                  
                </div>
              )
            })}
          </div>
          
        </div>
      </div>
      
    </div>
  );
}
