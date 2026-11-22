import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';

export function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-200">
      <SiteHeader />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="border-b border-[#183152] pb-5">
          <p className="text-xs font-semibold text-[#F5B942]">
            Legal & Event Rules
          </p>
          <h1 className="text-3xl font-display font-bold text-white mt-1">
            Terms & Conditions
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Effective Date: November 20, 2026 | RANK RUSH Evaluation System
          </p>
        </div>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-display font-bold text-white">
            1. Authorized Judging Participation
          </h2>
          <p>
            Judges access the evaluation portal using their full name and email
            address. Submitting ratings under another person&apos;s identity or
            manipulating submissions is prohibited.
          </p>
        </section>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-display font-bold text-white">
            2. Single Overall Rating Integrity
          </h2>
          <p>
            Each judge may submit one set of five criteria scores (0 to 5 each, total out of 25) per
            participating team. Submitted scores are final unless the event
            administrator explicitly enables rating edits prior to result
            publication. Team averages are computed solely from valid submitted
            ratings.
          </p>
        </section>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-display font-bold text-white">
            3. Official Result Publication
          </h2>
          <p>
            The event administrator retains authority over timer control,
            submission windows, tie-breaker configuration, and public release of
            the final leaderboard.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
