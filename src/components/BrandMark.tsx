export function BrandMark({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="-48 -43 557 384"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g transform="translate(0 0) scale(1.0) skewX(-13)">
        <path d="M0 80.0L120 70L120 90Z" fill="#3478F6" fillOpacity={1.0} />
        <path d="M28 147.5L120 140L120 155Z" fill="#3478F6" fillOpacity={0.65} />
        <path d="M56 209.5L120 204L120 215Z" fill="#3478F6" fillOpacity={0.4} />
        <path
          d="M0 0H84L112 28V79L87 104L130 176H85L43 105H36V176H0ZM36 34V72H65L76 61V45L65 34Z"
          transform="translate(150 60)"
          fill="#2B5FCC"
          fillRule="evenodd"
        />
        <path
          d="M0 0H84L112 28V79L87 104L130 176H85L43 105H36V176H0ZM36 34V72H65L76 61V45L65 34Z"
          transform="translate(288 20)"
          fill="#3478F6"
          fillRule="evenodd"
        />
        <g transform="translate(258 -10)">
          <clipPath id="rr-bolt-clip">
            <path d="M215 0L85 160L150 160L42 318L170 95L105 95Z" />
          </clipPath>
          <g clipPath="url(#rr-bolt-clip)">
            <path d="M-40 150L265 -20L265 -80L-40 90Z" fill="#FFD966" />
            <path d="M-40 150L265 -20L265 420L-40 420Z" fill="#E89B0C" />
          </g>
          <path
            d="M215 0L85 160L150 160L42 318L170 95L105 95Z"
            fill="none"
            stroke="#C87F0A"
            strokeWidth={6}
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}
