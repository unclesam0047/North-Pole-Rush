import React, { useState } from 'react';
import { Download, MonitorSmartphone, Share, WifiOff, X, Check } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'prominent';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, offlineReady, install } =
    usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuide(true);
  };

  const buttonClasses =
    variant === 'prominent'
      ? 'inline-flex items-center justify-center gap-2 rounded-lg border border-sky-300/35 bg-[#0e203d] px-5 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-[#152d54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]'
      : 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#0c1a33]/90 px-3.5 py-2 text-xs font-semibold text-slate-100 transition hover:bg-[#14294d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]';

  return (
    <>
      <button type="button" onClick={handleClick} className={buttonClasses}>
        <Download className="h-4 w-4 text-sky-300" aria-hidden="true" />
        <span>{isInstallable ? 'Install App' : 'Download / Install'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-[#0b182e] p-6 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-300/25 bg-[#122647] text-sky-300">
                  <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="pwa-install-title" className="font-display text-lg font-semibold text-white">
                    Install North Pole Rush 2.5D
                  </h3>
                  <p className="text-xs text-slate-400">
                    {offlineReady
                      ? 'Offline game cache ready for desktop & mobile'
                      : 'Install as a standalone app for offline play'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-200">
              {isInIframe && (
                <div className="rounded-lg border border-amber-400/25 bg-[#172138] p-3.5 text-xs leading-relaxed text-amber-100">
                  <p className="font-semibold text-amber-300">Open directly in your browser tab</p>
                  <p className="mt-1 text-slate-300">
                    If you are viewing inside an embedded preview, open the app URL in its own browser tab so your device can show the native Install prompt.
                  </p>
                </div>
              )}

              {isIOS ? (
                <div className="rounded-lg border border-white/10 bg-[#10213d] p-4 space-y-2">
                  <p className="font-semibold text-white">iPhone & iPad (Safari)</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed text-slate-300">
                    <li>
                      Tap the <Share className="inline h-3.5 w-3.5 text-sky-300 mx-0.5" aria-hidden="true" />{' '}
                      <strong className="text-white">Share</strong> button in Safari.
                    </li>
                    <li>
                      Scroll down and choose <strong className="text-white">Add to Home Screen</strong>.
                    </li>
                    <li>
                      Tap <strong className="text-white">Add</strong> to launch full-screen anytime, even offline.
                    </li>
                  </ol>
                </div>
              ) : isAndroid ? (
                <div className="rounded-lg border border-white/10 bg-[#10213d] p-4 space-y-2">
                  <p className="font-semibold text-white">Android (Chrome / Edge / Samsung Internet)</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed text-slate-300">
                    <li>
                      Tap the browser menu (<strong className="text-white">⋮</strong>) in the top-right corner.
                    </li>
                    <li>
                      Tap <strong className="text-white">Install app</strong> or{' '}
                      <strong className="text-white">Add to Home screen</strong>.
                    </li>
                    <li>Confirm to download the app icon and offline game cache.</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-[#10213d] p-4 space-y-2.5">
                  <p className="font-semibold text-white">Desktop & Mobile Installation</p>
                  <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
                    <li>
                      <strong className="text-white">Windows / macOS / Linux (Chrome or Edge):</strong> Click the{' '}
                      <strong className="text-white">Install</strong> icon in the address bar or open Menu →{' '}
                      <strong className="text-white">Cast, save, and share → Install page as app</strong>.
                    </li>
                    <li>
                      <strong className="text-white">macOS Safari:</strong> Click{' '}
                      <strong className="text-white">File → Add to Dock</strong>.
                    </li>
                    <li>
                      <strong className="text-white">iOS / Android:</strong> Open this URL on your phone and tap{' '}
                      <strong className="text-white">Add to Home Screen</strong> /{' '}
                      <strong className="text-white">Install app</strong>.
                    </li>
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>{offlineReady ? 'Offline assets cached' : 'Service worker active'}</span>
                </span>
                <span>Works offline once installed</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {isInstallable && (
                <button
                  type="button"
                  onClick={() => {
                    void install().then((ok) => {
                      if (ok) setShowGuide(false);
                    });
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 cursor-pointer min-h-[40px]"
                >
                  Install Now
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg border border-white/15 bg-[#132645] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-[#1b335c] cursor-pointer min-h-[40px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-300/35 bg-[#1b2236] px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
      <span>Offline Mode · Playing from local cache</span>
    </div>
  );
};
