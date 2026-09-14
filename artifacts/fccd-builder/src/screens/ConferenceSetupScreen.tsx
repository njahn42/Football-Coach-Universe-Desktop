import { useEffect, useMemo, useRef, useState } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Combobox } from '@/components/Combobox';
import type { ComboboxHandle } from '@/components/Combobox';
import type { DivisionLayout, City } from '@/types';
import { LAYOUT_LABELS, numDivisions, totalTeams, teamsPerDivision } from '@/types';

const LAYOUTS: DivisionLayout[] = ['1x10', '2x6', '2x7', '2x9', '4x4', '4x5'];

export default function ConferenceSetupScreen() {
  const store = useUniverseStore();
  const confIndex = store.conferenceSetupIndex;
  const conference = store.conferences[confIndex];

  const [conferenceNames, setConferenceNames] = useState<string[]>([]);
  const [divisionNames, setDivisionNames] = useState<{ paired: string[][], quad: string[][] }>({
    paired: [],
    quad: [],
  });
  const [cities, setCities] = useState<City[]>([]);

  // focusedIndex: 0=Name, 1=Layout, 2=DivNames, 3=City, 4=Next/Done
  const [focusedIndex, setFocusedIndex] = useState(0);
  // Which division slot is active when focusedIndex===2
  const [focusedDivIndex, setFocusedDivIndex] = useState(0);

  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [highlightedCityIndex, setHighlightedCityIndex] = useState(0);

  // Refs for non-combobox focusable elements
  const refs = useRef<(HTMLElement | null)[]>([]);
  const cityInputRef = useRef<HTMLInputElement>(null);

  // Combobox handles
  const confNameComboRef = useRef<ComboboxHandle>(null);
  const divNameComboRefs = useRef<(ComboboxHandle | null)[]>([]);

  useEffect(() => {
    fetch('/data/conference_names.json').then(r => r.json()).then(setConferenceNames);
    fetch('/data/division_names.json').then(r => r.json()).then(setDivisionNames);
    fetch('/data/cities.json').then(r => r.json()).then(setCities);
  }, []);

  useEffect(() => {
    store.setControlBindings([
      { action: 'dpadUp',    label: 'Navigate up' },
      { action: 'dpadDown',  label: 'Navigate down' },
      { action: 'A',         label: 'Select / open picker' },
      { action: 'X',         label: 'Clear CCG city' },
      { action: 'B',         label: store.conferenceSetupIndex > 0 ? 'Previous conference' : 'Back' },
      { action: 'Start',     label: store.conferenceSetupIndex < (store.conferenceCount ?? 6) - 1 ? 'Next conference' : 'Finish setup' },
    ]);
  }, [store.conferenceSetupIndex, store.conferenceCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flat, deduplicated list of all individual division name strings
  const flatDivisionNames = useMemo(() => {
    const all = [
      ...divisionNames.paired.flat(),
      ...divisionNames.quad.flat(),
    ];
    return [...new Set(all)].sort();
  }, [divisionNames]);

  const numDivs = conference ? numDivisions(conference.layout) : 1;

  // Names and cities already claimed by *other* conferences (not the current one)
  const usedNames = useMemo(
    () =>
      new Set(
        store.conferences
          .filter((_, i) => i !== confIndex)
          .map(c => c.name.trim().toLowerCase())
          .filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.conferences, confIndex],
  );

  const usedCityNames = useMemo(
    () =>
      new Set(
        store.conferences
          .filter((_, i) => i !== confIndex)
          .map(c => c.ccgCity?.cityName)
          .filter(Boolean) as string[],
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.conferences, confIndex],
  );

  const availableConferenceNames = useMemo(
    () => conferenceNames.filter(n => !usedNames.has(n.toLowerCase())),
    [conferenceNames, usedNames],
  );

  const filteredCities = cities.filter(
    c =>
      !usedCityNames.has(c.cityName) &&
      (c.cityName.toLowerCase().includes(citySearch.toLowerCase()) ||
        c.stadium.toLowerCase().includes(citySearch.toLowerCase())),
  );

  // ── Focus sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isCityPickerOpen) {
      cityInputRef.current?.focus();
    } else if (focusedIndex === 0) {
      confNameComboRef.current?.focus();
    } else if (focusedIndex === 2 && numDivs > 1) {
      divNameComboRefs.current[focusedDivIndex]?.focus();
    } else {
      refs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, isCityPickerOpen, focusedDivIndex, numDivs]);

  // Reset div slot focus when switching away from section 2
  useEffect(() => {
    if (focusedIndex !== 2) setFocusedDivIndex(0);
  }, [focusedIndex]);

  // ── City search helpers ────────────────────────────────────────────────────
  useEffect(() => { setHighlightedCityIndex(0); }, [citySearch]);

  useEffect(() => {
    if (isCityPickerOpen) {
      const el = document.getElementById(`city-item-${highlightedCityIndex}`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedCityIndex, isCityPickerOpen]);

  // ── Conference initialization ──────────────────────────────────────────────
  useEffect(() => {
    if (!conference) {
      store.upsertConference(confIndex, {
        id: `conf-${confIndex}`,
        name: '',
        ccgCity: null as unknown as City,
        layout: '2x6',
        divisionNameSetIndex: 0,
        divisions: [{ name: '', teams: [] }, { name: '', teams: [] }],
      });
    }
  }, [conference, confIndex, store]);

  // Load a default conference name if the field is empty — use first *available* name
  useEffect(() => {
    if (conference && !conference.name && availableConferenceNames.length > 0) {
      store.upsertConference(confIndex, { name: availableConferenceNames[0] });
    }
  }, [conference, availableConferenceNames, confIndex, store]);

  // ── Derived (safe to compute before null-guard — conference may be undefined) ──

  const isDuplicateName =
    !!conference &&
    conference.name.trim().length > 0 &&
    store.conferences.some(
      (c, i) =>
        i !== confIndex &&
        c.name.trim().toLowerCase() === conference.name.trim().toLowerCase(),
    );

  const isMissingCity = !conference?.ccgCity;
  const missingDivName = numDivs > 1 && !!conference && conference.divisions.some(d => !d.name.trim());
  const cannotAdvance = isDuplicateName || isMissingCity || missingDivName;
  const confRequiredFields = !conference ? [] : [
    { label: 'Conference name', done: !!conference.name.trim() && !isDuplicateName },
    { label: 'CCG city', done: !isMissingCity },
    ...(numDivs > 1 ? [{ label: 'Division names', done: !missingDivName }] : []),
  ];

  const clearCity = () => {
    store.upsertConference(confIndex, { ccgCity: null as unknown as City });
  };

  const handleNext = () => {
    if (!conference || cannotAdvance) return;
    if (confIndex < (store.conferenceCount || 6) - 1) {
      store.setConferenceSetupIndex(confIndex + 1);
      setFocusedIndex(0);
    } else {
      store.setScreen('draft-teams');
    }
  };

  const handleBack = () => {
    if (confIndex > 0) {
      store.setConferenceSetupIndex(confIndex - 1);
      setFocusedIndex(0);
    } else {
      store.setScreen('conference-count');
    }
  };

  // ── Gamepad — must be called unconditionally (no early return above this) ──
  useGamepad((action) => {
    if (store.showControls) return;
    if (!conference) return;
    // City picker takes full priority
    if (isCityPickerOpen) {
      if (action === 'dpadDown') setHighlightedCityIndex(i => Math.min(filteredCities.length - 1, i + 1));
      else if (action === 'dpadUp') setHighlightedCityIndex(i => Math.max(0, i - 1));
      else if (action === 'A') {
        const selected = filteredCities[highlightedCityIndex];
        if (selected) {
          store.upsertConference(confIndex, { ccgCity: selected });
          setIsCityPickerOpen(false);
          setFocusedIndex(4);
        }
      } else if (action === 'B') {
        setIsCityPickerOpen(false);
        setFocusedIndex(3);
      }
      return;
    }

    // Conference name dropdown intercept
    if (focusedIndex === 0 && confNameComboRef.current?.isDropdownOpen()) {
      if (action === 'dpadDown') confNameComboRef.current.navigate('down');
      else if (action === 'dpadUp') confNameComboRef.current.navigate('up');
      else if (action === 'A') confNameComboRef.current.confirm();
      else if (action === 'B') confNameComboRef.current.close();
      return;
    }

    // Division name dropdown intercept
    if (focusedIndex === 2 && numDivs > 1) {
      const activeCombo = divNameComboRefs.current[focusedDivIndex];
      if (activeCombo?.isDropdownOpen()) {
        if (action === 'dpadDown') activeCombo.navigate('down');
        else if (action === 'dpadUp') activeCombo.navigate('up');
        else if (action === 'A') activeCombo.confirm();
        else if (action === 'B') activeCombo.close();
        return;
      }
      // No dropdown open — navigate within the division slots or between sections
      if (action === 'dpadLeft') setFocusedDivIndex(i => Math.max(0, i - 1));
      else if (action === 'dpadRight') setFocusedDivIndex(i => Math.min(numDivs - 1, i + 1));
      else if (action === 'dpadUp') setFocusedIndex(1);
      else if (action === 'dpadDown') setFocusedIndex(3);
      else if (action === 'B') handleBack();
      return;
    }

    // Normal section navigation
    if (action === 'dpadDown') {
      setFocusedIndex(i => {
        let next = i + 1;
        if (next === 2 && numDivs === 1) next = 3; // skip div names for 1x10
        return Math.min(4, next);
      });
    } else if (action === 'dpadUp') {
      setFocusedIndex(i => {
        let prev = i - 1;
        if (prev === 2 && numDivs === 1) prev = 1;
        return Math.max(0, prev);
      });
    } else if (action === 'dpadRight' && focusedIndex === 1) {
      const curr = LAYOUTS.indexOf(conference.layout);
      const next = LAYOUTS[Math.min(LAYOUTS.length - 1, curr + 1)];
      store.setConferenceLayout(confIndex, next);
    } else if (action === 'dpadLeft' && focusedIndex === 1) {
      const curr = LAYOUTS.indexOf(conference.layout);
      const prev = LAYOUTS[Math.max(0, curr - 1)];
      store.setConferenceLayout(confIndex, prev);
    } else if (action === 'RB' && focusedIndex === 0) {
      // Cycle through available (non-used) conference names when dropdown is closed
      const curr = availableConferenceNames.indexOf(conference.name);
      const next = availableConferenceNames[(curr + 1) % availableConferenceNames.length] || availableConferenceNames[0];
      if (next) store.upsertConference(confIndex, { name: next });
    } else if (action === 'LB' && focusedIndex === 0) {
      const curr = availableConferenceNames.indexOf(conference.name);
      const prev =
        availableConferenceNames[(curr - 1 + availableConferenceNames.length) % availableConferenceNames.length] ||
        availableConferenceNames[0];
      if (prev) store.upsertConference(confIndex, { name: prev });
    } else if (action === 'X') {
      if (focusedIndex === 3 && conference.ccgCity) clearCity();
    } else if (action === 'A') {
      if (focusedIndex === 3) setIsCityPickerOpen(true);
      else if (focusedIndex === 4) handleNext();
    } else if (action === 'Start') {
      if (!cannotAdvance) handleNext();
    } else if (action === 'B') {
      handleBack();
    }
  });

  // ── Null-guard (after all hooks) ───────────────────────────────────────────
  if (!conference) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative">
      <ScreenHeader
        step={3}
        totalSteps={10}
        title="Conference Setup"
        cta="Configure each conference's name, city, and division layout"
        subtitle={`Conference ${confIndex + 1} of ${store.conferenceCount}`}
        requiredFields={confRequiredFields}
        onBack={handleBack}
        onContinue={handleNext}
        continueLabel={confIndex < (store.conferenceCount || 6) - 1 ? 'NEXT CONF' : 'START DRAFT'}
      />

      <div className="flex-1 flex flex-col gap-6 px-8 py-6 max-w-5xl mx-auto w-full relative">

        {/* ── Conference Name ── */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Conference Name
          </label>
          <div className="flex items-start gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <Combobox
                ref={confNameComboRef}
                value={conference.name}
                onChange={name => store.upsertConference(confIndex, { name })}
                options={availableConferenceNames}
                placeholder="Type or cycle a conference name…"
                error={isDuplicateName}
                onFocus={() => setFocusedIndex(0)}
                inputClassName={`w-full bg-card border rounded-lg px-4 py-3 text-xl font-bold text-foreground outline-none transition-colors ${
                  isDuplicateName
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-border focus:border-ring'
                }`}
              />
              {isDuplicateName && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  Another conference already uses this name — each conference must be unique.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-[110px] items-center shrink-0 pt-1">
              <div className="flex gap-2">
                <ControllerBadge action="LB" active={focusedIndex === 0} />
                <ControllerBadge action="RB" active={focusedIndex === 0} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Cycle
              </span>
            </div>
          </div>
        </div>

        {/* ── Division Layout ── */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Division Layout
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-1 flex flex-col">
              <div
                ref={el => { refs.current[1] = el; }}
                tabIndex={0}
                onFocus={() => setFocusedIndex(1)}
                className="flex p-1 bg-card border border-border rounded-lg outline-none transition-colors focus:border-ring"
              >
                {LAYOUTS.map(layout => (
                  <div
                    key={layout}
                    onClick={() => store.setConferenceLayout(confIndex, layout)}
                    className={`flex-1 text-center py-2.5 rounded-md font-bold text-sm cursor-pointer transition-all ${
                      conference.layout === layout
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    {LAYOUT_LABELS[layout]}
                  </div>
                ))}
              </div>

              {/* Stats row */}
              <div className="flex gap-6 items-center px-4 py-2 mt-2 bg-muted/30 rounded-lg text-xs font-mono text-muted-foreground">
                <span>
                  Total <strong className="text-foreground ml-1">{totalTeams(conference.layout)}</strong>
                </span>
                <span>
                  Divisions <strong className="text-foreground ml-1">{numDivs}</strong>
                </span>
                <span>
                  Per Division <strong className="text-foreground ml-1">{teamsPerDivision(conference.layout)}</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-[110px] items-center">
              <div className="flex gap-2">
                <ControllerBadge action="dpadLeft" active={focusedIndex === 1} />
                <ControllerBadge action="dpadRight" active={focusedIndex === 1} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Layout
              </span>
            </div>
          </div>
        </div>

        {/* ── Division Names (per-slot comboboxes) ── */}
        {numDivs > 1 && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Division Names
            </label>
            <div className="flex items-start gap-4">
              <div className="flex-1 flex gap-3">
                {conference.divisions.map((div, divIdx) => (
                  <div key={divIdx} className="flex-1 flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      Division {divIdx + 1}
                    </span>
                    <Combobox
                      ref={el => { divNameComboRefs.current[divIdx] = el; }}
                      value={div.name}
                      onChange={name => store.setDivisionName(confIndex, divIdx, name)}
                      options={flatDivisionNames}
                      placeholder={`e.g. East…`}
                      onFocus={() => {
                        setFocusedIndex(2);
                        setFocusedDivIndex(divIdx);
                      }}
                      inputClassName={`w-full bg-card border rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground outline-none transition-colors ${
                        focusedIndex === 2 && focusedDivIndex === divIdx
                          ? 'border-ring'
                          : 'border-border focus:border-ring'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 min-w-[110px] items-center shrink-0 pt-5">
                <div className="flex gap-2">
                  <ControllerBadge action="dpadLeft" active={focusedIndex === 2} />
                  <ControllerBadge action="dpadRight" active={focusedIndex === 2} />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Slot
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Championship Host City ── */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            Championship Host City
            <span className="text-red-400 text-[10px] font-bold tracking-wider">REQUIRED</span>
          </label>
          <div className="flex items-center gap-4">
            <button
              ref={el => { refs.current[3] = el; }}
              onFocus={() => setFocusedIndex(3)}
              onClick={() => setIsCityPickerOpen(true)}
              className={`flex-1 bg-card border rounded-lg px-4 py-3 outline-none transition-colors focus:border-ring flex items-center justify-between text-left ${
                isMissingCity && focusedIndex === 4
                  ? 'border-red-500/60'
                  : 'border-border'
              }`}
            >
              {conference.ccgCity ? (
                <div>
                  <div className="text-base font-semibold text-foreground">
                    {conference.ccgCity.cityName}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{conference.ccgCity.stadium}</span>
                    {conference.ccgCity.indoors && (
                      <span className="bg-primary/20 text-primary text-[10px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wider">
                        Dome
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground/50 text-sm">Select a host city…</span>
              )}
              <ControllerBadge action="A" label="Browse" active={focusedIndex === 3} />
            </button>

            {/* Clear button — only shown when a city is selected */}
            {conference.ccgCity && (
              <button
                onClick={clearCity}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-ring transition-colors outline-none"
                tabIndex={-1}
              >
                <ControllerBadge action="X" active={focusedIndex === 3} />
                <span>Clear</span>
              </button>
            )}
          </div>
          {isMissingCity && focusedIndex === 4 && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              A championship host city is required before continuing.
            </p>
          )}
        </div>


      </div>{/* end content wrapper */}

      {/* ── City Picker Modal ── */}
      {isCityPickerOpen && (
        <div className="absolute inset-0 bg-background/97 backdrop-blur-sm z-50 flex flex-col p-8">
          <div className="flex items-center gap-4 mb-6 pb-5 border-b border-border">
            <ControllerBadge action="B" label="Cancel" active />
            <h2 className="text-xl font-bold text-foreground">Select Host City</h2>
          </div>

          <input
            ref={cityInputRef}
            type="text"
            placeholder="Search cities or stadiums…"
            value={citySearch}
            onChange={e => setCitySearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-base font-medium text-foreground outline-none focus:border-ring transition-colors mb-4"
          />

          <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card/60 flex flex-col">
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredCities.map((city, idx) => (
                <div
                  id={`city-item-${idx}`}
                  key={`${city.cityName}-${city.stadium}`}
                  className={`px-4 py-3 rounded-lg flex items-center justify-between cursor-pointer border transition-colors ${
                    highlightedCityIndex === idx
                      ? 'bg-ring/15 border-ring/50 text-foreground'
                      : 'hover:bg-muted/40 text-foreground border-transparent'
                  }`}
                  onMouseEnter={() => setHighlightedCityIndex(idx)}
                  onClick={() => {
                    store.upsertConference(confIndex, { ccgCity: city });
                    setIsCityPickerOpen(false);
                    setFocusedIndex(4);
                  }}
                >
                  <div>
                    <div className="font-semibold text-base">{city.cityName}</div>
                    <div className="text-sm mt-0.5 text-muted-foreground">{city.stadium}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {city.indoors && (
                      <span className="text-[10px] uppercase px-2 py-1 rounded bg-primary/15 text-primary font-bold tracking-wider">
                        Dome
                      </span>
                    )}
                    {highlightedCityIndex === idx && <ControllerBadge action="A" active />}
                  </div>
                </div>
              ))}
              {filteredCities.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No cities found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
