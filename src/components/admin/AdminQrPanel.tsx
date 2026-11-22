import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink, Printer } from 'lucide-react';
import type { EventSettings } from '../../types/arena';
import { buildJudgePortalUrl } from '../../utils/scoring';

interface AdminQrPanelProps {
  settings: EventSettings;
  onNotify: (msg: string) => void;
}

export function AdminQrPanel({ settings, onNotify }: AdminQrPanelProps) {
  const targetUrl = buildJudgePortalUrl(
    settings.customDomain,
    typeof window !== 'undefined' ? window.location.origin : '',
  );
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(targetUrl, {
      width: 420,
      margin: 2,
      color: {
        dark: '#092B59',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [targetUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(targetUrl);
    onNotify('Copied Judge Access URL to clipboard.');
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'rank-rush-judge-qr.png';
    link.click();
    onNotify('Downloaded Judge Access QR code.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 print:bg-white print:border-none">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-xl bg-[#081422] print:bg-white">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR code for RANK RUSH Judge Login"
              className="w-64 h-64 rounded-lg bg-white p-2.5"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center text-sm text-slate-400">
              Generating QR code...
            </div>
          )}
          <div className="mt-4 text-center">
            <div className="font-display font-bold text-white print:text-[#092B59]">
              RANK RUSH
            </div>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
              Scan to Open Judge Portal
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <div>
            <h2 className="text-xl font-display font-bold text-white print:text-[#092B59]">
              Mobile Judge QR Code Access
            </h2>
            <p className="text-sm text-slate-300 print:text-slate-600 mt-1.5 leading-relaxed">
              Display this QR code on the projector or print copies for judge
              desks. Judges scan with any Android or iPhone camera to open the
              Judge Login screen directly.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#081422] print:bg-slate-50 space-y-1.5">
            <div className="text-xs font-semibold text-[#F5B942] print:text-[#092B59]">
              Encoded Judge Access URL
            </div>
            <div className="font-mono-tabular text-xs sm:text-sm text-white print:text-[#092B59] break-all">
              {targetUrl}
            </div>
            <p className="text-xs text-slate-400 print:text-slate-600 pt-1">
              {settings.customDomain
                ? 'Using your configured custom domain from Event Settings.'
                : 'Using the current hosting URL. You can connect a custom domain in Event Settings.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
            >
              <Download className="w-4 h-4" />
              Download QR PNG
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-slate-200 text-sm font-semibold hover:bg-[#102640] transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Link
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-slate-200 text-sm font-semibold hover:bg-[#102640] transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print QR Sheet
            </button>
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-[#F5B942] text-sm font-semibold hover:bg-[#102640] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
