import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { SectionApprovalRecord } from '../../types';
import { MedicineSubModule } from './MedicineSubModule';
import { InstrumentsSubModule } from './InstrumentsSubModule';
import { EquipmentSubModule } from './EquipmentSubModule';
import { MonthlyMedicalAuditSubModule } from './MonthlyMedicalAuditSubModule';
import { MedicineIssueHistorySubModule } from './MedicineIssueHistorySubModule';
import { StatusBadge } from '../common/StatusBadge';
import { 
  Pill, Scissors, Activity, CheckCircle, 
  AlertCircle, ShieldCheck, Layers, ClipboardCheck, History
} from 'lucide-react';

export const MedicalStoreModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'medicine' | 'instruments' | 'equipment' | 'audit' | 'history'>('medicine');
  const [medApproval, setMedApproval] = useState<SectionApprovalRecord | null>(null);
  const [instApproval, setInstApproval] = useState<SectionApprovalRecord | null>(null);
  const [eqApproval, setEqApproval] = useState<SectionApprovalRecord | null>(null);

  const loadApprovals = async () => {
    const med = await db.sectionApprovals.where('section').equals('med_store_medicine').last();
    if (med) setMedApproval(med);
    const inst = await db.sectionApprovals.where('section').equals('med_store_instruments').last();
    if (inst) setInstApproval(inst);
    const eq = await db.sectionApprovals.where('section').equals('med_store_equipment').last();
    if (eq) setEqApproval(eq);
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const isApprovedStatus = (status?: string) => 
    status === 'MOIC_APPROVED' || status === 'CO_APPROVED';

  const allThreeApproved = 
    isApprovedStatus(medApproval?.status) &&
    isApprovedStatus(instApproval?.status) &&
    isApprovedStatus(eqApproval?.status);

  return (
    <div className="space-y-6">
      {/* 3-Subsection Verification Progress Interlock Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_medicalStore')} (MOIC Review → CO Final Approval)
            </h2>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            allThreeApproved 
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          }`}>
            {allThreeApproved 
              ? 'ALL MEDICAL SUBSECTIONS MOIC REVIEWED — READY FOR CO FINAL APPROVAL' 
              : 'SUBSECTION MOIC / CO APPROVALS IN PROGRESS'}
          </span>
        </div>

        {/* 3-Subsections Status Pill Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className={`p-3 rounded-lg border flex items-center justify-between ${isApprovedStatus(medApproval?.status) ? 'bg-emerald-50/50 border-emerald-300 dark:bg-emerald-950/30' : 'bg-amber-50/50 border-amber-300 dark:bg-amber-950/30'}`}>
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <div>
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">1. {t('sub_medicine')}</p>
                <span className="text-[10px] text-slate-500 font-mono">FEFO & Expiry Controls</span>
              </div>
            </div>
            <StatusBadge status={medApproval?.status || 'SUBMITTED'} size="sm" />
          </div>

          <div className={`p-3 rounded-lg border flex items-center justify-between ${isApprovedStatus(instApproval?.status) ? 'bg-emerald-50/50 border-emerald-300 dark:bg-emerald-950/30' : 'bg-amber-50/50 border-amber-300 dark:bg-amber-950/30'}`}>
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <div>
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">2. {t('sub_instruments')}</p>
                <span className="text-[10px] text-slate-500 font-mono">Sterilization & Sets</span>
              </div>
            </div>
            <StatusBadge status={instApproval?.status || 'SUBMITTED'} size="sm" />
          </div>

          <div className={`p-3 rounded-lg border flex items-center justify-between ${isApprovedStatus(eqApproval?.status) ? 'bg-emerald-50/50 border-emerald-300 dark:bg-emerald-950/30' : 'bg-amber-50/50 border-amber-300 dark:bg-amber-950/30'}`}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <div>
                <p className="font-bold text-xs text-slate-800 dark:text-slate-200">3. {t('sub_equipment')}</p>
                <span className="text-[10px] text-slate-500 font-mono">Electro-Medical Tracking</span>
              </div>
            </div>
            <StatusBadge status={eqApproval?.status || 'SUBMITTED'} size="sm" />
          </div>
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
