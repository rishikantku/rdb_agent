import React from 'react';

/**
 * ============================================================================
 * RDB Agent — Enterprise Brand Identity
 * ============================================================================
 * Design Motif: The Governed Data Prism
 * - 3 Isometric Hollow Strata: Representing relational database tiers (raw ledger,
 *   relational fabric, semantic model).
 * - Axial Analytical Core: A radiant vertical ray rising through the strata
 *   to resolve on a brilliant apex node (The Answer).
 * - Executive Architecture: High-contrast midnight ground, precision bevels,
 *   and calibrated tracking.
 * ============================================================================
 */

interface MarkProps {
  size?: number;
  tile?: boolean;
  className?: string;
}

export const Mark: React.FC<MarkProps> = ({
  size = 32,
  tile = true,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="RDB Agent Brand Mark"
    >
      <defs>
        {/* Background shield luxury gradient */}
        <linearGradient id={`tileBg-${uid}`} x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B1C33" />
          <stop offset="55%" stopColor="#061224" />
          <stop offset="100%" stopColor="#020812" />
        </linearGradient>

        {/* Shield hairline border */}
        <linearGradient id={`tileBorder-${uid}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#1E3A8A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0.4" />
        </linearGradient>

        {/* Axial Beam Gradient */}
        <linearGradient id={`axialBeam-${uid}`} x1="24" y1="38" x2="24" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.1" />
          <stop offset="30%" stopColor="#00E5FF" stopOpacity="0.7" />
          <stop offset="85%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>

        {/* Strata 1 (Bottom - Royal Cobalt) */}
        <linearGradient id={`strataBottomLeft-${uid}`} x1="10" y1="32" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id={`strataBottomRight-${uid}`} x1="24" y1="40" x2="38" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#172554" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        {/* Strata 2 (Middle - Electric Cyan) */}
        <linearGradient id={`strataMidLeft-${uid}`} x1="10" y1="24" x2="24" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id={`strataMidRight-${uid}`} x1="24" y1="32" x2="38" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0369A1" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>

        {/* Strata 3 (Top - Sapphire Prism) */}
        <linearGradient id={`strataTopLeft-${uid}`} x1="10" y1="16" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id={`strataTopRight-${uid}`} x1="24" y1="24" x2="38" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        {/* Apex Bloom Filter */}
        <filter id={`apexGlow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Executive Shield / Tile */}
      {tile && (
        <>
          <rect
            x="1"
            y="1"
            width="46"
            height="46"
            rx="12"
            fill={`url(#tileBg-${uid})`}
            stroke={`url(#tileBorder-${uid})`}
            strokeWidth="1.2"
          />
          {/* Subtle internal core ambient aura */}
          <circle cx="24" cy="11" r="12" fill="#00E5FF" fillOpacity="0.18" filter={`url(#apexGlow-${uid})`} />
        </>
      )}

      {/* ==================== 1. TIER 1: BOTTOM STRATA ==================== */}
      {/* Left Bevel */}
      <path
        d="M12 30.5 L24 37 L24 39.5 L12 33 Z"
        fill={`url(#strataBottomLeft-${uid})`}
      />
      {/* Right Bevel */}
      <path
        d="M24 37 L36 30.5 L36 33 L24 39.5 Z"
        fill={`url(#strataBottomRight-${uid})`}
      />
      {/* Top Face (Hollow Ring) */}
      <path
        d="M24 29.5 L36 30.5 L24 37 L12 30.5 Z"
        fill="#1E3A8A"
        fillOpacity="0.4"
      />

      {/* ==================== 2. TIER 2: MIDDLE STRATA ==================== */}
      {/* Left Bevel */}
      <path
        d="M12 22.5 L24 29 L24 31.5 L12 25 Z"
        fill={`url(#strataMidLeft-${uid})`}
      />
      {/* Right Bevel */}
      <path
        d="M24 29 L36 22.5 L36 25 L24 31.5 Z"
        fill={`url(#strataMidRight-${uid})`}
      />
      {/* Top Face (Hollow Ring) */}
      <path
        d="M24 21.5 L36 22.5 L24 29 L12 22.5 Z"
        fill="#0284C7"
        fillOpacity="0.45"
      />

      {/* ==================== 3. TIER 3: TOP STRATA ==================== */}
      {/* Left Bevel */}
      <path
        d="M12 14.5 L24 21 L24 23.5 L12 17 Z"
        fill={`url(#strataTopLeft-${uid})`}
      />
      {/* Right Bevel */}
      <path
        d="M24 21 L36 14.5 L36 17 L24 23.5 Z"
        fill={`url(#strataTopRight-${uid})`}
      />
      {/* Top Face (Hollow Ring) */}
      <path
        d="M24 13.5 L36 14.5 L24 21 L12 14.5 Z"
        fill="#38BDF8"
        fillOpacity="0.5"
      />

      {/* ==================== 4. AXIAL ANALYTICAL BEAM ==================== */}
      <line
        x1="24"
        y1="37"
        x2="24"
        y2="10"
        stroke={`url(#axialBeam-${uid})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        filter={`url(#apexGlow-${uid})`}
      />

      {/* ==================== 5. APEX ILLUMINATED NODE ==================== */}
      <g filter={`url(#apexGlow-${uid})`}>
        {/* Ambient Ring */}
        <circle cx="24" cy="9.5" r="4.5" fill="#00E5FF" fillOpacity="0.3" />
        {/* Solid Cyan Core */}
        <circle cx="24" cy="9.5" r="2.8" fill="#00F0FF" />
        {/* Pure White Central Glint */}
        <circle cx="24" cy="9.5" r="1.1" fill="#FFFFFF" />
      </g>
    </svg>
  );
};

interface LogoProps {
  /** Size in pixels (height of the logo mark) */
  size?: number;
  wordmark?: boolean;
  tile?: boolean;
  subtitle?: string;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 32,
  wordmark = true,
  tile = true,
  subtitle = 'BANKING DATA INTELLIGENCE',
  className = '',
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.38),
        userSelect: 'none',
      }}
    >
      <Mark size={size} tile={tile} />

      {wordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1 }}>
          {/* Main Brand Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              fontFamily: 'var(--font, Inter, -apple-system, sans-serif)',
            }}
          >
            <span
              style={{
                fontSize: Math.round(size * 0.58),
                fontWeight: 800,
                color: 'var(--ink, #0A1628)',
                letterSpacing: '-0.04em',
              }}
            >
              RDB
            </span>
            <span
              style={{
                fontSize: Math.round(size * 0.58),
                fontWeight: 500,
                color: 'var(--accent, #3B7BF7)',
                marginLeft: '0.18em',
                letterSpacing: '-0.02em',
              }}
            >
              Agent
            </span>
          </div>

          {/* Subtitle / Departmental Remit */}
          {subtitle && (
            <div
              style={{
                fontSize: Math.max(9, Math.round(size * 0.24)),
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ink-4, #94A1B7)',
                marginTop: Math.max(2, Math.round(size * 0.08)),
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
