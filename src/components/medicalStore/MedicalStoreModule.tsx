import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { MedicineSubModule } from './MedicineSubModule';
import { InstrumentsSubModule } from './InstrumentsSubModule';
import { EquipmentSubModule } from './EquipmentSubModule';
import { MonthlyMedicalAuditSubModule } from './MonthlyMedicalAuditSubModule';
import { MedicineIssueHistorySubModule } from './MedicineIssueHistorySubModule';
import { 
  Pill, Scissors, Activity, Layers, History, ClipboardCheck
} from 'lucide-react';

export const MedicalStoreModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'medicine' | 'instruments' | 'equipment' | 'audit' | 'history'>('medicine');

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#2D4A22]/10 dark:bg-emerald-950/40 rounded-xl border border-[#2D4A22]/20">
            <Layers className="w-6 h-6 text-[#2D4A22] dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_medicalStore')}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Comprehensive Unit Medical Logistics, FEFO Stock Control & Equipment Readiness
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-[#1E3316] text-white text-[11px] font-mono font-bold px-3 py-1 rounded-lg">
            95 FD AMB
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('medicine')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'medicine'
              ? 'border-[#2D4A22] text-[#2D4A22] dark:border-emerald-400 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>{t('sub_medicine')}</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-[#2D4A22] text-[#2D4A22] dark:border-emerald-400 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Medicine Issue History</span>
        </button>

        <button
          onClick={() => setActiveTab('instruments')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'instruments'
              ? 'border-[#2D4A22] text-[#2D4A22] dark:border-emerald-400 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>{t('sub_instruments')}</span>
        </button>

        <button
          onClick={() => setActiveTab('equipment')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'equipment'
              ? 'border-[#2D4A22] text-[#2D4A22] dark:border-emerald-400 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{t('sub_equipment')}</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-[#2D4A22] text-[#2D4A22] dark:border-emerald-400 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>{t('sub_monthlyAudit')}</span>
        </button>
      </div>

      {/* Render Active Subsection */}
      {activeTab === 'medicine' && <MedicineSubModule />}
      {activeTab === 'history' && <MedicineIssueHistorySubModule />}
      {activeTab === 'instruments' && <InstrumentsSubModule />}
      {activeTab === 'equipment' && <EquipmentSubModule />}
      {activeTab === 'audit' && <MonthlyMedicalAuditSubModule />}
    </div>
  );
};

export default MedicalStoreModule;
