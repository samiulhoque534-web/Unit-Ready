import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { SectionApprovalRecord, ApprovalStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud } from '../../services/firebaseSyncService';
import { 
  ShieldCheck, CheckCircle2, RotateCcw, 
  PauseCircle, AlertTriangle, ArrowRight, Lock, 
  FileText, Users, Truck, Pill, Scissors, Activity, 
  CalendarCheck, Zap, Eye, CheckCheck, Clock, ExternalLink 
} from 'lucide-react';

interface ApprovalCentreModuleProps {
  onNavigate?: (path: string) => void;
}

export const ApprovalCentreModule: React.FC<ApprovalCentreModuleProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, language } = useLanguage();

  const [approvals, setApprovals] = useState<SectionApprovalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<SectionApprovalRecord | null>(null);
  const [actionType, setActionType] = useState<'RETURN' | 'HOLD' | null>(null);
  const [actionRemarks, setActionRemarks] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isBatchApproving, setIsBatchApproving] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');

  // Summary counts
  const [paradeStateCount, setParadeStateCount] = useState<number>(0);
  const [vehiclesHeld, setVehiclesHeld] = useState<number>(0);
  const [medicinesHeld, setMedicinesHeld] = useState<number>(0);
  const [correctionsPending, setCorrectionsPending] = useState<number>(0);

  const loadApprovals = async () => {
    const list = await db.sectionApprovals.toArray();
    setApprovals(list);

    try {
      const ps = await db.paradeStates.toArray();
      setParadeStateCount(ps.length);
      const v = await db.vehicleFleetItems.toArray();
      setVehiclesHeld(v.length);
      const m = await db.medicines.toArray();
      setMedicinesHeld(m.length);
      const corr = await db.correctionRequests.where('status').equals('PENDING_CO').toArray();
      setCorrectionsPending(corr.length);
    } catch (e) {
      console.warn('Dashboard count load:', e);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  // 1. Single Section CO Command Approval (WITHOUT Locking)
  const handleCoFinalApprove = async (record: SectionApprovalRecord) => {
    const timestamp = new Date().toISOString();
    const updatedRecord = {
      ...record,
      status: 'CO_APPROVED' as const,
      coAppointment: currentUser.appointmentTitle,
      coDecision: 'FINAL_APPROVED' as const,
      coRemarks: 'Command Approval granted. Records remain active & editable by authorized personnel.',
      coDecidedAt: timestamp
    };
    await db.sectionApprovals.update(record.id, updatedRecord);
    await syncEntityToCloud('sectionApprovals', record.id, updatedRecord);

    // Update corresponding underlying record if applicable
    if (record.section === 'parade_state' || record.section === 'manpower') {
      const p = await db.paradeStates.orderBy('stateDate').last();
      if (p) {
        const updatedP = { ...p, status: 'CO_APPROVED' as const, updatedAt: timestamp };
        await db.paradeStates.update(p.id, updatedP);
        await syncEntityToCloud('paradeStates', p.id, updatedP);
      }
    } else if (record.section === 'vehicle') {
      const v = await db.vehicleDailyStates.orderBy('stateDate').last();
      if (v) {
        const updatedV = { ...v, status: 'CO_APPROVED' as const, updatedAt: timestamp };
        await db.vehicleDailyStates.update(v.id, updatedV);
        await syncEntityToCloud('vehicleDailyStates', v.id, updatedV);
      }
    }

    await logAuditEvent(
      currentUser,
      'CO_APPROVED',
      record.section,
      record.id,
      `Commanding Officer approved daily state for section: ${record.sectionTitle}.`
    );

    alert(`CO APPROVAL GRANTED: ${record.sectionTitle} has received Commanding Officer command approval.`);
    loadApprovals();
  };

  // 2. ONE-CLICK MASTER BATCH APPROVAL FOR COMMANDING OFFICER (CO) WITHOUT LOCKING
  const handleApproveAllPending = async () => {
    const pendingList = approvals.filter(a => a.status !== 'CO_APPROVED');
    if (pendingList.length === 0) {
      alert('All unit section states are already approved.');
      return;
    }

    const confirmMsg = language === 'bn'
      ? `আপনি কি এক ক্লিকে সকল (${pendingList.length} টি) সেকশনের রিপোর্ট অনুমোদন করতে চান?`
      : `Are you sure you want to approve all ${pendingList.length} pending section reports at once?`;

    if (!window.confirm(confirmMsg)) return;

    setIsBatchApproving(true);
    const timestamp = new Date().toISOString();

    for (const rec of pendingList) {
      const updatedRec = {
        ...rec,
        status: 'CO_APPROVED' as const,
        coAppointment: currentUser.appointmentTitle,
        coDecision: 'FINAL_APPROVED' as const,
        coRemarks: 'Command Master Batch Approval granted.',
        coDecidedAt: timestamp
      };
      await db.sectionApprovals.update(rec.id, updatedRec);
      await syncEntityToCloud('sectionApprovals', rec.id, updatedRec);

      // Also update daily states
      if (rec.section === 'parade_state' || rec.section === 'manpower') {
        const p = await db.paradeStates.orderBy('stateDate').last();
        if (p) {
          const updatedP = { ...p, status: 'CO_APPROVED' as const, updatedAt: timestamp };
          await db.paradeStates.update(p.id, updatedP);
          await syncEntityToCloud('paradeStates', p.id, updatedP);
        }
      } else if (rec.section === 'vehicle') {
        const v = await db.vehicleDailyStates.orderBy('stateDate').last();
        if (v) {
          const updatedV = { ...v, status: 'CO_APPROVED' as const, updatedAt: timestamp };
          await db.vehicleDailyStates.update(v.id, updatedV);
          await syncEntityToCloud('vehicleDailyStates', v.id, updatedV);
        }
      }

      await logAuditEvent(
        currentUser,
        'CO_APPROVED',
        rec.section,
        rec.id,
        `CO Master Batch Approved: ${rec.sectionTitle}`
      );
    }

    setIsBatchApproving(false);
    alert(language === 'bn' 
      ? 'সকল সেকশন রিপোর্ট সফলভাবে অনুমোদন করা হয়েছে।' 
      : 'ALL SECTION REPORTS APPROVED: Master approval granted by Commanding Officer.'
    );
    loadApprovals();
  };

  // Negative Action (Return / Hold)
  const handleExecuteNegativeAction = async () => {
    if (!selectedRecord || !actionRemarks.trim()) {
      alert('Mandatory written remarks required for return or hold.');
      return;
    }

    const timestamp = new Date().toISOString();
    const newStatus: ApprovalStatus = actionType === 'RETURN' ? 'RETURNED' : 'HELD';

    await db.sectionApprovals.update(selectedRecord.id, {
      status: newStatus,
      twoIcAppointment: currentUser.appointmentTitle,
      twoIcDecision: newStatus,
      twoIcRemarks: actionRemarks,
      twoIcDecidedAt: timestamp
    });

    await logAuditEvent(
      currentUser,
      actionType === 'RETURN' ? '2IC_RETURNED' : '2IC_HELD',
      selectedRecord.section,
      selectedRecord.id,
      `${currentUser.appointmentTitle} ${actionType === 'RETURN' ? 'returned' : 'held'} state: ${actionRemarks}`
    );

    setIsModalOpen(false);
    setActionRemarks('');
    loadApprovals();
  };

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'parade_state': return <CalendarCheck className="w-5 h-5 text-emerald-600" />;
      case 'manpower': return <Users className="w-5 h-5 text-blue-600" />;
      case 'vehicle': return <Truck className="w-5 h-5 text-amber-600" />;
      case 'med_store_medicine': return <Pill className="w-5 h-5 text-rose-600" />;
      case 'med_store_instruments': return <Scissors className="w-5 h-5 text-purple-600" />;
      case 'med_store_equipment': return <Activity className="w-5 h-5 text-teal-600" />;
      default: return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  const pendingCount = approvals.filter(a => a.status !== 'CO_APPROVED').length;
  const approvedCount = approvals.filter(a => a.status === 'CO_APPROVED').length;

  const filteredApprovals = approvals.filter(a => {
    if (filterTab === 'PENDING') return a.status !== 'CO_APPROVED';
    if (filterTab === 'APPROVED') return a.status === 'CO_APPROVED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with Master Batch Approval Button */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#2D4A22] text-[#F59E0B]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  {language === 'bn' ? 'অনুমোদন বোর্ড' : 'Approval Board'}
                </h2>
                <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
                  95 FD AMB
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'bn'
                  ? 'সকল সেকশন রিপোর্ট পর্যালোচনা ও অধিনায়ক (CO) চূড়ান্ত অনুমোদন ডেস্ক'
                  : 'Consolidated Command Approval Desk for Commanding Officer (CO)'}
              </p>
            </div>
          </div>
        </div>

        {/* Master Batch Approval Button for CO */}
        {(currentUser.role === 'co' || currentUser.role === 'admin') && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleApproveAllPending}
              disabled={isBatchApproving || pendingCount === 0}
              className={`
                w-full md:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider
                shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer
                ${pendingCount > 0 
                  ? 'bg-[#F59E0B] hover:bg-[#D97706] text-black ring-2 ring-[#F59E0B]/50 animate-pulse' 
                  : 'bg-emerald-800 text-white opacity-80 cursor-not-allowed'}
              `}
            >
              <CheckCheck className="w-4 h-4" />
              <span>
                {language === 'bn' 
                  ? `এক ক্লিকে সব রিপোর্ট অনুমোদন (${pendingCount})` 
                  : `Approve All Pending Reports (${pendingCount})`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Overview Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Pending CO Approval</span>
          <span className="text-2xl font-mono font-extrabold text-[#F59E0B] mt-1 block">
            {formatNumber(pendingCount)}
          </span>
          <span className="text-[10px] text-slate-400">Reports awaiting decision</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">CO Approved & Locked</span>
          <span className="text-2xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
            {formatNumber(approvedCount)}
          </span>
          <span className="text-[10px] text-slate-400">Secure locked records</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Registered Sections</span>
          <span className="text-2xl font-mono font-extrabold text-slate-800 dark:text-slate-200 mt-1 block">
            {formatNumber(approvals.length)}
          </span>
          <span className="text-[10px] text-slate-400">Core administrative modules</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Pending Corrections</span>
          <span className="text-2xl font-mono font-extrabold text-amber-500 mt-1 block">
            {formatNumber(correctionsPending)}
          </span>
          <span className="text-[10px] text-slate-400">Correction requests</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-xl gap-2 text-xs font-bold">
        <button
          onClick={() => setFilterTab('ALL')}
          className={`pb-3 px-3 transition border-b-2 cursor-pointer ${
            filterTab === 'ALL'
              ? 'border-[#2D4A22] dark:border-emerald-400 text-[#2D4A22] dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          All Reports ({approvals.length})
        </button>

        <button
          onClick={() => setFilterTab('PENDING')}
          className={`pb-3 px-3 transition border-b-2 cursor-pointer ${
            filterTab === 'PENDING'
              ? 'border-[#2D4A22] dark:border-emerald-400 text-[#2D4A22] dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Pending Approval ({pendingCount})
        </button>

        <button
          onClick={() => setFilterTab('APPROVED')}
          className={`pb-3 px-3 transition border-b-2 cursor-pointer ${
            filterTab === 'APPROVED'
              ? 'border-[#2D4A22] dark:border-emerald-400 text-[#2D4A22] dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Approved & Locked ({approvedCount})
        </button>
      </div>

      {/* Approval Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredApprovals.map((rec) => {
          const isPending = rec.status !== 'CO_APPROVED';

          return (
            <div 
              key={rec.id}
              className={`
                bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border flex flex-col justify-between space-y-4 transition
                ${isPending 
                  ? 'border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/20 hover:border-amber-500' 
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}
              `}
            >
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    {getSectionIcon(rec.section)}
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {rec.sectionTitle}
                    </h3>
                  </div>
                  <StatusBadge status={rec.status} size="sm" />
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Report Date:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{formatNumber(rec.stateDate)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Prepared / Submitted:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-sans">{rec.submittedByAppointment || 'Operator'}</span>
                  </div>
                  {rec.twoIcAppointment && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">2IC Verified:</span>
                      <span className="text-purple-600 font-bold font-sans">{rec.twoIcAppointment}</span>
                    </div>
                  )}
                  {rec.coAppointment && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">CO Final Lock:</span>
                      <span className="text-emerald-600 font-bold font-sans">{rec.coAppointment}</span>
                    </div>
                  )}
                  {rec.coRemarks && (
                    <p className="text-[11px] text-slate-500 font-sans italic mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      "{rec.coRemarks}"
                    </p>
                  )}
                </div>
              </div>

              {/* Actions Toolbar */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                {/* Module Quick View Link */}
                {onNavigate && (
                  <button
                    onClick={() => {
                      if (rec.section === 'parade_state') onNavigate('/parade-state');
                      else if (rec.section === 'manpower') onNavigate('/manpower');
                      else if (rec.section === 'vehicle') onNavigate('/vehicle');
                      else if (rec.section.startsWith('med_store_')) onNavigate('/medical-store');
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View Section</span>
                  </button>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  {/* CO Final Command Approval */}
                  {isPending && (currentUser.role === 'co' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleCoFinalApprove(rec)}
                      className="px-3 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-black text-xs font-extrabold shadow flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>CO Approve & Lock</span>
                    </button>
                  )}

                  {rec.status === 'CO_APPROVED' && (
                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                      <Lock className="w-3 h-3" />
                      <span>COMMAND LOCKED</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Return / Hold Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={actionType === 'RETURN' ? 'Return State for Correction' : 'Hold State for Physical Verification'}
        subtitle={`Section: ${selectedRecord?.sectionTitle} | Mandatory justification required`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Officer's Written Reason / Remarks *
            </label>
            <textarea
              rows={3}
              value={actionRemarks}
              onChange={(e) => setActionRemarks(e.target.value)}
              placeholder="Specify discrepancy or reason for returning/holding this state..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              {t('action_cancel')}
            </button>
            <button
              type="button"
              onClick={handleExecuteNegativeAction}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow cursor-pointer"
            >
              Confirm Action
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
