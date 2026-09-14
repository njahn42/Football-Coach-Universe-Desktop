import { useEffect, useState } from 'react';
import { logoPath } from '@/utils/logoAssets';

interface TeamLogoProps {
  name: string;
  primaryColor: string;
  /** px size for both width and height (default 32) */
  size?: number;
  className?: string;
}

/**
 * Renders the canonical team image if available, otherwise falls back to a
 * small colored circle with the team's primary color.
 */
export function TeamLogo({ name, primaryColor, size = 32, className = '' }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  const src = logoPath('teams', name);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <span
        className={`rounded-full shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: primaryColor,
          display: 'inline-block',
        }}
        aria-label={name}
      />
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`object-contain shrink-0 ${className}`}
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
    />
  );
}
