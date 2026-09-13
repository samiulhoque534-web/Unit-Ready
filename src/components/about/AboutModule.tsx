import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  ShieldAlert, ShieldCheck, CheckCircle2, 
  Terminal, Server, Lock, Cpu, Globe 
} from 'lucide-react';

export const AboutModule: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero Box */}
      <div className="bg-gradient-to-r from-[#1E3316] to-[#2D4A22] rounded-2xl p-6 text-white shadow-lg border border-[#3B5E2B] text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-[#2D4A22] border-2 border-[#F59E0B] shadow-inner mb-1">
          <ShieldCheck className="w-10 h-10 text-[#F59E0B]" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-wider uppercase font-sans">
          {t('appTitle')}
        </h2>
        <p className="text-xs sm:text-sm text-emerald-200 font-medium max-w-2xl mx-auto">
          {t('appSubtitle')}
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
          <span className="bg-[#D97706] text-black px-2 py-0.5 rounded font-bold uppercase">v1.0.0 Stable</span>
          <span className="bg-[#3B5E2B] text-white px-2 py-0.5 rounded border border-emerald-500">Air-Gapped / Offline-First</span>
          <span className="bg-[#3B5E2B] text-white px-2 py-0.5 rounded border border-emerald-500">95 Fd Amb</span>
        </div>
      </div>

      {/* Mandatory Governance Notice Card */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wide">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>Mandatory Administrative Governance Notice</span>
        </div>
        <p className="text-xs leading-relaxed text-amber-950 dark:text-amber-200 font-sans font-medium">
          “This application is an administrative and decision-support system. It does not replace official registers, authorised accounting procedures, clinical decisions, technical inspections or command policies unless formally approved by the competent authority.”
        </p>
      </div>

      {/* System Specifications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
          <h3 className="font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>Security & Data Sovereignty</span>
          </h3>
          <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>• Local intranet server deployment (Zero public internet dependency).</li>
            <li>• Device Whitelisting with one-time 6-digit numeric installation PINs.</li>
            <li>• Session inactivity auto-logout at 15 minutes.</li>
            <li>• AES-GCM-256 encrypted local backup and restore.</li>
            <li>• Append-only tamper-evident audit logging.</li>
            <li>• <strong>No weapon-related data or modules exist in this system.</strong></li>
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
          <h3 className="font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            <span>Command Architecture</span>
          </h3>
          <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>• Progressive Web App (PWA) with Service Worker offline caching.</li>
            <li>• Automatic System-Level Consolidation (No Consolidating Officer required).</li>
            <li>• 4-Tier Hierarchy: Operator → 2IC → QM / MOIC → CO.</li>
            <li>• Bilingual interface: English and Noto Sans Bengali (বাংলা).</li>
            <li>• Timezone: Asia/Dhaka with 24-hour military notation.</li>
            <li>• 7-Stage controlled correction & version bump protocol.</li>
          </ul>
        </div>
      </div>

      {/* Developer Credit */}
      <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans tracking-wide">
          App developed by BSS-102661 Capt Tasnim Sultana, AMC
        </p>
      </div>
    </div>
  );
};
