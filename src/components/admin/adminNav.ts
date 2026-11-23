import {
  Archive,
  Award,
  LayoutDashboard,
  QrCode,
  Settings,
  Sliders,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AdminTab =
  | 'overview'
  | 'teams'
  | 'judges'
  | 'controls'
  | 'qr'
  | 'results'
  | 'archives'
  | 'settings';

export const ADMIN_NAV_TABS: { key: AdminTab; label: string; icon: LucideIcon }[] =
  [
    { key: 'overview', label: 'Overview & Leaderboard', icon: LayoutDashboard },
    { key: 'teams', label: 'Teams', icon: Users },
    { key: 'judges', label: 'Judges', icon: UserCheck },
    { key: 'controls', label: 'Round Timer & Controls', icon: Sliders },
    { key: 'qr', label: 'QR Code', icon: QrCode },
    { key: 'results', label: 'Results & Exports', icon: Award },
    { key: 'archives', label: 'Archived Events', icon: Archive },
    { key: 'settings', label: 'Event Settings', icon: Settings },
  ];

export function parseAdminTab(value: string | null): AdminTab {
  return ADMIN_NAV_TABS.some((tab) => tab.key === value)
    ? (value as AdminTab)
    : 'overview';
     }
