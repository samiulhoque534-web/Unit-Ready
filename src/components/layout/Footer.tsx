import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-[#1E3316] text-slate-300 text-[11px] border-t border-[#3B5E2B] py-3 px-4 sm:px-6 z-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
        {/* Governance Disclaimer */}
        <div className="flex items-center space-x-2 text-amber-300">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span className="leading-tight font-sans">
            {t('governanceNoticeFull')}
          </span>
        </div>

        {/* Security & Deployment Badges */}
        <div className="flex items-center space-x-3 text-slate-400 font-mono text-[10px]">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>95 Fd Amb</span>
          </span>
          <span>•</span>
          <span>Offline Intranet Deployment</span>
          <span>•</span>
          <span className="text-emerald-400">PWA v1.0.0</span>
        </div>
      </div>
    </footer>
  );
};
