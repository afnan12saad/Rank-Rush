import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  Mail,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  getAdminSlotUsage,
  removeAdminAccount,
  saveEventSettings,
  type AdminSlotUsage,
} from '../../services/arenaService';
import type {
  AdminQuota,
  AdminRequest,
  AdminUser,
  EventSettings,
} from '../../types/arena';
import { MAX_ADMIN_USERS } from '../../utils/scoring';
import { ConfirmDialog } from '../ConfirmDialog';

interface AdminSettingsPanelProps {
  settings: EventSettings;
  admins: AdminUser[];
  adminQuota: AdminQuota;
  adminRequests?: AdminRequest[];
  currentUid: string;
  onApproveRequest?: (req: AdminRequest) => Promise<void>;
  onRejectRequest?: (reqUid: string) => Promise<void>;
  onNotify: (msg: string) => void;
}

export function AdminSettingsPanel({
  settings,
  admins,
  adminQuota,
  adminRequests = [],
  currentUid,
  onApproveRequest,
  onRejectRequest,
  onNotify,
}: AdminSettingsPanelProps) {
  const [eventName, setEventName] = useState(settings.eventName);
  const [collegeName, setCollegeName] = useState(settings.collegeName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [venue, setVenue] = useState(settings.venue);
  const [eventDate, setEventDate] = useState(settings.eventDate);
  const [customDomain, setCustomDomain] = useState(settings.customDomain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [slotUsage, setSlotUsage] = useState<AdminSlotUsage | null>(null);
  const refreshSlots = () => {
    void getAdminSlotUsage().then(setSlotUsage).catch(() => setSlotUsage(null));
  };
  useEffect(refreshSlots, [admins.length]);
  const adminLimitReached =
    admins.length >= MAX_ADMIN_USERS ||
    (slotUsage !== null && (slotUsage.free.length === 0));

  // Sync local form fields whenever Firestore event settings update
  useEffect(() => {
    setEventName(settings.eventName);
    setCollegeName(settings.collegeName);
    setTagline(settings.tagline);
    setVenue(settings.venue);
    setEventDate(settings.eventDate);
    setCustomDomain(settings.customDomain);
  }, [
    settings.eventName,
    settings.collegeName,
    settings.tagline,
    settings.venue,
    settings.eventDate,
    settings.customDomain,
  ]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!eventName.trim() || !collegeName.trim()) {
      setError('Event Name and College / Institution Name are required.');
      return;
    }

    setBusy(true);
    try {
      await saveEventSettings({
        ...settings,
        eventName,
        collegeName,
        tagline,
        venue,
        eventDate,
        customDomain,
      });
      onNotify('Event settings and custom domain updated successfully.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save event settings. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget || removeTarget.uid === currentUid) return;
    setRemoveBusy(true);
    try {
      await removeAdminAccount(removeTarget.uid);
      onNotify(`Removed administrator access for ${removeTarget.email}.`);
      setRemoveTarget(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove administrator account.',
      );
    } finally {
      setRemoveBusy(false);
    }
  };

  const handleApprove = async (req: AdminRequest) => {
    if (!onApproveRequest) return;
    setActionBusyId(req.uid);
    try {
      await onApproveRequest(req);
      onNotify(`Accepted and added ${req.name} (${req.email}) as Administrator.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to approve admin request.',
      );
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = async (reqUid: string, email: string) => {
    if (!onRejectRequest) return;
    setActionBusyId(reqUid);
    try {
      await onRejectRequest(reqUid);
      onNotify(`Declined administrator request for ${email}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to decline request.',
      );
    } finally {
      setActionBusyId(null);
    }
  };

  const pendingRequests = adminRequests.filter((r) => r.status === 'pending');
  const pastRequests = adminRequests.filter((r) => r.status !== 'pending');

  const inputClass =
    'w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]';

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Event Details Form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 space-y-5"
      >
        <div>
          <h2 className="text-lg font-display font-bold text-white">
            Event & Custom Domain Settings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Edit event details, college identity, schedule, venue, and custom QR
            domain at any time. Changes update live across all views.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-red-950/60 text-red-200 text-sm flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="setting-event-name"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Event Name
            </label>
            <input
              id="setting-event-name"
              type="text"
              required
              maxLength={120}
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="setting-college-name"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              College / Institution Name
            </label>
            <input
              id="setting-college-name"
              type="text"
              required
              maxLength={140}
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="setting-tagline"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Event Tagline / Motto
            </label>
            <input
              id="setting-tagline"
              type="text"
              maxLength={120}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="setting-event-date"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Event Date / Schedule Label
            </label>
            <input
              id="setting-event-date"
              type="text"
              maxLength={60}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="setting-venue"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Venue / Auditorium Details
            </label>
            <input
              id="setting-venue"
              type="text"
              maxLength={140}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="setting-custom-domain"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Custom QR / Portal Domain (Optional)
            </label>
            <input
              id="setting-custom-domain"
              type="text"
              maxLength={200}
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="arena.mycollege.edu or https://arena.mycollege.edu"
              className={inputClass}
            />
            <p className="text-xs text-slate-400 mt-1">
              If your department operates a custom DNS alias, generated QR codes
              route to this custom domain instead of the default hosting URL.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {busy ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Admin Onboarding Requests Section */}
      <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E3A5F] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#F5B942]" />
              Admin Access Requests
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              New administrators request access here. Accepting adds them to the admin committee, up to the limit of 5 admin accounts.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-[#081422] text-xs font-semibold font-mono-tabular text-[#F5B942]">
            {pendingRequests.length} Pending
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="px-6 py-5 text-sm text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
            No pending admin requests. All incoming administrator join requests
            have been processed.
          </div>
        ) : (
          <div className="divide-y divide-[#152B46]">
            {pendingRequests.map((req) => {
              const isActionBusy = actionBusyId === req.uid;

              return (
                <div
                  key={req.uid}
                  className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0B1A2C]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {req.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-xs font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending Approval
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-mono-tabular">
                      {req.email}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isActionBusy || adminLimitReached}
                      title={adminLimitReached ? 'Admin limit reached' : undefined}
                      onClick={() => void handleApprove(req)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isActionBusy ? 'Accepting...' : 'Accept & Add Admin'}
                    </button>
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => void handleReject(req.uid, req.email)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/30 text-xs font-semibold text-red-300 hover:bg-red-950/60 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pastRequests.length > 0 && (
          <div className="px-6 py-3 bg-[#081422] border-t border-[#152B46] text-xs text-slate-400">
            {pastRequests.length} previous administrator request{pastRequests.length === 1 ? '' : 's'} recorded (Approved/Declined).
          </div>
        )}
      </div>

      {/* Authorized Admin Accounts Section */}
      <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E3A5F] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#F5B942]" />
              Authorized Admin Accounts
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Maximum of {MAX_ADMIN_USERS} admin accounts in total, owner included. Every new admin needs approval.
              Email addresses are not verified; approve only people you have confirmed outside the app.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-[#081422] text-xs font-semibold font-mono-tabular text-[#F5B942]">
            {admins.length} of {MAX_ADMIN_USERS} admin accounts
          </span>
        </div>
        {adminLimitReached && slotUsage?.reconciled && (
          <div className="px-4 py-2 border-b border-[#152B46] text-xs text-slate-300">
            All {MAX_ADMIN_USERS} admin seats are in use. Remove an admin to add another.
          </div>
        )}

        <div className="divide-y divide-[#152B46]">
          {admins.length === 0 ? (
            <div className="px-6 py-5 text-sm text-slate-400">
              No administrator records registered yet.
            </div>
          ) : (
            admins.map((admin) => {
              const isSelf = admin.uid === currentUid;
              return (
                <div
                  key={admin.uid}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {admin.name || 'Event Administrator'}
                      </span>
                      {admin.isFirstAdmin && (
                        <span className="px-2 py-0.5 rounded bg-[#F5B942]/15 text-[#F5B942] text-xs font-bold border border-[#F5B942]/30">
                          Primary Administrator
                        </span>
                      )}
                      {!admin.isFirstAdmin && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-semibold">
                          Administrator
                        </span>
                      )}
                      {isSelf && (
                        <span className="px-2 py-0.5 rounded bg-[#16A34A]/15 text-[#4ADE80] text-xs font-semibold">
                          Current Session
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono-tabular">
                      {admin.email}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSelf}
                    onClick={() => setRemoveTarget(admin)}
                    title={
                      isSelf
                        ? 'You cannot remove your own active admin session.'
                        : 'Remove administrator access'
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#24436B] bg-[#081422] text-xs font-semibold text-red-300 hover:bg-red-950/60 hover:text-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-start sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 py-3.5 bg-[#081422] border-t border-[#152B46] text-xs text-slate-300 flex items-center gap-2">
          <UserCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
          <span>
            New co-organizers can register at{' '}
            <span className="font-mono-tabular text-white">/admin/login</span>.
            Each request needs an existing admin to accept it (maximum of 5 admin accounts in total).
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        danger
        title="Remove Administrator Account"
        message={
          removeTarget
            ? `Revoke administrator privileges for ${removeTarget.email}?`
            : ''
        }
        confirmLabel="Remove Admin"
        busy={removeBusy}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
                    }
