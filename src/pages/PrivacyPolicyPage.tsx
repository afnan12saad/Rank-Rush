import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-200">
      <SiteHeader />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="border-b border-[#183152] pb-5">
          <p className="text-xs font-semibold text-[#F5B942]">
            Legal & Data Governance
          </p>
          <h1 className="text-3xl font-display font-bold text-white mt-1">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Effective Date: November 20, 2026 | RANK RUSH Evaluation System
          </p>
        </div>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-display font-bold text-white">
            1. Information Collected
          </h2>
          <p>
            RANK RUSH collects only the information necessary to administer
            academic project evaluations: authorized judge identifiers, names,
            academic departments, authentication email addresses used for
            account verification, five-criteria team scores (0 to 5 each), and optional
            written evaluation remarks.
          </p>
        </section>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-display font-bold text-white">
            2. Confidentiality of Individual Judge Ratings
          </h2>
          <p>
            Individual judge ratings and written feedback are strictly private.
            Judges can view only their own submitted ratings, and public
            projector or results displays never disclose individual judge
            identities or single-judge score breakdowns. Only aggregated team
            averages and submission counts are displayed once published by the
            event administrator.
          </p>
        </section>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-display font-bold text-white">
            3. Data Security & Retention
          </h2>
          <p>
            All evaluation records are stored in Google Cloud Firestore protected
            by role-based security rules and verified authentication tokens.
            Event administrators may export final reports for institutional
            records and reset event data upon completion of the showcase.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
