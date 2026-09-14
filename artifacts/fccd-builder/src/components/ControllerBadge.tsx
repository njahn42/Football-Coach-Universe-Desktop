import React from 'react';

const ICON_MAP: Record<string, string> = {
  A: 'A',
  B: 'B',
  X: 'X',
  Y: 'Y',
  LB: 'LB',
  RB: 'RB',
  LT: 'LT',
  RT: 'RT',
  dpadLeft: '◀',
  dpadRight: '▶',
  dpadUp: '▲',
  dpadDown: '▼',
  Start: '☰',
  Select: '⊟',
};

// Game-accurate colors: face buttons use Xbox colors; shoulder = neutral
const FACE_COLORS: Record<string, string> = {
  A: 'text-green-400 border-green-600/50 bg-green-900/30',
  B: 'text-red-400 border-red-600/50 bg-red-900/30',
  X: 'text-sky-400 border-sky-600/50 bg-sky-900/30',
  Y: 'text-yellow-400 border-yellow-600/50 bg-yellow-900/30',
};

interface ControllerBadgeProps {
  action: string;
  label?: string;
  active?: boolean;
}

export function ControllerBadge({ action, label, active = false }: ControllerBadgeProps) {
  const icon = ICON_MAP[action] ?? action;
  const isFace = ['A', 'B', 'X', 'Y'].includes(action);

  const activeColor = isFace
    ? FACE_COLORS[action]
    : 'text-muted-foreground border-border bg-muted/40';

  return (
    <div className={`inline-flex items-center gap-1.5 transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`flex items-center justify-center min-w-[24px] h-[24px] rounded-full border ${active ? activeColor : 'border-muted-foreground/20 text-muted-foreground/40 bg-muted/20'} text-[10px] font-mono font-bold px-1`}>
        {icon}
      </div>
      {label && (
        <span className={`text-xs font-medium uppercase tracking-wider ${active ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
          {label}
        </span>
      )}
    </div>
  );
}
