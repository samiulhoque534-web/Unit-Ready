import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { CorrectionRequest } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { RequestCorrectionModal } from '../common/RequestCorrectionModal';
import { logAuditEvent } from '../../services/auditService';
import { sendPhoneSmsAlert, DEFAULT_UNIT_PHONE } from '../../services/smsService';
import { 
  Edit3, Plus, ShieldCheck, CheckCircle2, 
  AlertTriangle, FileText, Lock, Unlock, Paperclip, Check, ArrowRight, ExternalLink,
  History, RotateCcw, AlertCircle, Eye, ShieldAlert, Clock
} from 'lucide-react';

interface CorrectionCentreModuleProps {
  onNavigate?: (path: string) => void;
}

export const CorrectionCentreModule: React.FC<CorrectionCentreModuleProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, language } = useLanguage();

  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedCorrection, setSelectedCorrection] = useState<CorrectionRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'ACTIVE_REQUESTS' | 'AUDIT_HISTORY'>('ACTIVE_REQUESTS');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Operator field edit state
  const [correctedValueToSubmit, setCorrectedValueToSubmit] = useState<string>('');

  const loadData = async () => {
    const list = await db.correctionRequests.toArray();
    setCorrections(list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
  };

  useEffect(() => {
    loadData();
  }, []);

  const canRequestCorrection = 
    currentUser.role !== 'general_personnel' && 
    currentUser.role !== 'general_duty' && 
    currentUser.role !== 'smt_member' && 
    currentUser.role !== 'authorised_personnel' && 
    currentUser.role !== 'auditor';

  // Helper to determine module path from record title / section
  const getModulePath = (corr: CorrectionRequest): string => {
    const text = (corr.recordTypeOrDate + ' ' + corr.targetFieldName).toLowerCase();
    if (text.includes('parade') || text.includes('activity') || text.includes('cover') || text.includes('menu')) {
      return '/parade-state';
    }
    if (text.includes('medicine') || text.includes('instrument') || text.includes('equipment') || text.includes('medical') || text.includes('drug')) {
      return '/medical-store';
    }
    if (text.includes('manpower') || text.includes('personnel') || text.includes('nominal') || text.includes('smt')) {
      return '/manpower';
    }
    if (text.includes('vehicle') || text.includes('mt') || text.includes('transport') || text.includes('fleet')) {
      return '/vehicle';
    }
    if (text.includes('duty') || text.includes('roster')) {
      return '/duty-roster';
    }
    if (text.includes('notice') || text.includes('circular')) {
      return '/others-notices';
    }
    if (text.includes('training') || text.includes('handbook')) {
      return '/training-hub';
    }
    return '/parade-state';
  };

  // CO Directly Approves and Applies Proposed Correction
  const handleCoDirectApproveAndApply = async (corr: CorrectionRequest) => {
    const nowIso = new Date().toISOString();
    const value = corr.proposedCorrectedValue || corr.existingValue;

    // 1. Update Correction Request status to CO APPROVED & LOCKED
    await db.correctionRequests.update(corr.id, {
      status: 'CO_CONFIRMED_LOCKED',
      correctedValueApplied: value,
      coRemarks: 'Correction approved and officially applied by Commanding Officer. Record permanently locked.',
      coConfirmedAt: nowIso,
      coDecidedAt: nowIso
    });

    // 2. Automatically apply change to corresponding DB table where identifiable
    try {
      const text = (corr.recordTypeOrDate + ' ' + corr.targetFieldName).toLowerCase();

      // Parade State
      if (text.includes('parade') && text.includes('menu')) {
        const p = await db.paradeStates.orderBy('stateDate').last();
        if (p) await db.paradeStates.update(p.id, { foodMenu: value, updatedAt: nowIso });
      }
      if (text.includes('parade') && (text.includes('activity') || text.includes('activities'))) {
        const p = await db.paradeStates.orderBy('stateDate').last();
        if (p) await db.paradeStates.update(p.id, { tomorrowActivities: [value], updatedAt: nowIso });
      }

      // Manpower / Personnel
      if (text.includes('manpower') || text.includes('nominal') || text.includes('personnel')) {
        const list = await db.manpowerPersonnel.toArray();
        const found = list.find(m => text.includes(m.baNo.toLowerCase()) || text.includes(m.name.toLowerCase()));
        if (found) {
          if (text.includes('status')) {
            await db.manpowerPersonnel.update(found.id, { currentStatus: value as any });
          } else if (text.includes('appointment')) {
            await db.manpowerPersonnel.update(found.id, { appointment: value });
          }
        }
      }

      // Vehicle
      if (text.includes('vehicle') || text.includes('mt')) {
        const vehicles = await db.vehicleFleetItems.toArray();
        const found = vehicles.find(v => text.includes(v.registrationFleetRef.toLowerCase()) || text.includes(v.vehicleType.toLowerCase()));
        if (found) {
          if (text.includes('serviceable') || text.includes('status')) {
            await db.vehicleFleetItems.update(found.id, { status: value as any });
          } else if (text.includes('remark')) {
            await db.vehicleFleetItems.update(found.id, { remarks: value });
          }
        }
      }

      // Medicine
      if (text.includes('medicine') || text.includes('drug')) {
        const meds = await db.medicines.toArray();
        const found = meds.find(m => text.includes(m.genericName.toLowerCase()) || (m.brandName && text.includes(m.brandName.toLowerCase())));
        if (found) {
          if (text.includes('authorized') || text.includes('quantity')) {
            const num = parseInt(value.replace(/\D/g, '')) || found.authorizedQuantity;
            await db.medicines.update(found.id, { authorizedQuantity: num });
          }
        }
      }

      // Instruments
      if (text.includes('instrument')) {
        const insts = await db.medicalInstruments.toArray();
        const found = insts.find(i => text.includes(i.instrumentSetName.toLowerCase()));
        if (found) {
          if (text.includes('serviceable')) {
            const num = parseInt(value.replace(/\D/g, '')) || found.serviceableQty;
            await db.medicalInstruments.update(found.id, { serviceableQty: num, updatedAt: nowIso });
          }
        }
      }

      // Equipment
      if (text.includes('equipment')) {
        const equips = await db.medicalEquipment.toArray();
        const found = equips.find(e => text.includes(e.equipmentName.toLowerCase()));
        if (found) {
          if (text.includes('serviceable') || text.includes('status')) {
            await db.medicalEquipment.update(found.id, { currentStatus: value as any, updatedAt: nowIso });
          }
        }
      }
    } catch (e) {
      console.warn('Auto DB patch note:', e);
    }

    // 3. Cryptographic Audit Log
    await logAuditEvent(
      currentUser,
      'CORRECTION_CONFIRMED',
      'correction',
      corr.referenceNo,
      `Commanding Officer approved and applied correction ${corr.referenceNo} for [${corr.recordTypeOrDate}] field [${corr.targetFieldName}]. Value changed from "${corr.existingValue}" to "${value}". Record permanently locked.`
    );

    // 4. SMS and in-app notifications
    await sendPhoneSmsAlert(
      `Correction Approved & Applied: ${corr.referenceNo}`,
      `Commanding Officer approved correction for [${corr.recordTypeOrDate}]. Corrected value "${value}" applied. Record permanently locked.`,
      'APPROVAL',
      currentUser.appointmentTitle,
      DEFAULT_UNIT_PHONE
    );

    await db.notifications.add({
      id: 'notif-' + Date.now(),
      title: `Correction Approved: ${corr.referenceNo}`,
      message: `Commanding Officer approved correction for [${corr.recordTypeOrDate} - ${corr.targetFieldName}]. Corrected value applied and record permanently locked.`,
      type: 'SUCCESS',
      section: 'correction',
      timestamp: nowIso,
      isRead: false,
      targetPath: '/corrections'
    });

    alert(`CO APPROVAL GRANTED: Correction ${corr.referenceNo} is approved and officially applied to the record. The record remains permanently locked.`);
    loadData();
  };

  // CO Returns Request with Remarks
  const handleCoReturnRequest = async (corr: CorrectionRequest) => {
    const remarks = prompt('Enter Return Remarks / Instructions for Requester:', 'Please provide additional clinical / administrative justification.') || '';
    if (!remarks.trim()) return;

    const nowIso = new Date().toISOString();
    await db.correctionRequests.update(corr.id, {
      status: 'PENDING_CO',
      coRemarks: `RETURNED BY CO: ${remarks.trim()}`,
      coDecidedAt: nowIso
    });

    await logAuditEvent(
      currentUser,
      'CO_RETURNED',
      'correction',
      corr.referenceNo,
      `CO returned correction request ${corr.referenceNo} with remarks: ${remarks.trim()}`
    );

    alert('Correction request returned to requester with remarks.');
    loadData();
  };

  // CO Rejects Request
  const handleCoRejectRequest = async (corr: CorrectionRequest) => {
    const reasonPrompt = prompt('Enter rejection reason / instructions:', 'Correction request rejected by CO.') || 'Correction request rejected by CO.';
    const nowIso = new Date().toISOString();

    await db.correctionRequests.update(corr.id, {
      status: 'REJECTED',
      coRemarks: reasonPrompt,
      coDecidedAt: nowIso
    });

    await logAuditEvent(
      currentUser,
      'CO_RETURNED',
      'correction',
      corr.referenceNo,
      `CO rejected correction request: ${reasonPrompt}`
    );

    alert('Correction request rejected. The original record remains permanently locked.');
    loadData();
  };

  // Operator Opens Field Edit Modal (To refine proposed value)
  const handleOpenEditField = (corr: CorrectionRequest) => {
    setSelectedCorrection(corr);
    setCorrectedValueToSubmit(corr.proposedCorrectedValue || corr.existingValue);
    setIsEditModalOpen(true);
  };

  // Operator Saves Refined Proposed Value
  const handleSubmitEditedField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorrection || !correctedValueToSubmit.trim()) return;

    const nowIso = new Date().toISOString();
    await db.correctionRequests.update(selectedCorrection.id, {
      proposedCorrectedValue: correctedValueToSubmit.trim(),
      status: 'PENDING_CO',
      coRemarks: undefined
    });

    // Notify CO
    await db.notifications.add({
      id: 'notif-' + Date.now(),
      title: `Corrected Value Updated: ${selectedCorrection.referenceNo}`,
      message: `${currentUser.appointmentTitle} updated the proposed correction for [${selectedCorrection.recordTypeOrDate} - ${selectedCorrection.targetFieldName}]. Pending CO Approval.`,
      type: 'WARNING',
      section: 'correction',
      timestamp: nowIso,
      isRead: false,
      targetPath: '/corrections'
    });

    await logAuditEvent(
      currentUser,
      'RECORD_SUBMITTED',
      'correction',
      selectedCorrection.referenceNo,
      `Operator ${currentUser.appointmentTitle} updated proposed corrected value: "${correctedValueToSubmit.trim()}" for [${selectedCorrection.recordTypeOrDate}] field [${selectedCorrection.targetFieldName}]. Forwarded to CO for approval.`
    );

    alert('Proposed corrected value updated and forwarded directly to Commanding Officer (CO) for approval.');
    setIsEditModalOpen(false);
    loadData();
  };

  const filteredCorrections = corrections.filter(c => {
    const q = searchFilter.toLowerCase();
    return (
      c.referenceNo.toLowerCase().includes(q) ||
      c.recordTypeOrDate.toLowerCase().includes(q) ||
      c.targetFieldName.toLowerCase().includes(q) ||
      c.requestedByAppointment.toLowerCase().includes(q) ||
      c.reason.toLowerCase().includes(q)
    );
  });

  const activeRequests = filteredCorrections.filter(c => c.status !== 'CO_CONFIRMED_LOCKED' && c.status !== 'REJECTED');
  const auditHistory = filteredCorrections.filter(c => c.status === 'CO_CONFIRMED_LOCKED' || c.status === 'REJECTED');

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Controlled Correction & Record Locking Centre
            </h1>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Correction Workflow: Enter Correction → CO Approval & Apply → Permanently Locked & Audited
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canRequestCorrection && (
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-[#F59E0B] text-xs font-extrabold shadow transition flex items-center gap-1.5 border border-[#F59E0B]/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('action_requestCorrection')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-xl gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('ACTIVE_REQUESTS')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'ACTIVE_REQUESTS'
              ? 'border-[#2D4A22] dark:border-emerald-400 text-[#2D4A22] dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Active Requests ({activeRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT_HISTORY')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'AUDIT_HISTORY'
              ? 'border-[#2D4A22] dark:border-emerald-400 text-[#2D4A22] dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Permanent Audit History ({auditHistory.length})</span>
        </button>
      </div>

      {/* Workflow Guidance Card */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-[#2D4A22] dark:text-emerald-400 font-bold uppercase tracking-wide mb-1">
          <ShieldAlert className="w-4 h-4" />
          <span>Official Record Correction Protocol</span>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
          <strong>1. Enter Correction:</strong> Authorized Operator or Officer selects the locked record and enters the proposed corrected value with mandatory justification.<br />
          <strong>2. Direct CO Dispatch:</strong> The request is dispatched directly to the Commanding Officer (CO) with SMS & In-App alert.<br />
          <strong>3. CO Approval & Lock:</strong> CO reviews the existing vs proposed value. Upon CO Approval, the corrected value is officially applied to the record and permanently locked.<br />
          <strong>4. Tamper-Evident Audit:</strong> Full before/after values, requester, timestamp, and CO authorization are permanently recorded in the immutable audit log.
        </p>
      </div>

      {/* Active Requests List */}
      {activeTab === 'ACTIVE_REQUESTS' && (
        <div className="space-y-4">
          {activeRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
              <span>No pending correction requests. All CO-approved unit records are currently locked and synchronized.</span>
            </div>
          ) : (
            activeRequests.map((corr) => (
              <div
                key={corr.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4"
              >
                {/* Request Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
                        {corr.referenceNo}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {corr.recordTypeOrDate}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Requested by <strong className="text-slate-700 dark:text-slate-300">{corr.requestedByAppointment}</strong> on {formatNumber(corr.requestedAt.substring(0, 16).replace('T', ' '))}
                    </p>
                  </div>

                  <div>
                    {corr.status === 'PENDING_CO' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>PENDING CO APPROVAL (RECORD LOCKED)</span>
                      </span>
                    )}
                    {corr.status === 'CO_CONFIRMED_LOCKED' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>CO APPROVED — CORRECTED AND LOCKED</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Field Comparison Box */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Field to Correct</span>
                    <strong className="font-mono text-slate-900 dark:text-white mt-0.5 block">{corr.targetFieldName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Current Value (Read-Only)</span>
                    <span className="font-mono text-red-600 line-through font-bold mt-0.5 block">{corr.existingValue}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Proposed Corrected Value</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold mt-0.5 block">
                      {corr.correctedValueApplied || corr.proposedCorrectedValue}
                    </span>
                  </div>
                </div>

                {/* Reason, Attachments & Remarks */}
                <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                  <p><strong>Reason for Correction:</strong> {corr.reason}</p>
                  {corr.attachmentName && (
                    <p className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Supporting Document: <strong>{corr.attachmentName}</strong></span>
                    </p>
                  )}
                  {corr.coRemarks && (
                    <p className="text-amber-800 dark:text-amber-300 font-semibold mt-1">
                      <strong>CO Instructions / Remarks:</strong> {corr.coRemarks}
                    </p>
                  )}
                </div>

                {/* Action Toolbar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2 text-xs">
                  {/* CO Decision Actions */}
                  {corr.status === 'PENDING_CO' && (currentUser.role === 'co' || currentUser.role === 'admin') && (
                    <>
                      <button
                        onClick={() => handleCoRejectRequest(corr)}
                        className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-300 text-xs font-bold transition cursor-pointer"
                      >
                        Reject Request
                      </button>
                      <button
                        onClick={() => handleCoReturnRequest(corr)}
                        className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold transition cursor-pointer"
                      >
                        Return with Remarks
                      </button>
                      <button
                        onClick={() => handleCoDirectApproveAndApply(corr)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-[#F59E0B] text-xs font-extrabold shadow transition flex items-center gap-1.5 border border-[#F59E0B]/40 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Approve & Apply Correction</span>
                      </button>
                    </>
                  )}

                  {/* Requester Edit Option before CO decision */}
                  {corr.status === 'PENDING_CO' && (corr.requestedByUserId === currentUser.id || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleOpenEditField(corr)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Proposed Value</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Audit History Tab */}
      {activeTab === 'AUDIT_HISTORY' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Tamper-Evident Correction Trail & Permanent Record Preservation</span>
            </h3>
            <span className="font-mono text-[10px] text-slate-400 font-bold">95 FD AMB AUDIT</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[10px] font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Reference No</th>
                  <th className="py-2.5 px-3">Record / Report</th>
                  <th className="py-2.5 px-3">Corrected Field</th>
                  <th className="py-2.5 px-3">Original Value</th>
                  <th className="py-2.5 px-3">Corrected Value</th>
                  <th className="py-2.5 px-3">Requester</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">CO Approval Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
                {auditHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                      No historical corrections archived yet.
                    </td>
                  </tr>
                ) : (
                  auditHistory.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{c.referenceNo}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200">{c.recordTypeOrDate}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">{c.targetFieldName}</td>
                      <td className="py-2.5 px-3 line-through text-red-600">{c.existingValue}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600">{c.correctedValueApplied || c.proposedCorrectedValue}</td>
                      <td className="py-2.5 px-3 font-sans">{c.requestedByAppointment}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={c.status === 'CO_CONFIRMED_LOCKED' ? 'CO_CONFIRMED_LOCKED' : 'REJECTED'} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {c.coConfirmedAt ? formatNumber(c.coConfirmedAt.substring(0, 16).replace('T', ' ')) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Request Correction Modal */}
      <RequestCorrectionModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        recordTypeOrDate="Daily Unit Record (95 Fd Amb)"
        onSuccess={() => loadData()}
      />

      {/* Modal 2: Edit Unlocked Field Modal */}
      {selectedCorrection && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Unlocked Field: ${selectedCorrection.targetFieldName}`}
          subtitle={`CO approved limited correction for [${selectedCorrection.recordTypeOrDate}]`}
        >
          <form onSubmit={handleSubmitEditedField} className="space-y-4">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs space-y-1 text-blue-900 dark:text-blue-200">
              <p><strong>Target Record:</strong> {selectedCorrection.recordTypeOrDate}</p>
              <p><strong>Field:</strong> <span className="font-mono">{selectedCorrection.targetFieldName}</span></p>
              <p><strong>Existing Approved Value:</strong> <span className="font-mono text-red-600 line-through font-bold">{selectedCorrection.existingValue}</span></p>
              {selectedCorrection.coRemarks && (
                <p><strong>CO Remarks:</strong> {selectedCorrection.coRemarks}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Enter Corrected Value for [{selectedCorrection.targetFieldName}] *
              </label>
              <textarea
                rows={3}
                value={correctedValueToSubmit}
                onChange={(e) => setCorrectedValueToSubmit(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 focus:border-[#2D4A22]"
                placeholder="Enter verified corrected data..."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Field & Submit for CO Final Approval</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
