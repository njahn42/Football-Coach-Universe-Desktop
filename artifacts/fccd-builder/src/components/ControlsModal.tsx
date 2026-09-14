import { useEffect } from 'react';
import { useUniverseStore } from '@/store';
import { useGamepad } from '@/hooks/useGamepad';
import { ControllerBadge } from './ControllerBadge';

export function ControlsModal() {
  const showControls = useUniverseStore(s => s.showControls);
  const controlBindings = useUniverseStore(s => s.controlBindings);
  const closeControls = useUniverseStore(s => s.closeControls);
  const toggleControls = useUniverseStore(s => s.toggleControls);

  // Global gamepad handler: Select toggles, B closes
  useGamepad((action) => {
    if (action === 'Select') { toggleControls(); return; }
    if (action === 'B' && showControls) { closeControls(); return; }
  });

  // Also close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showControls) closeControls();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showControls, closeControls]);

  if (!showControls) return null;

  // Split bindings into two columns
  const mid = Math.ceil(controlBindings.length / 2);
  const col1 = controlBindings.slice(0, mid);
  const col2 = controlBindings.slice(mid);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={closeControls}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-6 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <span className="text-primary text-sm font-mono font-black">?</span>
          </div>
          <div>
            <h2 className="text-sm font-black font-mono uppercase tracking-wider text-foreground">
              Controller Reference
            </h2>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              Bindings for this screen
            </p>
          </div>
          <button
            onClick={closeControls}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Bindings grid */}
        <div className="px-6 py-5">
          {controlBindings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No bindings registered for this screen.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {[col1, col2].map((col, ci) => (
                <div key={ci} className="flex flex-col gap-3">
                  {col.map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="shrink-0 w-14 flex justify-end">
                        <ControllerBadge action={b.action} active />
                      </div>
                      <span className="text-xs text-foreground/80 leading-tight">{b.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 px-6 py-3 border-t border-border/50 bg-muted/20">
          <ControllerBadge action="Select" active />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">or</span>
          <ControllerBadge action="B" active />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">to close</span>
        </div>
      </div>
    </div>
  );
}
