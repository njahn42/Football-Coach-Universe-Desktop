import { useEffect, useRef } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from '@/components/ControllerBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useState } from 'react';

const COUNTS = [6, 8, 10] as const;
const DESCRIPTIONS: Record<number, string> = {
  6:  'Focused universe — up to 60 teams. Tight competition, fast season.',
  8:  'Balanced — up to 80 teams. The sweet spot for most dynasties.',
  10: 'Full-scale universe — up to 100 teams. Maximum realism.',
};

export default function ConferenceCountScreen() {
  const store = useUniverseStore();
  const [focusedIndex, setFocusedIndex] = useState(1);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    cardRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  useEffect(() => {
    store.setControlBindings([
      { action: 'B',         label: 'Back' },
      { action: 'dpadLeft',  label: 'Select lower count' },
      { action: 'dpadRight', label: 'Select higher count' },
      { action: 'A',         label: 'Choose count & continue' },
      { action: 'Start',     label: 'Continue' },
    ]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = store.conferenceCount !== null;

  const handleSelect = (count: 6 | 8 | 10) => {
    store.setConferenceCount(count);
    store.setScreen('conference-setup');
  };

  useGamepad((action) => {
    if (store.showControls) return;
    if (action === 'dpadLeft')  setFocusedIndex(i => Math.max(0, i - 1));
    else if (action === 'dpadRight') setFocusedIndex(i => Math.min(2, i + 1));
    else if (action === 'A')    handleSelect(COUNTS[focusedIndex]);
    else if (action === 'B')    store.setScreen('universe-info');
    else if (action === 'Start' && canContinue) store.setScreen('conference-setup');
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <ScreenHeader
        step={2}
        totalSteps={10}
        title="Conference Count"
        cta="How many conferences will your universe have?"
        requiredFields={[
          { label: 'Conference count', done: canContinue },
        ]}
        onBack={() => store.setScreen('universe-info')}
        onContinue={() => store.setScreen('conference-setup')}
      />

      <div className="flex-1 flex gap-5 items-center px-8 py-8 max-w-5xl w-full mx-auto">
        {COUNTS.map((count, idx) => {
          const isFocused = focusedIndex === idx;
          return (
            <button
              key={count}
              ref={el => { cardRefs.current[idx] = el; }}
              onFocus={() => setFocusedIndex(idx)}
              onClick={() => handleSelect(count)}
              className={`relative flex-1 rounded-xl border-2 p-8 flex flex-col items-center gap-5 transition-all duration-200 outline-none text-left ${
                isFocused
                  ? 'border-ring bg-card shadow-lg scale-[1.03]'
                  : 'border-border bg-card/50 hover:bg-card hover:border-border/80 scale-100 opacity-75 hover:opacity-100'
              }`}
            >
              <div className={`text-7xl font-black font-mono leading-none transition-colors ${isFocused ? 'text-primary' : 'text-muted-foreground/70'}`}>
                {count}
              </div>

              <div className="flex flex-col items-center gap-1 text-center">
                <span className={`text-sm font-semibold uppercase tracking-widest ${isFocused ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Conferences
                </span>
                <span className={`text-xs font-mono ${isFocused ? 'text-ring' : 'text-muted-foreground/60'}`}>
                  Up to {count * 10} Teams
                </span>
              </div>

              <p className={`text-xs text-center leading-relaxed transition-all duration-300 ${isFocused ? 'text-muted-foreground opacity-100' : 'opacity-0'}`}>
                {DESCRIPTIONS[count]}
              </p>

              {store.conferenceCount === count && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}
