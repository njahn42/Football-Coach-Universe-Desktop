import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { usePrestige } from '@/hooks/usePrestige';
import { useValidation, allBlockingPass } from '@/hooks/useValidation';
import {
  generateUniverseExport,
  downloadJSON,
  downloadZIP,
  buildExportFilename,
} from '@/utils/exportUniverse';
import type { ValidationResult } from '@/types';

function SeverityIcon({ result }: { result: ValidationResult }) {
  if (result.pass) return <span className="text-green-400 font-black text-base">✓</span>;
  if (result.severity === 'warning') return <span className="text-amber-400 font-black text-base">!</span>;
  return <span className="text-red-400 font-black text-base">✗</span>;
}

export default function ReviewExportScreen() {
  const conferences       = useUniverseStore(s => s.conferences);
  const universeName      = useUniverseStore(s => s.universeName);
  const startingYear      = useUniverseStore(s => s.startingYear);
  const startingMessage   = useUniverseStore(s => s.startingMessage);
  const rivalries         = useUniverseStore(s => s.rivalries);
  const oocRivalries      = useUniverseStore(s => s.oocRivalries);
  const selectedBowls     = useUniverseStore(s => s.selectedBowls);
  const prestigeOverrides = useUniverseStore(s => s.prestigeOverrides);
  const getTotalDraftedCount = useUniverseStore(s => s.getTotalDraftedCount);
  const setScreen         = useUniverseStore(s => s.setScreen);
  const showControls      = useUniverseStore(s => s.showControls);
  const setControlBindings = useUniverseStore(s => s.setControlBindings);

  const prestigeInfos = usePrestige(conferences, prestigeOverrides);
  const totalDraftedCount = useMemo(() => getTotalDraftedCount(), [conferences, getTotalDraftedCount]);

  const validationResults = useValidation({
    conferences, rivalries, oocRivalries, selectedBowls, totalDraftedCount,
  });
  const canExport = allBlockingPass(validationResults);

  const [validFocus, setValidFocus] = useState(0);
  const [editingFilename, setEditingFilename] = useState(false);
  const [customFilename, setCustomFilename] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const filenameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setControlBindings([
      { action: 'dpadUp',    label: 'Navigate up' },
      { action: 'dpadDown',  label: 'Navigate down' },
      { action: 'A',         label: 'Fix issue / Export JSON' },
      { action: 'B',         label: 'Back to bowl draft' },
      { action: 'Start',     label: 'Export JSON' },
    ]);
  }, [setControlBindings]);

  const autoFilename = buildExportFilename(universeName);
  const filename = customFilename ?? autoFilename;

  const buildExport = useCallback(() => {
    return generateUniverseExport(
      universeName, startingYear, startingMessage,
      conferences, rivalries, selectedBowls, oocRivalries, prestigeInfos,
    );
  }, [universeName, startingYear, startingMessage, conferences, rivalries, selectedBowls, oocRivalries, prestigeInfos]);

  async function handleExportJSON() {
    if (!canExport || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      downloadJSON(filename, buildExport());
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (e) {
      setExportError('Export failed — check browser console');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportZIP() {
    if (!canExport || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadZIP(filename, buildExport());
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (e) {
      setExportError('ZIP export failed — check browser console');
    } finally {
      setExporting(false);
    }
  }

  useGamepad((action) => {
    if (showControls) return;
    if (action === 'B') { setScreen('bowl-tie-ins'); return; }
    if (action === 'dpadUp')   setValidFocus(i => Math.max(0, i - 1));
    else if (action === 'dpadDown') setValidFocus(i => Math.min(validationResults.length - 1, i + 1));
    else if (action === 'A') {
      const result = validationResults[validFocus];
      if (!result?.pass && result?.screen) {
        setScreen(result.screen);
      } else if (result?.pass) {
        // A on a passing item: no-op
      }
    } else if (action === 'Start' && canExport) {
      handleExportJSON();
    }
  });

  // Prestige color for tier badge
  function prestigeColor(level: number) {
    if (level >= 8) return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
    if (level >= 5) return 'text-teal-400 border-teal-400/30 bg-teal-400/10';
    return 'text-orange-600 border-orange-600/30 bg-orange-600/10';
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative">
      {/* ── Header ── */}
      <ScreenHeader
        step={10}
        totalSteps={10}
        title="Review & Export"
        cta="Validate your universe and export the JSON file"
        onBack={() => setScreen('bowl-tie-ins')}
      />

      {/* ── Main body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — Summary */}
        <div className="w-[40%] border-r border-border overflow-y-auto px-6 py-4 space-y-5">
          <div>
            <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-3">Universe Summary</p>
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <h2 className="text-xl font-black text-foreground">{universeName}</h2>
              <div className="text-muted-foreground text-sm font-mono">{startingYear}</div>
              <p className="text-muted-foreground text-sm italic leading-relaxed border-t border-border/50 pt-2 mt-2">{startingMessage}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'CONFERENCES', value: conferences.length },
              { label: 'TEAMS', value: totalDraftedCount },
              { label: 'BOWLS', value: selectedBowls.length },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl border border-border bg-card text-center">
                <div className="text-2xl font-black font-mono text-primary">{value}</div>
                <div className="text-xs font-mono text-muted-foreground mt-0.5 tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          {oocRivalries.length > 0 && (
            <div className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-mono text-muted-foreground">
              {oocRivalries.length} OOC rivalr{oocRivalries.length === 1 ? 'y' : 'ies'} configured
            </div>
          )}

          {/* Conference list */}
          <div>
            <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-2">Conferences</p>
            <div className="space-y-2">
              {conferences.map((conf, idx) => {
                const info = prestigeInfos[idx];
                const teamCount = conf.divisions.reduce((acc, d) => acc + d.teams.filter(t => t != null).length, 0);
                const prestige = info?.prestigeLevel ?? '?';
                return (
                  <div key={conf.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{conf.name || `Conference ${idx + 1}`}</div>
                      <div className="text-xs text-muted-foreground font-mono">{teamCount} teams · {conf.layout}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-md border text-xs font-mono font-black ${typeof prestige === 'number' ? prestigeColor(prestige) : 'text-muted-foreground border-border bg-muted'}`}>
                      P{prestige}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right — Validation + Export */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Validation */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-3">Pre-Export Checklist</p>
            <div className="space-y-2">
              {validationResults.map((result, idx) => {
                const isFocused = validFocus === idx;
                const rowColor = result.pass
                  ? 'border-green-500/20 bg-green-500/5'
                  : result.severity === 'warning'
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-red-500/20 bg-red-500/5';

                return (
                  <div
                    key={result.id}
                    onClick={() => setValidFocus(idx)}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 ${rowColor} ${isFocused ? 'shadow-md scale-[1.005]' : ''}`}
                  >
                    <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                      <SeverityIcon result={result} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{result.label}</div>
                      {!result.pass && result.errorMessage && (
                        <div className={`text-xs font-mono mt-1 ${result.severity === 'warning' ? 'text-amber-400/80' : 'text-red-400/80'}`}>
                          {result.errorMessage}
                        </div>
                      )}
                    </div>
                    {!result.pass && result.screen && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setScreen(result.screen!); }}
                        className="shrink-0 px-3 py-1 rounded-lg border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                      >
                        Fix →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export dock */}
          <div className="border-t border-border bg-card/60 px-6 py-5 space-y-4 shrink-0">
            {/* Filename */}
            <div className="flex items-center gap-3">
              {editingFilename ? (
                <input
                  ref={filenameInputRef}
                  type="text"
                  value={customFilename ?? autoFilename}
                  onChange={e => setCustomFilename(e.target.value)}
                  onBlur={() => setEditingFilename(false)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingFilename(false); }}
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-lg border border-primary bg-background text-foreground font-mono text-sm focus:outline-none"
                />
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{filename}.json</span>
                  <button
                    onClick={() => { setEditingFilename(true); setCustomFilename(customFilename ?? autoFilename); }}
                    className="text-xs text-muted-foreground/60 hover:text-primary font-mono underline transition-colors"
                  >edit</button>
                  {customFilename && (
                    <button
                      onClick={() => setCustomFilename(null)}
                      className="text-xs text-muted-foreground/50 hover:text-muted-foreground font-mono"
                    >reset</button>
                  )}
                </div>
              )}
            </div>

            {exportError && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                {exportError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportJSON}
                disabled={!canExport || exporting}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${canExport && !exporting ? 'bg-primary text-primary-foreground hover:brightness-110' : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'}`}
              >
                {exporting ? 'EXPORTING…' : 'SAVE JSON'}
              </button>
              <button
                onClick={handleExportZIP}
                disabled={!canExport || exporting}
                className={`flex-1 py-3 rounded-xl font-black tracking-widest font-mono text-sm border-2 transition-all ${canExport && !exporting ? 'border-primary text-primary hover:bg-primary/10' : 'border-border text-muted-foreground cursor-not-allowed opacity-50'}`}
              >
                SAVE WITH LOGOS (ZIP)
              </button>
            </div>

            {!canExport && (
              <p className="text-xs text-muted-foreground font-mono text-center">
                Fix all blocking issues above to enable export
              </p>
            )}
          </div>
        </div>
      </div>


      {/* ── Success overlay ── */}
      {exportSuccess && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50 animate-in fade-in duration-300">
          <div className="bg-card border-2 border-green-500/50 rounded-2xl p-10 text-center space-y-4 shadow-[0_0_40px_rgba(34,197,94,0.3)] max-w-sm">
            <div className="text-6xl text-green-400">✓</div>
            <h2 className="text-2xl font-black text-green-400">File Saved!</h2>
            <p className="text-muted-foreground font-mono text-sm">{filename}.json</p>
            <p className="text-muted-foreground text-xs">Check your Downloads folder</p>
            <button
              onClick={() => setExportSuccess(false)}
              className="mt-4 px-6 py-2 rounded-full border border-border text-muted-foreground hover:text-foreground font-mono text-sm transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
