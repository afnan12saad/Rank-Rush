interface TrophyEmblemProps {
  tier: 'gold' | 'silver' | 'bronze';
  className?: string;
}

export function TrophyEmblem({ tier, className = 'w-14 h-14' }: TrophyEmblemProps) {
  const palette =
    tier === 'gold'
      ? {
          light: '#FDE68A',
          mid: '#F5B942',
          dark: '#B45309',
          trim: '#FEF3C7',
        }
      : tier === 'silver'
      ? {
          light: '#F1F5F9',
          mid: '#CBD5E1',
          dark: '#64748B',
          trim: '#FFFFFF',
        }
      : {
          light: '#FDBA74',
          mid: '#D97706',
          dark: '#7C2D12',
          trim: '#FFEDD5',
        };

  const gradId = `trophy-${tier}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="16" y1="8" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="55%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </linearGradient>
      </defs>
      {/* Left & Right Handles */}
      <path
        d="M18 16H11C9.5 16 8.5 17.3 8.7 18.8C9.5 25.4 13.3 30.2 19 31.6"
        stroke={palette.mid}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M46 16H53C54.5 16 55.5 17.3 55.3 18.8C54.5 25.4 50.7 30.2 45 31.6"
        stroke={palette.mid}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Cup Body */}
      <path
        d="M18 11H46V24C46 32.3 39.7 38.5 32 38.5C24.3 38.5 18 32.3 18 24V11Z"
        fill={`url(#${gradId})`}
      />
      {/* Rim Highlight */}
      <rect x="16" y="9" width="32" height="4" rx="2" fill={palette.trim} />
      {/* Center Star */}
      <path
        d="M32 16.5L34.1 21.1L39.1 21.7L35.4 25.2L36.4 30.1L32 27.7L27.6 30.1L28.6 25.2L24.9 21.7L29.9 21.1L32 16.5Z"
        fill="#071422"
        fillOpacity="0.45"
      />
      {/* Stem & Base */}
      <rect x="29" y="38" width="6" height="9" fill={palette.mid} />
      <path d="M22 47H42L44 52H20L22 47Z" fill={palette.dark} />
      <rect x="18" y="52" width="28" height="4" rx="1.5" fill={palette.mid} />
    </svg>
  );
}
