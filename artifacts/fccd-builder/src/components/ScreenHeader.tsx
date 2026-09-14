import { useUniverseStore } from '@/store';
import { ControllerBadge } from './ControllerBadge';

export interface RequiredField {
  label: string;
  done: boolean;
}

interface ScreenHeaderProps {
  step: number;
  totalSteps: number;
  title: string;
  cta: string;
  /** Optional secondary line shown under the CTA (e.g. "Conference 2 of 8") */
  subtitle?: string;
  requiredFields?: RequiredField[];
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
}

export function ScreenHeader({
  step,
  totalSteps,
  title,
  cta,
  subtitle,
  requiredFields,
  onBack,
  onContinue,
  continueLabel = 'CONTINUE',
}: ScreenHeaderProps) {
  const toggleControls = useUniverseStore(s => s.toggleControls);
  const doneCount = requiredFields?.filter(f => f.done).length ?? 0;
  const totalCount = requiredFields?.length ?? 0;
  const canContinue =
    !requiredFields || requiredFields.length === 0 || requiredFields.every(f => f.done);
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;
  const missingFields = requiredFields?.filter(f => !f.done) ?? [];

  return (
    <div className="border-b border-border bg-card/60 px-6 py-3 shrink-0">
      {/* Top row: step badge | title+cta | nav buttons */}
      <div className="flex items-center gap-4">
        {/* Step badge */}
        <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border/70 shrink-0 tracking-widest uppercase whitespace-nowrap">
          STEP {step} / {totalSteps}
        </span>

        {/* Title + CTA */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black font-mono tracking-tight text-foreground leading-tight uppercase">
            {title}
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {subtitle ? <span className="text-primary font-bold mr-2">{subtitle}</span> : null}
            {cta}
          </p>
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Controls reference button */}
          <button
            onClick={toggleControls}
            title="Controller reference (SELECT)"
            className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-border/40 bg-muted/20 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ControllerBadge action="Select" active />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider hidden sm:block ml-0.5">Controls</span>
          </button>

          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[11px] font-mono font-bold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              ◀ BACK
            </button>
          )}
          {onContinue && (
            <button
              onClick={canContinue ? onContinue : undefined}
              disabled={!canContinue}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono font-black text-[11px] tracking-wider transition-all ${
                canContinue
                  ? 'bg-primary text-primary-foreground hover:brightness-110 cursor-pointer shadow-[0_0_12px_rgba(250,204,21,0.2)]'
                  : 'bg-muted/60 text-muted-foreground cursor-not-allowed opacity-50'
              }`}
            >
              {continueLabel} ▶
            </button>
          )}
        </div>
      </div>

      {/* Progress row — only when requiredFields are provided */}
      {requiredFields && requiredFields.length > 0 && (
        <div className="mt-2 flex items-center gap-3">
          {/* Bar */}
          <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                canContinue ? 'bg-green-500' : 'bg-primary'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Fraction / all-set label */}
          <span
            className={`text-[10px] font-mono font-bold whitespace-nowrap shrink-0 ${
              canContinue ? 'text-green-400' : 'text-muted-foreground'
            }`}
          >
            {canContinue ? 'All set ✓' : `${doneCount} / ${totalCount} required`}
          </span>

          {/* Missing pill labels */}
          {!canContinue && missingFields.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
              {missingFields.map(f => (
                <span
                  key={f.label}
                  className="px-2 py-0.5 rounded-full bg-muted/60 border border-border/60 text-[10px] font-mono text-muted-foreground/80 whitespace-nowrap"
                >
                  {f.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
