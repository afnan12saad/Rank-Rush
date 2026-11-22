import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Gavel, Home, Menu, ShieldCheck, X } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { useArenaAuth } from '../context/ArenaAuthContext';

export function SiteHeader() {
  const location = useLocation();
  const { isAdmin, judgeProfile } = useArenaAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const judgeTarget = judgeProfile ? '/judge/dashboard' : '/judge/login';
  const adminTarget = isAdmin ? '/admin' : '/admin/login';

  const portalItems = [
    {
      label: 'Judge Portal',
      description: 'Score teams on five criteria',
      to: judgeTarget,
      icon: Gavel,
    },
    {
      label: 'Admin Portal',
      description: 'Organizer console and approvals',
      to: adminTarget,
      icon: ShieldCheck,
    },
  ];

  const pageItems = [
    { label: 'Home', to: '/home', icon: Home },
    ...(isAdmin
      ? [
          { label: 'Live Projector', to: '/projector', icon: null },
          { label: 'Final Results', to: '/results', icon: null },
        ]
      : []),
  ];

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const isActive = (to: string) => {
    if (to === '/home') return location.pathname === '/home';
    const section = `/${to.split('/')[1]}`;
    return location.pathname.startsWith(section);
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#071422]/95 backdrop-blur-sm border-b border-[#183152]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: sidebar open/close toggle */}
          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label={drawerOpen ? 'Close portal sidebar' : 'Open portal sidebar'}
            aria-expanded={drawerOpen}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-[#1E3A5F] text-white hover:bg-[#0F2136] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Center: concise single-line navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-300"
          >
            {pageItems.map((item) => {
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
            <Link
              to={judgeTarget}
              className={`px-3.5 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                isActive(judgeTarget)
                  ? 'bg-[#112640] text-white font-semibold'
                  : 'hover:text-white hover:bg-[#0D1E33]'
              }`}
            >
              Judge Portal
            </Link>
          </nav>

          {/* Right: primary action + brand on the far right */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={adminTarget}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071422]"
            >
              {isAdmin ? 'Admin Console' : 'Admin Login'}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 min-h-[44px] text-white font-display font-bold text-lg tracking-tight whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-md"
            >
              <span>RANK RUSH</span>
              <BrandMark className="w-7 h-7" />
            </Link>
          </div>
        </div>
      </header>

      {/* Backdrop while the left sidebar is open */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close portal sidebar"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-black/60 cursor-default"
        />
      )}

      {/* Left slide-in sidebar: portal switcher */}
      <aside
        aria-label="Portal Sidebar"
        aria-hidden={!drawerOpen}
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#0B1B2E] border-r border-[#183152] shadow-2xl transform transition-transform duration-200 ease-out flex flex-col ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#183152] shrink-0">
          <span className="text-white font-display font-semibold text-sm tracking-wide">
            Switch Portal
          </span>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close portal sidebar"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-300 hover:bg-[#10233A] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav aria-label="Portal Switcher" className="p-3 space-y-1.5">
          {portalItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                  active
                    ? 'bg-[#142B47] text-white'
                    : 'text-slate-300 hover:bg-[#10233A] hover:text-white'
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0 ${
                    active ? 'bg-[#2563EB] text-white' : 'bg-[#12263F] text-[#F5B84C]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-xs text-slate-400 truncate">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pt-3 mt-1 border-t border-[#183152]">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Pages
          </p>
          <nav aria-label="Sidebar Pages" className="space-y-1">
            {pageItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#142B47] text-white'
                      : 'text-slate-300 hover:bg-[#10233A] hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
