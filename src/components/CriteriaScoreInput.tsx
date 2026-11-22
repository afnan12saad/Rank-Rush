import {
  CRITERIA,
  MAX_CRITERION_SCORE,
  MAX_TOTAL_SCORE,
  MIN_CRITERION_SCORE,
} from '../utils/scoring';
import type { CriteriaScores, CriterionId } from '../types/arena';

interface Props {
  value: Partial<CriteriaScores>;
  onChange: (id: CriterionId, score: number) => void;
  disabled?: boolean;
}

const SCORES = Array.from(
  { length: MAX_CRITERION_SCORE - MIN_CRITERION_SCORE + 1 },
  (_, i) => MIN_CRITERION_SCORE + i,
);

export function CriteriaScoreInput({ value, onChange, disabled = false }: Props) {
  const filled = CRITERIA.filter(({ id }) => typeof value[id] === 'number');
  const total = filled.reduce((a, { id }) => a + (value[id] as number), 0);

  return (
    <div className="space-y-4">
      {CRITERIA.map(({ id, label }) => (
        <div
          key={id}
          role="radiogroup"
          aria-label={`${label}, score from ${MIN_CRITERION_SCORE} to ${MAX_CRITERION_SCORE}`}
          className="p-3 rounded-lg bg-[#081422] border border-[#1E3A5F]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-100">{label}</span>
            <span className="font-mono-tabular text-xs text-[#F5B942]">
              {typeof value[id] === 'number' ? value[id] : '-'} / {MAX_CRITERION_SCORE}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {SCORES.map((n) => {
              const selected = value[id] === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${label}: ${n} out of ${MAX_CRITERION_SCORE}`}
                  disabled={disabled}
                  onClick={() => onChange(id, n)}
                  className={`min-h-[44px] rounded-lg border text-sm font-semibold font-mono-tabular transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                    disabled
                      ? 'opacity-60 cursor-not-allowed bg-[#081422] border-[#183152] text-slate-400'
                      : selected
                      ? 'bg-[#163154] border-[#F5B942] text-white'
                      : 'bg-[#091829] border-[#1E3A5F] text-slate-300 hover:border-[#2563EB]'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#081422] border border-[#1E3A5F] text-sm">
        <span className="text-slate-300">
          Total {filled.length < CRITERIA.length ? `(${filled.length}/${CRITERIA.length} scored)` : ''}
        </span>
        <strong className="font-mono-tabular text-[#F5B942]">
          {total} / {MAX_TOTAL_SCORE}
        </strong>
      </div>
    </div>
  );
}
