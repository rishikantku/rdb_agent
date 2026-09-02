/**
 * RDB Agent brand identity.
 *
 * The mark reads as three stacked data strata — the structured records a bank
 * already holds — with an analytical line rising through them and resolving on a
 * single node: the answer.
 *
 * Banking substrate · data structure · intelligence · upward movement —
 * in one geometric figure.
 *
 * Strata take `currentColor` so the mark inherits the surrounding text colour
 * and works on light or dark ground; only the resolving node carries the accent.
 */

interface MarkProps {
  size?: number;
  /** Draw the enclosing tile — used for the favicon and small standalone icons */
  tile?: boolean;
  className?: string;
}

export const Mark = ({ size = 28, tile = false, className }: MarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={className}
    role="img"
    aria-label="RDB Agent"
  >
    {tile && <rect width="32" height="32" rx="7" fill="var(--navy, #0B1F3A)" />}

    {/* Three strata — narrowing upward: structured records */}
    <g fill={tile ? '#FFFFFF' : 'currentColor'} opacity={tile ? 0.88 : 0.82}>
      <rect x="5" y="20.5" width="14.5" height="3.4" rx="1.7" />
      <rect x="5" y="14.4" width="10.5" height="3.4" rx="1.7" />
      <rect x="5" y="8.3" width="6.5" height="3.4" rx="1.7" />
    </g>

    {/* Analytical line rising through them */}
    <path
      d="M8.5 22.2 L13.5 16.1 L18.5 10 L23.5 10"
      stroke="var(--accent, #3B7BF7)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.92"
    />

    {/* Resolving node: the answer */}
    <circle cx="25" cy="10" r="3" fill="var(--accent, #3B7BF7)" />
    <circle cx="25" cy="10" r="1.1" fill={tile ? 'var(--navy, #0B1F3A)' : 'var(--surface, #FFFFFF)'} />
  </svg>
);

interface LogoProps {
  /** Height of the mark; the wordmark scales with it */
  size?: number;
  wordmark?: boolean;
  tile?: boolean;
  subtitle?: string;
}

export const Logo = ({ size = 28, wordmark = true, tile = false, subtitle }: LogoProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.36 }}>
    <Mark size={size} tile={tile} />
    {wordmark && (
      <div style={{ lineHeight: 1.1 }}>
        <div
          style={{
            fontSize: size * 0.6,
            letterSpacing: '-0.025em',
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font)',
          }}
        >
          <span style={{ fontWeight: 700 }}>RDB</span>
          <span style={{ fontWeight: 500, opacity: 0.65, marginLeft: '0.15em' }}>Agent</span>
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: size * 0.3,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              color: 'var(--ink-4)',
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    )}
  </div>
);

export default Logo;
