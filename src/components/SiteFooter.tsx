import { Link } from 'react-router-dom';
import { useArenaAuth } from '../context/ArenaAuthContext';

export function SiteFooter() {
  const { settings, isAdmin } = useArenaAuth();
  const college =
    settings?.collegeName || 'Academic Project Evaluation Committee';
  const canSeeLeaderboardLinks = isAdmin;

  return (
    <footer className="border-t border-[#183152] bg-[#06101B] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-slate-400">
        <div>
          <p className="font-display font-semibold text-white">
            RANK RUSH
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {college} | Innovate. Present. Inspire.
          </p>
        </div>

        <nav
          aria-label="Footer Links"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-400"
        >
          {canSeeLeaderboardLinks && (
            <>
              <Link to="/projector" className="inline-flex items-center min-h-[44px] hover:text-white transition-colors">
                Projector Display
              </Link>
              <Link to="/results" className="inline-flex items-center min-h-[44px] hover:text-white transition-colors">
                Final Results
              </Link>
            </>
          )}
          <Link to="/privacy" className="inline-flex items-center min-h-[44px] hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="inline-flex items-center min-h-[44px] hover:text-white transition-colors">
            Terms & Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
