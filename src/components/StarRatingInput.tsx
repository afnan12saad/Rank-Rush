import { useState } from 'react';
import { Star } from 'lucide-react';
import { STAR_LABELS } from '../utils/scoring';

interface StarRatingInputProps {
  value: number;
  onChange: (rating: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}

const RATINGS: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

export function StarRatingInput({
  value,
  onChange,
  disabled = false,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number>(0);
  const displayValue = hovered || value;

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Overall Project Rating from 1 to 5 Stars"
        className="grid grid-cols-5 gap-2 sm:gap-3"
      >
        {RATINGS.map((num) => {
          const filled = num <= displayValue;
          const selected = value === num;

          return (
            <button
              key={num}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${num} ${num === 1 ? 'Star' : 'Stars'} - ${STAR_LABELS[num]}`}
              disabled={disabled}
              onClick={() => onChange(num)}
              onMouseEnter={() => !disabled && setHovered(num)}
              onMouseLeave={() => setHovered(0)}
              className={`min-h-[68px] sm:min-h-[78px] flex flex-col items-center justify-center gap-1.5 rounded-lg border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                disabled
                  ? 'opacity-60 cursor-not-allowed bg-[#081422] border-[#183152]'
                  : selected
                  ? 'bg-[#163154] border-[#F5B942] text-white shadow-sm'
                  : filled
                  ? 'bg-[#112640] border-[#F5B942]/60 text-white'
                  : 'bg-[#091829] border-[#1E3A5F] text-slate-300 hover:border-[#2563EB] hover:bg-[#0F233C]'
              }`}
            >
              <Star
                className={`w-7 h-7 sm:w-8 sm:h-8 transition-transform duration-150 ${
                  filled
                    ? 'fill-[#F5B942] text-[#F5B942]'
                    : 'text-slate-600'
                }`}
              />
              <span className="font-mono-tabular text-xs font-semibold">
                {num}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-lg bg-[#081422] border border-[#1E3A5F]">
        <div className="text-sm text-slate-300">
          {displayValue > 0 ? (
            <span>
              Selected Rating:{' '}
              <strong className="text-white font-semibold">
                {displayValue} {displayValue === 1 ? 'Star' : 'Stars'} -{' '}
                {STAR_LABELS[displayValue as 1 | 2 | 3 | 4 | 5]}
              </strong>
            </span>
          ) : (
            <span>Tap a star from 1 to 5 to assign your overall rating.</span>
          )}
        </div>
        <div className="font-mono-tabular text-base font-bold text-[#F5B942] shrink-0">
          {value > 0 ? `${value} / 5` : '0 / 5'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 text-[11px] text-slate-400 pt-1">
        {RATINGS.map((num) => (
          <div
            key={num}
            className={`px-2 py-1 rounded text-center sm:text-left ${
              value === num
                ? 'font-semibold text-[#F5B942] bg-[#F5B942]/15'
                : ''
            }`}
          >
            {num}: {STAR_LABELS[num]}
          </div>
        ))}
      </div>
    </div>
  );
}
