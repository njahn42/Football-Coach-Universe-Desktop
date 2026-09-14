import { useEffect, useRef, useState } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { validateAndImport } from '@/utils/importUniverse';
import type { Team, Bowl, City } from '@/types';

export default function UniverseInfoScreen() {
  const store = useUniverseStore();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<(HTMLElement | null)[]>([]);

  // ── Import state ────────────────────────────────────────────────────────────
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    store.setControlBindings([
      { action: 'dpadUp',    label: 'Navigate up' },
      { action: 'dpadDown',  label: 'Navigate down' },
      { action: 'dpadLeft',  label: 'Adjust year (on year field)' },
      { action: 'dpadRight', label: 'Adjust year (on year field)' },
      { action: 'LB',        label: 'Cycle suggestion' },
      { action: 'RB',        label: 'Cycle suggestion' },
      { action: 'Start',     label: 'Continue' },
    ]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue =
    store.universeName.trim().length > 0 &&
    !!store.startingYear &&
    store.startingMessage.trim().length > 0;

  useEffect(() => {
    inputRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  useGamepad((action) => {
    if (store.showControls) return;
    if (action === 'dpadDown') {
      setFocusedIndex(i => Math.min(2, i + 1));
    } else if (action === 'dpadUp') {
      setFocusedIndex(i => Math.max(0, i - 1));
    } else if (action === 'dpadRight' && focusedIndex === 1) {
      store.nudgeYear(1);
    } else if (action === 'dpadLeft' && focusedIndex === 1) {
      store.nudgeYear(-1);
    } else if (action === 'RB') {
      if (focusedIndex === 0) store.cycleNameSuggestion('next');
      if (focusedIndex === 2) store.cycleMessageSuggestion('next');
    } else if (action === 'LB') {
      if (focusedIndex === 0) store.cycleNameSuggestion('prev');
      if (focusedIndex === 2) store.cycleMessageSuggestion('prev');
    } else if (action === 'Start') {
      if (canContinue) store.setScreen('conference-count');
    }
  });

  const requiredFields = [
    { label: 'Universe name', done: store.universeName.trim().length > 0 },
    { label: 'Starting year', done: !!store.startingYear },
    { label: 'Welcome message', done: store.startingMessage.trim().length > 0 },
  ];

  // ── Import handler ──────────────────────────────────────────────────────────

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected if needed
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    setImporting(true);

    try {
      // Read the JSON file
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('The file is not valid JSON. Please check that it was not corrupted.');
      }

      // Fetch lookup data in parallel
      const [teamsRes, bowlsRes, citiesRes] = await Promise.all([
        fetch('/data/teams.json'),
        fetch('/data/bowls.json'),
        fetch('/data/cities.json'),
      ]);

      if (!teamsRes.ok || !bowlsRes.ok || !citiesRes.ok) {
        throw new Error('Could not load reference data (teams / bowls / cities). Try reloading the page.');
      }

      const [allTeams, allBowls, allCities]: [Team[], Bowl[], City[]] = await Promise.all([
        teamsRes.json(),
        bowlsRes.json(),
        citiesRes.json(),
      ]);

      // Validate and re-hydrate — throws a descriptive Error on failure
      const payload = validateAndImport(parsed, allTeams, allBowls, allCities);

      // Write into the store; navigates to prestige-review on success
      store.loadFromImport(payload);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'An unexpected error occurred while loading the file.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <ScreenHeader
        step={1}
        totalSteps={10}
        title="Universe Info"
        cta="Name your universe and set the starting season"
        requiredFields={requiredFields}
        onContinue={() => store.setScreen('conference-count')}
      />

      <div className="flex-1 flex flex-col gap-7 px-8 py-8 max-w-3xl w-full mx-auto">

        {/* ── Load Universe ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Resume a saved universe
          </p>
          <div className="flex items-center gap-3">
            {/* Hidden real file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleFileChosen}
            />
            <button
              type="button"
              onClick={() => {
                setImportError(null);
                fileInputRef.current?.click();
              }}
              disabled={importing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent hover:border-ring transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                  </svg>
                  Load Universe
                </>
              )}
            </button>
            <span className="text-xs text-muted-foreground">
              Open a previously exported <code className="font-mono">.json</code> file to keep editing it
            </span>
          </div>

          {/* Import error */}
          {importError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 w-4 h-4 shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{importError}</span>
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Universe Name */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Universe Name
          </label>
          <div className="flex items-center gap-4">
            <input
              ref={el => { inputRefs.current[0] = el; }}
              onFocus={() => setFocusedIndex(0)}
              value={store.universeName}
              onChange={e => store.setUniverseName(e.target.value)}
              className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-lg font-semibold text-foreground outline-none transition-colors focus:border-ring"
            />
            <div className="flex items-center gap-2 shrink-0">
              <ControllerBadge action="LB" active={focusedIndex === 0} />
              <ControllerBadge action="RB" label="Cycle" active={focusedIndex === 0} />
            </div>
          </div>
        </div>

        {/* Starting Year */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Starting Year
          </label>
          <div className="flex items-center gap-4">
            <input
              ref={el => { inputRefs.current[1] = el; }}
              onFocus={() => setFocusedIndex(1)}
              type="number"
              value={store.startingYear}
              onChange={e => store.setStartingYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-32 bg-card border border-border rounded-lg px-4 py-3 text-xl font-mono font-bold text-center text-foreground outline-none transition-colors focus:border-ring"
            />
            <div className="flex items-center gap-2 shrink-0">
              <ControllerBadge action="dpadLeft" active={focusedIndex === 1} />
              <ControllerBadge action="dpadRight" label="Adjust" active={focusedIndex === 1} />
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Welcome Message
          </label>
          <div className="flex items-start gap-4">
            <textarea
              ref={el => { inputRefs.current[2] = el; }}
              onFocus={() => setFocusedIndex(2)}
              value={store.startingMessage}
              onChange={e => store.setStartingMessage(e.target.value)}
              rows={3}
              className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-ring resize-none leading-relaxed"
            />
            <div className="flex flex-col items-center gap-2 pt-2 shrink-0">
              <div className="flex gap-2">
                <ControllerBadge action="LB" active={focusedIndex === 2} />
                <ControllerBadge action="RB" active={focusedIndex === 2} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Cycle</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
