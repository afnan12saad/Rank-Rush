import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { useArenaAuth } from '../context/ArenaAuthContext';

export function SiteHeader() {
  const location = useLocation();
  const { isAdmin, judgeProfile } = useArenaAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const canSeeLeaderboardLinks = isAdmin;

  const navItems = [
    { label: 'Home', to: '/' },
    {
      label: 'Judge Portal',
      to: judgeProfile ? '/judge/dashboard' : '/judge/login',
    },
    ...(canSeeLeaderboardLinks
      ? [
          { label: 'Live Projector', to: '/projector' },
          { label: 'Final Results', to: '/results' },
        ]
      : []),
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#071422]/95 backdrop-blur-sm border-b border-[#183152]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Title */}
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 min-h-[44px] text-white font-display font-bold text-lg tracking-tight whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-md"
        >
          <BrandMark className="w-7 h-7" />
          <span>RANK RUSH</span>
        </Link>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-300"
        >
          {navItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3.5 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#112640] text-white font-semibold'
                    : 'hover:text-white hover:bg-[#0D1E33]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action + Mobile Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={isAdmin ? '/admin' : '/admin/login'}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071422]"
          >
            {isAdmin ? 'Admin Console' : 'Admin Login'}
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-[#1E3A5F] text-white hover:bg-[#0F2136] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#183152] bg-[#0B1B2E] px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                isActive(item.to)
                  ? 'bg-[#142B47] text-white font-semibold'
                  : 'text-slate-300 hover:bg-[#10233A] hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to={isAdmin ? '/admin' : '/admin/login'}
            onClick={() => setMobileOpen(false)}
            className="block w-full text-center px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold mt-2"
          >
            {isAdmin ? 'Admin Console' : 'Admin Login'}
          </Link>
        </div>
      )}
    </header>
  );
        }
