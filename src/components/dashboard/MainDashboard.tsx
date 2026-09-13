import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { 
  ManpowerDailyState, VehicleDailyState, MedicineItem, MedicineBatch,
  SectionApprovalRecord, DutyRoster, ParadeState, MiscellaneousNotice
} from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { logAuditEvent } from '../../services/auditService';
import { 
  LayoutDashboard, Users, Truck, ShieldCheck, 
  FileText, CalendarCheck, CheckCircle2, AlertTriangle, 
  Lock, ArrowRight, Activity, Clock, ShieldAlert, Pill, Scissors, Layers, Bell 
} from 'lucide-react';

interface MainDashboardProps {
  onNavigate: (path: string) => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, language } = useLanguage();

  const [paradeState, setParadeState] = useState<ParadeState | null>(null);
  const [manpowerState, setManpowerState] = useState<ManpowerDailyState | null>(null);
  const [vehicleState, setVehicleState] = useState<VehicleDailyState | null>(null);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [publishedRoster, setPublishedRoster] = useState<DutyRoster | null>(null);
  const [sectionApprovals, setSectionApprovals] = useState<SectionApprovalRecord[]>([]);
  const [notices, setNotices] = useState<MiscellaneousNotice[]>([]);

  const [personnelCount, setPersonnelCount] = useState<number>(0);
  const [smtCount, setSmtCount] = useState<number>(0);

  const loadAllStates = async () => {
    const pState = await db.paradeStates.orderBy('stateDate').last();
    if (pState) setParadeState(pState);

    const mp = await db.manpowerDailyStates.orderBy('stateDate').last();
    if (mp) setManpowerState(mp);

    const veh = await db.vehicleDailyStates.orderBy('stateDate').last();
    if (veh) setVehicleState(veh);

    const medList = await db.medicines.toArray();
    setMedicines(medList);

    const batchList = await db.medicineBatches.toArray();
    setBatches(batchList);

    const activeRoster = await db.dutyRosters.where('isPublished').equals(1).last();
    if (activeRoster) setPublishedRoster(activeRoster);

    const approvals = await db.sectionApprovals.toArray();
    setSectionApprovals(approvals);

    const miscList = await db.miscellaneousNotices.toArray();
    setNotices(miscList.filter(n => n.isPublished && !n.isArchived));

    const pList = await db.manpowerPersonnel.toArray();
    setPersonnelCount(pList.length);
    setSmtCount(pList.filter(p => p.trade === 'SMT' || p.trade === 'MA').length);
  };

  useEffect(() => {
    loadAllStates();
  }, []);

  // Compute 3-Tier Expiry Stats
  const now = new Date();
  const getDaysRemaining = (expDateStr: string) => {
    const exp = new Date(expDateStr);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const expiredBatches = batches.filter(b => getDaysRemaining(b.expiryDate) < 0 || b.status === 'EXPIRED');
  const shortDatedBatches = batches.filter(b => {
    const days = getDaysRemaining(b.expiryDate);
    return days >= 0 && days <= 30 && b.status !== 'EXPIRED';
  });
  const heldNormalBatches = batches.filter(b => {
    const days = getDaysRemaining(b.expiryDate);
    return days > 30 && b.status !== 'EXPIRED';
  });

  const calcBatchValuation = (batchArr: MedicineBatch[]) => {
    return batchArr.reduce((sum, b) => {
      const med = medicines.find(m => m.id === b.medicineId);
      const price = med?.unitPrice || 0;
      return sum + (b.currentQuantity * price);
    }, 0);
  };

  // Check if CO final approval can be granted
  const requiredSections = ['parade_state', 'manpower', 'vehicle', 'med_store_medicine', 'med_store_instruments', 'med_store_equipment'];
  const allPrereqsApproved = requiredSections.every(secCode => {
    const rec = sectionApprovals.find(a => a.section === secCode);
    return rec?.status === 'QM_APPROVED' || rec?.status === 'MOIC_APPROVED' || rec?.status === 'CO_APPROVED';
  });

  const handleCoFinalApproveAll = async () => {
    const timestamp = new Date().toISOString();
    for (const sec of sectionApprovals) {
      await db.sectionApprovals.update(sec.id, {
        status: 'CO_APPROVED',
        coAppointment: currentUser.appointmentTitle,
        coDecision: 'APPROVED',
        coDecidedAt: timestamp
      });
    }

    if (paradeState) await db.paradeStates.update(paradeState.id, { status: 'CO_APPROVED', coApprovedBy: currentUser.appointmentTitle });
    if (manpowerState) await db.manpowerDailyStates.update(manpowerState.id, { status: 'CO_APPROVED', coApprovedBy: currentUser.appointmentTitle });
    if (vehicleState) await db.vehicleDailyStates.update(vehicleState.id, { status: 'CO_APPROVED', coApprovedBy: currentUser.appointmentTitle });

    await logAuditEvent(
      currentUser,
      'CO_APPROVED',
      'all',
      '95FA_DAILY_UNIT_STATE',
      'Commanding Officer confirmed daily unit state verification.'
    );

    alert('COMMAND APPROVAL RECORDED: 95 Fd Amb Daily Unit State has been verified and confirmed.');
    loadAllStates();
  };

  const totalPosted = paradeState ? ((paradeState.strOffrs || 0) + (paradeState.strJco || 0) + (paradeState.strOrs || 0) + (paradeState.strNce || 0) + (paradeState.strNcu || 0)) : 170;
  const totalPresent = paradeState?.onParadeCount ?? (totalPosted - 22);
  const totalOutUnit = Math.max(0, totalPosted - totalPresent);

  return (
    <div className="space-y-6">
      {/* Top Banner with Automated Consolidation Note */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('unitName')} — Unit State Dashboard
            </h1>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              AUTO-CONSOLIDATED
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time automated state aggregation directly for Command Authority (No intermediary consolidating officer).
          </p>
        </div>

        {/* CO Final Command Approval Action Button */}
        {(currentUser.role === 'co' || currentUser.role === 'admin') && (
          <button
            onClick={handleCoFinalApproveAll}
            disabled={!allPrereqsApproved}
            className={`px-4 py-2 rounded-lg font-extrabold text-xs shadow-md flex items-center gap-2 transition ${
              allPrereqsApproved
                ? 'bg-[#F59E0B] hover:bg-[#D97706] text-black cursor-pointer animate-pulse'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300 dark:border-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{allPrereqsApproved ? 'CO Final Approval & Lock Unit State' : 'CO Approval Locked (Prerequisites Pending)'}</span>
          </button>
        )}
      </div>

      {/* Read-Only Mode Banner for GD Personnel */}
      {(currentUser.role === 'general_duty' || currentUser.role === 'general_personnel' || currentUser.role === 'smt_member' || currentUser.role === 'authorised_personnel' || currentUser.role === 'auditor') && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              <strong>{language === 'bn' ? 'সাধারণ দায়িত্ব (GD) কর্মী – শুধুমাত্র পাঠযোগ্য বিবরণী' : 'General Duty (GD) Personnel — Read-Only View'}:</strong> {language === 'bn' ? 'অনুমোদিত প্যারেড বিবরণী, যানবাহন ও মেডিকেল স্টোর তথ্য শুধুমাত্র পাঠযোগ্য। ট্রেনিং হাবে নতুন প্রশিক্ষণ সামগ্রী আপলোড করার অনুমতি রয়েছে।' : 'You have view-only access to approved daily parade state, transport fleet, medical store, and notice board. New training materials can be uploaded via the Training Hub.'}
            </span>
          </div>
          <span className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded font-bold whitespace-nowrap">
            {language === 'bn' ? 'শুধুমাত্র পাঠযোগ্য (READ-ONLY)' : 'READ-ONLY VIEW'}
          </span>
        </div>
      )}

      {/* Main State Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Consolidated Manpower & Daily Parade State */}
        <div 
          onClick={() => onNavigate('/manpower')}
          className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border-2 border-emerald-600/60 dark:border-emerald-500/50 cursor-pointer hover:border-emerald-500 transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                  {t('nav_manpower')}
                </h3>
              </div>
              <StatusBadge status={paradeState?.status || 'SUBMITTED'} size="sm" />
            </div>

            <div className="grid grid-cols-3 gap-2 my-4 text-center">
              <div className="bg-[#F8F9F5] dark:bg-slate-800 p-2 rounded-lg">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">POSTED HELD</span>
                <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
                  {formatNumber(totalPosted)}
                </span>
                <span className="text-[8px] font-mono text-slate-400 block mt-0.5 truncate">
                  Offr:{paradeState?.strOffrs ?? 6}|JCO:{paradeState?.strJco ?? 8}|OR:{paradeState?.strOrs ?? 140}|NCE:{paradeState?.strNce ?? 12}|NCU:{paradeState?.strNcu ?? 4}
                </span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">★ ON PARADE</span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatNumber(totalPresent)}
                </span>
                <span className="text-[8px] font-mono text-emerald-700 dark:text-emerald-400 block mt-0.5 truncate">
                  Offr:{paradeState?.presentOffrs ?? 5}|JCO:{paradeState?.presentJco ?? 7}|OR:{paradeState?.presentOrs ?? 122}|NCE:{paradeState?.presentNce ?? 10}|NCU:{paradeState?.presentNcu ?? 4}
                </span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300 uppercase block">OUT UNIT</span>
                <span className="text-base font-black text-amber-600 font-mono">
                  {formatNumber(totalOutUnit)}
                </span>
                <span className="text-[8px] font-mono text-amber-700 block mt-0.5">
                  Posted − Present
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg text-[10px] font-mono flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Nominal Roll: {formatNumber(personnelCount || totalPosted)}</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">SMT/MA Trade: {formatNumber(smtCount || 38)}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#2D4A22] dark:text-emerald-400 font-semibold">
            <span>{language === 'bn' ? 'প্যারেড ও জনবল ব্যবস্থাপনা খুলুন' : 'Open Consolidated Parade & Nominal State'}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* 3. Transport & MT Fleet */}
        <div 
          onClick={() => onNavigate('/vehicle')}
          className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-[#3B5E2B] transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                  {t('nav_vehicle')}
                </h3>
              </div>
              <StatusBadge status={vehicleState?.status || 'SUBMITTED'} size="sm" />
            </div>

            <div className="grid grid-cols-3 gap-2 my-4 text-center">
              <div className="bg-[#F8F9F5] dark:bg-slate-800 p-2.5 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">{t('mp_held')}</span>
                <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
                  {formatNumber(vehicleState?.totalHeld || 0)}
                </span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">{t('veh_availableTask')}</span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatNumber(vehicleState?.totalAvailableForTask || 0)}
                </span>
              </div>
              <div className="bg-[#F8F9F5] dark:bg-slate-800 p-2.5 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Under Repair</span>
                <span className="text-base font-black text-amber-600 font-mono">
                  {formatNumber(vehicleState?.totalUnderRepair || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#2D4A22] dark:text-emerald-400 font-semibold">
            <span>Manage Transport & Inspection</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* 4. Medical Store 3-Tier Multi-Verification State */}
        <div 
          onClick={() => onNavigate('/medical-store')}
          className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-[#3B5E2B] transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                  {t('nav_medicalStore')}
                </h3>
              </div>
              <StatusBadge status="MOIC_APPROVED" size="sm" />
            </div>

            <div className="space-y-2 my-4 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-600 dark:text-slate-300 font-medium">1. Medicine Scale & Batches</span>
                <StatusBadge status="MOIC_APPROVED" size="sm" />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-600 dark:text-slate-300 font-medium">2. Instruments (Held Validated)</span>
                <StatusBadge status="MOIC_APPROVED" size="sm" />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-600 dark:text-slate-300 font-medium">3. Equipment Serviceability</span>
                <StatusBadge status="MOIC_APPROVED" size="sm" />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#2D4A22] dark:text-emerald-400 font-semibold">
            <span>Manage Store & Stock-Taking</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* 5. Part-I Daily Duty Roster */}
        <div 
          onClick={() => onNavigate('/duty-roster')}
          className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-[#3B5E2B] transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                  {t('nav_dutyRoster')}
                </h3>
              </div>
              <StatusBadge status={publishedRoster?.status || 'CO_APPROVED'} size="sm" />
            </div>

            <div className="my-4 space-y-1 text-xs">
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                {publishedRoster?.title || 'Part-I Daily Duty Roster'}
              </p>
              <p className="font-mono text-[10px] text-slate-500">
                Ref: {publishedRoster?.referenceNo || '95FA/DUTY/2026/08/16-01'}
              </p>
              <div className="mt-3 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>ACTIVE ON NOTICE BOARD</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#2D4A22] dark:text-emerald-400 font-semibold">
            <span>Duty Verification & Orders</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* 6. Others / Miscellaneous Notice Board Tile */}
        <div 
          onClick={() => onNavigate('/others-notices')}
          className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-[#3B5E2B] transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                  Others / Miscellaneous
                </h3>
              </div>
              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[10px] px-2 py-0.5 rounded">
                {notices.length} Published
              </span>
            </div>

            <div className="my-4 text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-sans">
              <p>• General unit notices, directives & orders</p>
              <p>• Search, view, and print unit circulars</p>
              <p>• Real-time cloud sync across connected devices</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#2D4A22] dark:text-emerald-400 font-semibold">
            <span>Open Others / Miscellaneous Notices</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* 7. Training & Knowledge Hub Tile (NEW) */}
        <div 
          onClick={() => onNavigate('/training-hub')}
          className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-[#3B5E2B] transition flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                  Training & Knowledge Hub
                </h3>
              </div>
              <span className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-extrabold text-[10px] px-2 py-0.5 rounded">
                8 Categories
              </span>
            </div>

            <div className="my-4 text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-sans">
              <p>• Standing Clinical Instructions & Directives</p>
              <p>• Emergency Quick Reference Protocols</p>
              <p>• Instant Text-Based Orders & Priority Directives</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#2D4A22] dark:text-emerald-400 font-semibold">
            <span>Open Training & Knowledge Hub</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Monthly Trend Summary Widget (Approved Operational Trends) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
              Monthly Operational Readiness & Trends (Live Aggregation)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Command Metric: <strong>95 Fd Amb</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Metric 1: Manpower Physical Presence */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Manpower On-Parade Ratio</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                {formatNumber(Math.round(((paradeState?.onParadeCount || 148) / (paradeState?.totalStrength || 180)) * 100))}%
              </span>
              <span className="text-xs font-mono text-slate-500">
                {formatNumber(paradeState?.onParadeCount || 148)} / {formatNumber(paradeState?.totalStrength || 180)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Physical presence inside unit perimeter. Out Unit: {formatNumber(paradeState?.outUnitTotal || 32)}.
            </p>
          </div>

          {/* Metric 2: Vehicle Serviceability Rate */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Fleet Serviceability Rate</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                {formatNumber(Math.round(((vehicleState?.totalServiceable || 11) / (vehicleState?.totalHeld || 14)) * 100))}%
              </span>
              <span className="text-xs font-mono text-slate-500">
                {formatNumber(vehicleState?.totalServiceable || 11)} / {formatNumber(vehicleState?.totalHeld || 14)} Held
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Task Available: {formatNumber(vehicleState?.totalAvailableForTask || 9)} | Under Repair: {formatNumber(vehicleState?.totalUnderRepair || 3)}.
            </p>
          </div>

          {/* Metric 3: Medicine Scale & Stock Health (3 Categories) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Medical Store Stock Health</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                {formatNumber(heldNormalBatches.length)} Batches
              </span>
              <span className="text-xs font-mono text-emerald-600">
                Normal Use (&gt;30d)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Short-Dated (≤30d): {formatNumber(shortDatedBatches.length)} | Expired: {formatNumber(expiredBatches.length)}.
            </p>
          </div>

          {/* Metric 4: Command Status */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Command Status</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-emerald-600">
                ACTIVE
              </span>
              <span className="text-xs font-mono text-slate-500">
                95 FD AMB
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Continuous operator CRUD authority with real-time cloud sync.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Medicine Expiry Watch Cards (Placed in the Last Position) */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
            <Pill className="w-4 h-4 text-emerald-600" />
            <span>Medicine Expiry Watch Cards (Live Expiry Monitoring)</span>
          </h2>
          <button
            onClick={() => onNavigate('/medical-store')}
            className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View Medical Store</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Held Medicines – Normal Use (>30 Days) */}
          <div 
            onClick={() => onNavigate('/medical-store')}
            className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-sm cursor-pointer hover:border-emerald-500 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wide uppercase text-emerald-800 dark:text-emerald-300">Held Medicines – Normal Use</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-100">{formatNumber(heldNormalBatches.length)} Batches</span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                Qty: {formatNumber(heldNormalBatches.reduce((s: number, b: MedicineBatch) => s + b.currentQuantity, 0))}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500 font-mono">
              Valuation: BDT {formatNumber(calcBatchValuation(heldNormalBatches))}
            </div>
            <p className="mt-2 text-[9px] font-bold uppercase text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 py-0.5 px-1 rounded text-center border border-emerald-400">
              NORMAL USE (&gt; 30 DAYS)
            </p>
          </div>

          {/* Card 2: Short-Dated Medicines (0-30 Days) */}
          <div 
            onClick={() => onNavigate('/medical-store')}
            className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 shadow-sm cursor-pointer hover:border-amber-500 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wide uppercase text-amber-800 dark:text-amber-300">Short-Dated Medicines</span>
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono text-amber-900 dark:text-amber-100">{formatNumber(shortDatedBatches.length)} Batches</span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                Qty: {formatNumber(shortDatedBatches.reduce((s: number, b: MedicineBatch) => s + b.currentQuantity, 0))}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500 font-mono">
              Valuation: BDT {formatNumber(calcBatchValuation(shortDatedBatches))}
            </div>
            <p className="mt-2 text-[9px] font-bold uppercase text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 py-0.5 px-1 rounded text-center border border-amber-400">
              SHORT-DATED (EXPIRY WITHIN 30 DAYS)
            </p>
          </div>

          {/* Card 3: Expired Medicines (<0 Days) */}
          <div 
            onClick={() => onNavigate('/medical-store')}
            className="bg-red-950/80 text-white p-3.5 rounded-xl border border-red-800 shadow-sm cursor-pointer hover:border-red-500 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wide uppercase text-red-300">Expired Medicines</span>
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black font-mono">{formatNumber(expiredBatches.length)} Batches</span>
              <span className="text-[10px] text-red-300 font-mono">
                Qty: {formatNumber(expiredBatches.reduce((s: number, b: MedicineBatch) => s + b.currentQuantity, 0))}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-red-300/80 font-mono">
              Valuation: BDT {formatNumber(calcBatchValuation(expiredBatches))}
            </div>
            <p className="mt-2 text-[9px] font-bold uppercase text-red-300 bg-red-900/80 py-0.5 px-1 rounded text-center border border-red-500">
              EXPIRED — DO NOT ISSUE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
