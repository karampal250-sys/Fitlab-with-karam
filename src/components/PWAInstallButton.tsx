import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import type { Language } from '../types/fitplate';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  language: Language;
  variant?: 'button' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ language, variant = 'button' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const isHi = language === 'hi';

  if (isInstalled) {
    return null;
  }

  if (variant === 'card') {
    return (
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold">
              {isHi ? 'मोबाइल ऐप इंस्टॉल करें (Android / iOS)' : 'Install App on Phone (Android / iOS)'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isInstallable
                ? isHi
                  ? 'होम स्क्रीन पर सीधा इंस्टॉल करें — ऑफ़लाइन भी काम करता है।'
                  : 'Install Fit-Plat with Karam to your home screen for full-screen offline use.'
                : isIOS
                ? isHi
                  ? 'Safari में Share → Add to Home Screen चुनें।'
                  : 'In Safari: tap Share → Add to Home Screen.'
                : isHi
                ? 'Chrome मेनू (⋮) → Install app या Add to Home screen से इंस्टॉल करें।'
                : 'Open in Chrome on Android and tap Menu (⋮) → Install app.'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isInstallable) {
              install().catch(() => {});
            } else {
              setShowGuide(true);
            }
          }}
          className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0"
        >
          <Download className="w-4 h-4" />
          {isInstallable
            ? isHi
              ? 'ऐप इंस्टॉल करें'
              : 'Install App'
            : isHi
            ? 'इंस्टॉल गाइड'
            : 'Install / APK Info'}
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/60 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">
                  {isIOS
                    ? isHi
                      ? 'iPhone / iPad पर इंस्टॉल करें'
                      : 'Install on iPhone / iPad'
                    : isHi
                    ? 'Android फोन पर इंस्टॉल / APK गाइड'
                    : 'Install on Android / APK Guide'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close guide"
                  className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {isIOS ? (
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
                  <li>{isHi ? 'Safari में नीचे Share बटन दबाएं।' : 'Tap the Share button in Safari toolbar.'}</li>
                  <li>
                    {isHi ? 'नीचे स्क्रॉल करके Add to Home Screen चुनें।' : 'Scroll down and tap Add to Home Screen.'}
                  </li>
                </ol>
              ) : (
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 leading-relaxed">
                  <p>
                    <strong>1. Direct Android Install (Instant, No APK needed):</strong> Open the Shared App URL in
                    Android Chrome, tap the top-right menu (<strong>⋮</strong>) → <strong>Install app</strong>. It
                    installs as a full-screen offline app in your app drawer.
                  </p>
                  <p>
                    <strong>2. Generate a Play-Ready APK:</strong> Paste the Shared App URL into{' '}
                    <strong>pwabuilder.com</strong> → Package for Store → Android to download a signed{' '}
                    <code>.apk</code> / <code>.aab</code> package.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 text-white text-xs font-semibold"
              >
                {isHi ? 'समझ गया' : 'Got It'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isInstallable) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => install().catch(() => {})}
      className="min-h-[38px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
    >
      <Download className="w-3.5 h-3.5" />
      {isHi ? 'इंस्टॉल करें' : 'Install App'}
    </button>
  );
};
