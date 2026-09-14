import React, { useEffect, useState } from 'react';
import { logoPath, type LogoCategory } from '@/utils/logoAssets';

// ─── Placeholder SVG rendered when no logo file is found ─────────────────────

function ShieldPlaceholder({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20 2L4 8V20C4 30.5 11 39 20 42C29 39 36 30.5 36 20V8L20 2Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <text
        x="50%"
        y="55%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="14"
        fontWeight="bold"
        fill="currentColor"
        fillOpacity="0.4"
      >
        ?
      </text>
    </svg>
  );
}

// ─── EntityLogo component ─────────────────────────────────────────────────────

interface EntityLogoProps {
  /** Category determines the subfolder under /images/ */
  type: LogoCategory;
  /** The entity's display name — normalized to a filename automatically. */
  name: string;
  className?: string;
  /** Alt text override; defaults to the entity name. */
  alt?: string;
}

/**
 * Renders a PNG logo from public/images/<type>/<normalized-name>.png.
 * Falls back to a neutral shield SVG placeholder on 404 or load error.
 * Never throws or causes errors — missing logos are silently swallowed.
 */
export function EntityLogo({ type, name, className = 'w-8 h-8', alt }: EntityLogoProps) {
  const [errored, setErrored] = useState(false);
  const src = logoPath(type, name);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (errored) {
    return (
      <ShieldPlaceholder
        className={`text-muted-foreground/50 ${className}`}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? name}
      className={`object-contain ${className}`}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}
